// OpenAI Realtime translator — one gpt-realtime WebSocket per target language.
//
// Turn detection is disabled; we drive translation with a forced-commit loop
// (commit buffered speech + request a response on a timer) so a long monologue
// is translated in short slices while the speaker is still talking.

import type OpenAI from 'openai'
import { OpenAIRealtimeWS } from 'openai/realtime/ws'
import type { RealtimeTranslator, TranslatorCallbacks } from './types'

const INPUT_SAMPLE_RATE = 24000
const FORCED_COMMIT_INTERVAL_MS = 1200 // how often to flush accumulated speech
const MIN_COMMIT_MS = 300 // don't commit less than this (OpenAI requires ≥100ms)

// Realtime sessions are capped at 60 min and end without warning, so each
// connection is replaced before that. Translation is stateless, so a fresh
// session behaves identically.
const ROTATE_AFTER_MS = 50 * 60 * 1000
const RETIRE_GRACE_MS = 5000 // let the old connection finish its in-flight translation
const RETRY_MIN_MS = 1000
const RETRY_MAX_MS = 30_000
const MAX_PENDING_CHUNKS = 50 // 100ms chunks → ~5s

// The GA Realtime protocol shapes (nested audio.input/output, turn_detection: null,
// manual commit/response) are broader than the SDK's send() parameter types.
// This helper confines the necessary cast to a single place.
function sendRaw(rt: OpenAIRealtimeWS, event: Record<string, unknown>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(rt.send as (e: any) => void)(event)
}

interface Connection {
  rt: OpenAIRealtimeWS
  bufferedMs: number // audio appended since last commit
  isResponding: boolean // a translation response is currently in flight
  flushTimer: ReturnType<typeof setInterval>
  rotateTimer: ReturnType<typeof setTimeout>
}

export function createOpenAITranslator(
  langCode: string,
  voicePrompt: string,
  callbacks: TranslatorCallbacks,
  openaiClient: OpenAI,
): RealtimeTranslator {
  let active: Connection | null = null // the connection receiving audio
  let closed = false
  let retryDelay = RETRY_MIN_MS
  // Audio chunks arriving while no connection is ready are queued here.
  const pending: string[] = []

  function append(c: Connection, base64: string) {
    sendRaw(c.rt, { type: 'input_audio_buffer.append', audio: base64 })
    // PCM16 mono: ms = bytes / 2 samples / rate * 1000
    c.bufferedMs += (Buffer.from(base64, 'base64').length / 2 / INPUT_SAMPLE_RATE) * 1000
  }

  function commit(c: Connection) {
    if (c.isResponding || c.bufferedMs < MIN_COMMIT_MS) return
    try {
      sendRaw(c.rt, { type: 'input_audio_buffer.commit' })
      sendRaw(c.rt, { type: 'response.create' })
      c.isResponding = true
      c.bufferedMs = 0
    } catch {
      // client may have disconnected
    }
  }

  function shutdown(c: Connection) {
    clearInterval(c.flushTimer)
    clearTimeout(c.rotateTimer)
    try {
      c.rt.close({ code: 1000, reason: 'Session ended' })
    } catch {
      // ignore
    }
  }

  // Old connection: translate whatever it still holds, then close it.
  function retire(c: Connection) {
    commit(c)
    setTimeout(() => shutdown(c), RETIRE_GRACE_MS)
  }

  function connect() {
    const rt = new OpenAIRealtimeWS({ model: 'gpt-realtime' }, openaiClient)
    let handedOff = false
    let ready = false
    const reconnect = (reason: string, delay: number) => {
      if (handedOff || closed) return
      handedOff = true
      console.warn(`[openai:${langCode}] reconnecting (${reason}) in ${delay}ms`)
      setTimeout(connect, delay)
      if (delay > 0) retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS)
    }

    const c: Connection = {
      rt,
      bufferedMs: 0,
      isResponding: false,
      flushTimer: setInterval(() => commit(c), FORCED_COMMIT_INTERVAL_MS),
      // Open the replacement early; this one keeps carrying audio until it's ready.
      rotateTimer: setTimeout(() => reconnect('rotation', 0), ROTATE_AFTER_MS),
    }

    rt.on('session.created', () => {
      sendRaw(rt, {
        type: 'session.update',
        session: {
          type: 'realtime',
          output_modalities: ['audio'],
          instructions: voicePrompt,
          audio: {
            input: {
              format: { type: 'audio/pcm', rate: INPUT_SAMPLE_RATE },
              transcription: { model: 'whisper-1' },
              // Manual turn control — the forced-commit loop drives responses.
              turn_detection: null,
            },
            output: {
              format: { type: 'audio/pcm', rate: 24000 },
              voice: 'coral',
            },
          },
        },
      })
    })

    // Configured → make this the active connection.
    rt.on('session.updated', () => {
      if (ready) return
      ready = true
      if (closed) {
        shutdown(c)
        return
      }
      const previous = active
      active = c
      retryDelay = RETRY_MIN_MS
      for (const chunk of pending.splice(0)) append(c, chunk)
      if (previous) retire(previous)
    })

    rt.on('response.created', () => {
      c.isResponding = true
    })
    rt.on('response.done', () => {
      c.isResponding = false
    })

    rt.on('response.output_audio.delta', (event) => {
      callbacks.onAudioDelta(event.delta)
    })
    rt.on('response.output_audio_transcript.done', (event) => {
      callbacks.onOutputTranscript(event.transcript ?? '')
    })
    rt.on('conversation.item.input_audio_transcription.completed', (event) => {
      callbacks.onInputTranscript(event.transcript ?? '')
    })

    rt.on('error', (err) => {
      // Reset so a failed response doesn't deadlock the forced-commit loop.
      c.isResponding = false
      callbacks.onError?.(err)
    })

    rt.socket.on('close', (code, reason) => {
      clearInterval(c.flushTimer)
      clearTimeout(c.rotateTimer)
      if (active === c) active = null
      reconnect(`closed: ${code} ${reason.toString()}`, retryDelay)
    })
  }

  connect()

  return {
    sendAudio: (base64) => {
      if (closed) return
      if (active) {
        try {
          append(active, base64)
        } catch {
          // client may have disconnected
        }
      } else {
        pending.push(base64)
        // ponytail: during a long outage keep only the most recent ~5s, so we
        // don't translate stale speech late once the connection is back.
        if (pending.length > MAX_PENDING_CHUNKS) pending.shift()
      }
    },
    close: () => {
      closed = true
      if (active) shutdown(active)
      active = null
    },
  }
}
