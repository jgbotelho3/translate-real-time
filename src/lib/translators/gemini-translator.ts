// Gemini 3.5 Live Translate translator — one Live API session per target language.
//
// Unlike the OpenAI path, this model streams translated speech continuously
// (no VAD / manual commit needed). Source language is auto-detected; we only
// set the target. Input must be PCM16 @ 16kHz; output arrives as PCM16 @ 24kHz.

import { type GoogleGenAI, Modality, type Session, type LiveServerMessage } from '@google/genai'
import type { RealtimeTranslator, TranslatorCallbacks } from './types'

const GEMINI_MODEL = 'gemini-3.5-live-translate-preview'
const GEMINI_INPUT_MIME = 'audio/pcm;rate=16000'

export function createGeminiTranslator(
  langCode: string,
  targetLanguageCode: string,
  callbacks: TranslatorCallbacks,
  genai: GoogleGenAI,
): RealtimeTranslator {
  let session: Session | null = null
  let closed = false
  // Audio chunks arriving before the async connect resolves are queued here.
  const pending: string[] = []

  genai.live
    .connect({
      model: GEMINI_MODEL,
      callbacks: {
        onmessage: (msg: LiveServerMessage) => {
          const sc = msg.serverContent
          if (!sc) return
          for (const part of sc.modelTurn?.parts ?? []) {
            const data = part.inlineData?.data
            if (data) callbacks.onAudioDelta(data)
          }
          if (sc.inputTranscription?.text) callbacks.onInputTranscript(sc.inputTranscription.text)
          if (sc.outputTranscription?.text) callbacks.onOutputTranscript(sc.outputTranscription.text)
        },
        onerror: (e) => callbacks.onError?.(e),
        onclose: () => {},
      },
      config: {
        responseModalities: [Modality.AUDIO],
        translationConfig: { targetLanguageCode, echoTargetLanguage: false },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
      },
    })
    .then((s) => {
      if (closed) {
        s.close()
        return
      }
      session = s
      for (const chunk of pending.splice(0)) {
        s.sendRealtimeInput({ audio: { data: chunk, mimeType: GEMINI_INPUT_MIME } })
      }
    })
    .catch((err) => callbacks.onError?.(err))

  return {
    sendAudio: (base64) => {
      if (session) {
        session.sendRealtimeInput({ audio: { data: base64, mimeType: GEMINI_INPUT_MIME } })
      } else if (!closed) {
        pending.push(base64)
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
