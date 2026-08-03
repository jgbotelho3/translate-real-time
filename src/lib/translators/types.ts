// Provider-agnostic realtime translator abstraction.
//
// Both the OpenAI Realtime and Gemini Live Translate backends are wrapped behind
// this small interface so server.ts can relay translated audio/transcripts to
// listeners identically, regardless of which provider is active. Select the
// provider with NEXT_PUBLIC_TRANSLATION_PROVIDER (openai | gemini).

export type TranslationProvider = 'openai' | 'gemini'

export interface TranslatorCallbacks {
  /** Translated audio, base64-encoded PCM16 @ 24kHz (both providers output 24kHz). */
  onAudioDelta: (base64Pcm24k: string) => void
  /** Original (source) speech transcript. */
  onInputTranscript: (text: string) => void
  /** Translated text transcript. */
  onOutputTranscript: (text: string) => void
  onError?: (err: unknown) => void
}

export interface RealtimeTranslator {
  /** Feed a base64-encoded PCM16 audio chunk from the speaker. */
  sendAudio: (base64Pcm: string) => void
  /** Tear down the underlying realtime connection. */
  close: () => void
}

export function getTranslationProvider(): TranslationProvider {
  return process.env.NEXT_PUBLIC_TRANSLATION_PROVIDER === 'gemini' ? 'gemini' : 'openai'
}
