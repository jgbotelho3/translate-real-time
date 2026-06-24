// Load .env.local before anything else — server.ts runs outside Next.js's
// module pipeline so env vars are not automatically available at import time.
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { createServer } from 'http'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import OpenAI from 'openai'
import { OpenAIRealtimeWS } from 'openai/realtime/ws'
import { SUPPORTED_LANGUAGES } from './src/lib/languages'
import { sessionStore } from './src/lib/session-store'
import type {
  SessionJoinPayload,
  ListenerJoinPayload,
  ListenerSelectPayload,
  AudioChunkPayload,
  TranscriptPayload,
} from './src/types'

const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'

// ─── OpenAI client (uses OPENAI_API_KEY from env) ───────────────────────────
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// ─── In-memory session registry ─────────────────────────────────────────────
// Each session has a map of languageCode → RealtimeWS connection
interface RealtimeSession {
  sessionId: string
  clients: Map<string, OpenAIRealtimeWS>
  speakerSocketId: string
  languages: string[]
  audioChunksSent: number
  audioChunksFromOpenAI: Record<string, number>
}

const sessions = new Map<string, RealtimeSession>()

// ─── Boot Next.js with our HTTP server ──────────────────────────────────────
const httpServer = createServer()
const app = next({ dev, httpServer })
const handle = app.getRequestHandler()

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
})

// ── /speaker namespace ────────────────────────────────────────────────────────
const speakerNS = io.of('/speaker')

speakerNS.on('connection', (socket) => {
  console.log('[speaker] connected:', socket.id)

  socket.on('speaker:join', async (payload: SessionJoinPayload) => {
    const { sessionId, targetLanguages } = payload
    console.log('[speaker] join session:', sessionId, 'languages:', targetLanguages)

    // Retrieve session metadata (languages) from the shared global session store
    const stored = sessionStore.get(sessionId)
    if (!stored) {
      console.error(`[speaker] session ${sessionId} not found in store — may have expired`)
      socket.emit('error', { message: `Session ${sessionId} not found or expired` })
      return
    }
    sessionStore.delete(sessionId)

    // Create one RealtimeWS client per target language (the "fork")
    const clients = new Map<string, OpenAIRealtimeWS>()

    const session: RealtimeSession = {
      sessionId,
      clients,
      speakerSocketId: socket.id,
      languages: targetLanguages,
      audioChunksSent: 0,
      audioChunksFromOpenAI: {},
    }
    sessions.set(sessionId, session)
    socket.data.sessionId = sessionId

    for (const langCode of targetLanguages) {
      const language = SUPPORTED_LANGUAGES.find((l) => l.code === langCode)
      if (!language) continue

      try {
        const apiKeyPreview = (openaiClient.apiKey ?? '').slice(0, 8) + '...'
        console.log(`[realtime:${langCode}] creating RTClient — apiKey: ${apiKeyPreview}`)

        // GA model — required for the GA-shaped session.update (type: 'realtime',
        // nested audio.input/audio.output). The old preview model rejects it.
        const rtClient = new OpenAIRealtimeWS(
          { model: 'gpt-realtime' },
          openaiClient,
        )

        // Log ALL events from OpenAI for diagnosis
        ;(rtClient as any).on('event', (event: any) => {
          console.log(`[realtime:${langCode}] ← event: ${event?.type}`)
        })

        // Configure session once connected
        rtClient.on('session.created', () => {
          // GA Realtime API (openai/realtime/ws → resources/realtime) uses a
          // nested shape: audio.input / audio.output, output_modalities, and
          // audio formats as objects ({ type: 'audio/pcm', rate: 24000 }).
          // The send() helper's types are stricter than the protocol — cast as any.
          rtClient.send({
            type: 'session.update',
            session: {
              type: 'realtime',
              output_modalities: ['audio'],
              instructions: language.voicePrompt,
              audio: {
                input: {
                  format: { type: 'audio/pcm', rate: 24000 },
                  transcription: { model: 'whisper-1' },
                  turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500,
                    create_response: true,
                  },
                },
                output: {
                  format: { type: 'audio/pcm', rate: 24000 },
                  voice: 'coral',
                },
              },
            } as any,
          })
          console.log(`[realtime:${langCode}] session configured`)
        })

        rtClient.on('session.updated', () => {
          console.log(`[realtime:${langCode}] session.updated ✓`)
        })

        rtClient.on('input_audio_buffer.speech_started', () => {
          console.log(`[realtime:${langCode}] 🎤 speech detected`)
        })

        rtClient.on('input_audio_buffer.speech_stopped', () => {
          // No manual response.create — server VAD has create_response: true,
          // so the response is generated automatically at end of speech.
          console.log(`[realtime:${langCode}] 🔇 speech stopped — awaiting response`)
        })

        rtClient.on('response.created', () => {
          console.log(`[realtime:${langCode}] response started`)
        })

        rtClient.on('response.done', (event) => {
          const usage = (event as any)?.response?.usage
          console.log(`[realtime:${langCode}] response.done — output items: ${(event as any)?.response?.output?.length ?? 0}`, usage ?? '')
        })

        // Forward translated audio chunks to listeners
        rtClient.on('response.output_audio.delta', (event) => {
          const chunk: AudioChunkPayload = {
            languageCode: langCode,
            pcm16Base64: event.delta,
          }
          const room = `session:${sessionId}:${langCode}`
          io.of('/listener').to(room).emit('audio:chunk', chunk)
          session.audioChunksFromOpenAI[langCode] = (session.audioChunksFromOpenAI[langCode] ?? 0) + 1
          const count = session.audioChunksFromOpenAI[langCode]
          if (count === 1 || count % 50 === 0) {
            console.log(`[realtime:${langCode}] audio:chunk #${count} → room "${room}" (${Buffer.from(event.delta, 'base64').length} bytes)`)
          }
        })

        // Forward transcripts to listeners
        rtClient.on('response.output_audio_transcript.done', (event) => {
          const transcript: TranscriptPayload = {
            languageCode: langCode,
            original: '', // filled by input transcription
            translated: event.transcript ?? '',
            isFinal: true,
          }
          io.of('/listener').to(`session:${sessionId}:${langCode}`).emit('transcript:done', transcript)
        })

        // Input audio transcription (the original speech)
        rtClient.on('conversation.item.input_audio_transcription.completed', (event) => {
          const transcript: TranscriptPayload = {
            languageCode: langCode,
            original: event.transcript ?? '',
            translated: '',
            isFinal: true,
          }
          io.of('/listener').to(`session:${sessionId}:${langCode}`).emit('transcript:original', transcript)
        })

        rtClient.on('error', (err) => {
          console.error(`[realtime:${langCode}] error:`, JSON.stringify(err))
        })

        clients.set(langCode, rtClient)
        console.log(`[realtime:${langCode}] client created`)
      } catch (err) {
        console.error(`[speaker] failed to create client for ${langCode}:`, err)
      }
    }

    // Emit session status only after all RTClients are created
    io.of('/listener').to(`session:${sessionId}`).emit('session:status', {
      sessionId,
      isLive: true,
      speakerConnected: true,
      activeLanguages: targetLanguages,
    })
  })

  // Receive audio from speaker and fork to all language clients
  socket.on('speaker:audio', (payload: { pcm16Base64: string }) => {
    const sessionId = socket.data.sessionId as string | undefined
    if (!sessionId) return

    const session = sessions.get(sessionId)
    if (!session) return

    const audioBuffer = Buffer.from(payload.pcm16Base64, 'base64')
    const base64 = audioBuffer.toString('base64')

    session.audioChunksSent++
    if (session.audioChunksSent === 1 || session.audioChunksSent % 100 === 0) {
      console.log(`[speaker] audio chunk #${session.audioChunksSent} → ${session.clients.size} RTClient(s) (${audioBuffer.length} bytes)`)
    }

    for (const [, client] of session.clients) {
      try {
        client.send({
          type: 'input_audio_buffer.append',
          audio: base64,
        })
      } catch {
        // client may have disconnected
      }
    }
  })

  // Speaker stops broadcasting
  socket.on('speaker:stop', () => {
    cleanupSession(socket.data.sessionId, io)
  })

  socket.on('disconnect', () => {
    console.log('[speaker] disconnected:', socket.id)
    cleanupSession(socket.data.sessionId, io)
  })
})

// ── /listener namespace ───────────────────────────────────────────────────────
const listenerNS = io.of('/listener')

listenerNS.on('connection', (socket) => {
  console.log('[listener] connected:', socket.id)

  socket.on('listener:join', (payload: ListenerJoinPayload) => {
    const { sessionId } = payload
    socket.join(`session:${sessionId}`)
    socket.data.sessionId = sessionId
    console.log('[listener] joined session:', sessionId)

    // Tell client which languages are active
    const session = sessions.get(sessionId)
    if (session) {
      socket.emit('session:status', {
        sessionId,
        isLive: true,
        speakerConnected: true,
        activeLanguages: session.languages,
      })
    }

    // Update listener count
    listenerNS.to(`session:${sessionId}`).emit('listener:count', {
      sessionId,
      count: (listenerNS.adapter as any).rooms?.get(`session:${sessionId}`)?.size ?? 0,
    })
  })

  socket.on('listener:select-language', (payload: ListenerSelectPayload) => {
    const { sessionId, languageCode } = payload
    const prevLang = socket.data.activeLanguage as string | undefined

    // Leave old language room
    if (prevLang) {
      const prevRoom = `session:${sessionId}:${prevLang}`
      socket.leave(prevRoom)
      console.log(`[listener] ${socket.id} left room: ${prevRoom}`)
    }

    // Join new language room
    const newRoom = `session:${sessionId}:${languageCode}`
    socket.join(newRoom)
    socket.data.activeLanguage = languageCode
    console.log(`[listener] ${socket.id} joined room: ${newRoom}`)

    // Confirm to speaker which languages are being listened to
    const session = sessions.get(sessionId)
    if (session) {
      const hasClients = session.clients.has(languageCode)
      console.log(`[listener] language "${languageCode}" has RTClient: ${hasClients}`)
    } else {
      console.warn(`[listener] session ${sessionId} not found — speaker may not have joined yet`)
    }
  })

  socket.on('disconnect', () => {
    console.log('[listener] disconnected:', socket.id)
  })
})

// ─── Cleanup helper ───────────────────────────────────────────────────────────
function cleanupSession(sessionId: string | undefined, ioServer: SocketIOServer) {
  if (!sessionId) return
  const session = sessions.get(sessionId)
  if (!session) return

  console.log('[server] cleaning up session:', sessionId)
  for (const [langCode, client] of session.clients) {
    try {
      client.close({ code: 1000, reason: 'Session ended' })
    } catch {
      // ignore
    }
    console.log(`[realtime:${langCode}] closed`)
  }
  sessions.delete(sessionId)

  ioServer.of('/listener').to(`session:${sessionId}`).emit('session:status', {
    sessionId,
    isLive: false,
    speakerConnected: false,
    activeLanguages: [],
  })
}

// ─── Start everything ────────────────────────────────────────────────────────
app.prepare().then(() => {
  httpServer.on('request', (req, res) => {
    // Debug endpoint — inspect in-memory session state without Socket.IO admin UI
    if (req.method === 'GET' && req.url === '/api/debug-session') {
      const payload = {
        activeSessions: Array.from(sessions.entries()).map(([id, s]) => ({
          sessionId: id,
          speakerSocketId: s.speakerSocketId,
          languages: s.languages,
          rtClients: s.languages.map((lang) => ({
            language: lang,
            connected: s.clients.has(lang),
          })),
          audioChunksSentFromSpeaker: s.audioChunksSent,
          audioChunksFromOpenAI: s.audioChunksFromOpenAI,
        })),
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(payload, null, 2))
      return
    }
    handle(req, res)
  })

  httpServer.listen(port, () => {
    console.log(`> Translation server ready at http://localhost:${port} [${dev ? 'dev' : 'production'}]`)
    console.log(`> Socket.IO ready at /socket.io/`)
  })
})
