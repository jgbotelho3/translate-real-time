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

// The GA Realtime protocol shapes (nested audio.input/output, turn_detection: null,
// manual commit/response) are broader than the SDK's send() parameter types.
// This helper confines the necessary cast to a single place.
function sendRaw(rt: OpenAIRealtimeWS, event: Record<string, unknown>): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(rt.send as (e: any) => void)(event)
}

export function createOpenAITranslator(
  langCode: string,
  voicePrompt: string,
  callbacks: TranslatorCallbacks,
  openaiClient: OpenAI,
): RealtimeTranslator {
  const rt = new OpenAIRealtimeWS({ model: 'gpt-realtime' }, openaiClient)

  let bufferedMs = 0 // audio appended since last commit
  let isResponding = false // a translation response is currently in flight

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

  rt.on('response.created', () => {
    isResponding = true
  })
  rt.on('response.done', () => {
    isResponding = false
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
    isResponding = false
    callbacks.onError?.(err)
  })

  const flushTimer = setInterval(() => {
    if (isResponding || bufferedMs < MIN_COMMIT_MS) return
    try {
      sendRaw(rt, { type: 'input_audio_buffer.commit' })
      sendRaw(rt, { type: 'response.create' })
      isResponding = true
      bufferedMs = 0
    } catch {
      // client may have disconnected
    }
  }, FORCED_COMMIT_INTERVAL_MS)

  return {
    sendAudio: (base64) => {
      try {
        sendRaw(rt, { type: 'input_audio_buffer.append', audio: base64 })
        // PCM16 mono: ms = bytes / 2 samples / rate * 1000
        const bytes = Buffer.from(base64, 'base64').length
        bufferedMs += (bytes / 2 / INPUT_SAMPLE_RATE) * 1000
      } catch {
        // client may have disconnected
      }
    },
    close: () => {
      clearInterval(flushTimer)
      try {
        rt.close({ code: 1000, reason: 'Session ended' })
      } catch {
        // ignore
      }
    },
  }
}
