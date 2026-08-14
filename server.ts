// Load .env.local before anything else — server.ts runs outside Next.js's
// module pipeline so env vars are not automatically available at import time.
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { createServer } from 'http'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'
import { sessionStore } from './src/lib/session-store'
import { createTranslator, getTranslationProvider, type RealtimeTranslator } from './src/lib/translators'
import type {
  SessionJoinPayload,
  ListenerJoinPayload,
  ListenerSelectPayload,
  AudioChunkPayload,
  TranscriptPayload,
  TranslationProvider,
} from './src/types'

const port = parseInt(process.env.PORT || '3000', 10)
const dev = process.env.NODE_ENV !== 'production'

// ─── Provider clients ────────────────────────────────────────────────────────
// OpenAI is always constructed (cheap). Gemini is lazy — only built when the
// active provider is gemini, so openai mode doesn't require GEMINI_API_KEY.
const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

let genaiClient: GoogleGenAI | null = null
function getGenai(): GoogleGenAI {
  if (!genaiClient) genaiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  return genaiClient
}

// ─── In-memory session registry ─────────────────────────────────────────────
// Each session has a map of languageCode → provider-agnostic translator.
interface RealtimeSession {
  sessionId: string
  clients: Map<string, RealtimeTranslator>
  speakerSocketId: string
  languages: string[]
  provider: TranslationProvider
  audioChunksSent: number
  audioChunksFromProvider: Record<string, number>
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

    // Reconnect/restart with the same stable ID: tear down any old translators
    // for this session before recreating them (avoids leaking OpenAI/Gemini WS).
    const existing = sessions.get(sessionId)
    if (existing) {
      console.log(`[speaker] replacing existing session ${sessionId} (${existing.clients.size} translator(s))`)
      for (const [, translator] of existing.clients) {
        try {
          translator.close()
        } catch {
          // ignore
        }
      }
    }

    // Provider is chosen by the speaker in the UI (falls back to env default).
    const provider: TranslationProvider = payload.provider ?? getTranslationProvider()

    // One translator per target language (the "fork").
    const clients = new Map<string, RealtimeTranslator>()

    const session: RealtimeSession = {
      sessionId,
      clients,
      speakerSocketId: socket.id,
      languages: targetLanguages,
      provider,
      audioChunksSent: 0,
      audioChunksFromProvider: {},
    }
    sessions.set(sessionId, session)
    socket.data.sessionId = sessionId

    console.log(`[speaker] translation provider: ${provider}`)

    for (const langCode of targetLanguages) {
      try {
        const translator = createTranslator(
          langCode,
          provider,
          {
            onAudioDelta: (delta) => {
              const chunk: AudioChunkPayload = { languageCode: langCode, pcm16Base64: delta }
              io.of('/listener').to(`session:${sessionId}:${langCode}`).emit('audio:chunk', chunk)
              const count = (session.audioChunksFromProvider[langCode] =
                (session.audioChunksFromProvider[langCode] ?? 0) + 1)
              if (count === 1 || count % 50 === 0) {
                console.log(
                  `[realtime:${langCode}] audio:chunk #${count} → listeners (${Buffer.from(delta, 'base64').length} bytes)`,
                )
              }
            },
            onOutputTranscript: (text) => {
              const transcript: TranscriptPayload = {
                languageCode: langCode,
                original: '',
                translated: text,
                isFinal: true,
              }
              io.of('/listener').to(`session:${sessionId}:${langCode}`).emit('transcript:done', transcript)
            },
            onInputTranscript: (text) => {
              const transcript: TranscriptPayload = {
                languageCode: langCode,
                original: text,
                translated: '',
                isFinal: true,
              }
              io.of('/listener').to(`session:${sessionId}:${langCode}`).emit('transcript:original', transcript)
            },
            onError: (err) => {
              console.error(`[realtime:${langCode}] error:`, err)
            },
          },
          { openaiClient, getGenai },
        )
        clients.set(langCode, translator)
        console.log(`[realtime:${langCode}] translator created`)
      } catch (err) {
        console.error(`[speaker] failed to create translator for ${langCode}:`, err)
      }
    }

    // Emit session status only after all translators are created
    io.of('/listener').to(`session:${sessionId}`).emit('session:status', {
      sessionId,
      isLive: true,
      speakerConnected: true,
      activeLanguages: targetLanguages,
    })
  })

  // Receive audio from speaker and fork to all language translators
  socket.on('speaker:audio', (payload: { pcm16Base64: string }) => {
    const sessionId = socket.data.sessionId as string | undefined
    if (!sessionId) return

    const session = sessions.get(sessionId)
    if (!session) return

    session.audioChunksSent++
    if (session.audioChunksSent === 1 || session.audioChunksSent % 100 === 0) {
      const bytes = Buffer.from(payload.pcm16Base64, 'base64').length
      console.log(
        `[speaker] audio chunk #${session.audioChunksSent} → ${session.clients.size} translator(s) (${bytes} bytes)`,
      )
    }

    for (const [, translator] of session.clients) {
      translator.sendAudio(payload.pcm16Base64)
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
      const hasClient = session.clients.has(languageCode)
      console.log(`[listener] language "${languageCode}" has translator: ${hasClient}`)
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
  for (const [langCode, translator] of session.clients) {
    try {
      translator.close()
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
    // Let Socket.IO's own Engine.IO handler own the /socket.io/ path. This
    // listener is registered after the SocketIOServer, so both fire per request;
    // without this guard, Next would also try to handle the HTTP long-polling
    // requests and corrupt the response — which breaks the connection behind
    // proxies (e.g. Render) that fall back from WebSocket to polling.
    if (req.url?.startsWith('/socket.io/')) return

    // Debug endpoint — inspect in-memory session state without Socket.IO admin UI
    if (req.method === 'GET' && req.url === '/api/debug-session') {
      const payload = {
        defaultProvider: getTranslationProvider(),
        activeSessions: Array.from(sessions.entries()).map(([id, s]) => ({
          sessionId: id,
          speakerSocketId: s.speakerSocketId,
          provider: s.provider,
          languages: s.languages,
          translators: s.languages.map((lang) => ({
            language: lang,
            connected: s.clients.has(lang),
          })),
          audioChunksSentFromSpeaker: s.audioChunksSent,
          audioChunksFromProvider: s.audioChunksFromProvider,
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
