// Gemini 3.5 Live Translate translator — one Live API session per target language.
//
// Unlike the OpenAI path, this model streams translated speech continuously
// (no VAD / manual commit needed). Source language is auto-detected; we only
// set the target. Input must be PCM16 @ 16kHz; output arrives as PCM16 @ 24kHz.

import { type GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai'
import type { RealtimeTranslator, TranslatorCallbacks } from './types'

const GEMINI_MODEL = 'gemini-3.5-live-translate-preview'
const GEMINI_INPUT_MIME = 'audio/pcm;rate=16000'
const RETRY_MIN_MS = 1000
const RETRY_MAX_MS = 30_000
const MAX_PENDING_CHUNKS = 50 // 100ms chunks → ~5s

export function createGeminiTranslator(
  langCode: string,
  targetLanguageCode: string,
  callbacks: TranslatorCallbacks,
  genai: GoogleGenAI,
): RealtimeTranslator {
  let session: Session | null = null
  let closed = false
  let retryDelay = RETRY_MIN_MS
  // Audio chunks arriving while no connection is open are queued here.
  const pending: string[] = []

  // The Live API closes every connection after ~10 min (announced by a goAway
  // message). Translation is stateless, so we just open a fresh connection:
  // proactively on goAway (old one keeps carrying audio until the new one is
  // ready — no gap), or with backoff on an unexpected close/failure.
  function connect() {
    let own: Session | undefined
    let handedOff = false
    const reconnect = (reason: string, delay: number) => {
      if (handedOff || closed) return
      handedOff = true
      console.warn(`[gemini:${langCode}] reconnecting (${reason}) in ${delay}ms`)
      setTimeout(connect, delay)
      if (delay > 0) retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS)
    }

    genai.live
      .connect({
        model: GEMINI_MODEL,
        callbacks: {
          onmessage: (msg: LiveServerMessage) => {
            if (msg.goAway) reconnect(`goAway, timeLeft=${msg.goAway.timeLeft}`, 0)
            handleMessage(msg)
          },
          onerror: (e) => callbacks.onError?.(e),
          onclose: (e) => {
            if (session === own) session = null
            reconnect(`closed: ${e?.code} ${e?.reason ?? ''}`, retryDelay)
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          translationConfig: { targetLanguageCode, echoTargetLanguage: false },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      })
      .then((s) => {
        own = s
        if (closed) {
          s.close()
          return
        }
        const previous = session
        session = s
        retryDelay = RETRY_MIN_MS
        for (const chunk of pending.splice(0)) {
          s.sendRealtimeInput({ audio: { data: chunk, mimeType: GEMINI_INPUT_MIME } })
        }
        // goAway handoff: retire the old connection now that the new one is live.
        try {
          previous?.close()
        } catch {
          // ignore
        }
      })
      .catch((err) => {
        callbacks.onError?.(err)
        reconnect('connect failed', retryDelay)
      })
  }

  function handleMessage(msg: LiveServerMessage) {
    const sc = msg.serverContent
    if (!sc) return
    for (const part of sc.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data
      if (data) callbacks.onAudioDelta(data)
    }
    if (sc.inputTranscription?.text) callbacks.onInputTranscript(sc.inputTranscription.text)
    if (sc.outputTranscription?.text) callbacks.onOutputTranscript(sc.outputTranscription.text)
  }

  connect()

  return {
    sendAudio: (base64) => {
      if (session) {
        session.sendRealtimeInput({ audio: { data: base64, mimeType: GEMINI_INPUT_MIME } })
      } else if (!closed) {
        pending.push(base64)
        // ponytail: during a long outage keep only the most recent ~5s, so we
        // don't translate stale speech late once the connection is back.
        if (pending.length > MAX_PENDING_CHUNKS) pending.shift()
      }
    },
    close: () => {
      closed = true
      try {
        session?.close()
      } catch {
        // ignore
      }
      session = null
    },
  }
}
