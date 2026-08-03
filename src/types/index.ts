export interface Language {
  code: string
  label: string
  flag: string
  voicePrompt: string
}

export interface TranscriptBlock {
  id: string
  timestamp: number
  original: string
  translated: string
  languageCode: string
  isFinal: boolean
}

export interface TranslationStream {
  languageCode: string
  label: string
  flag: string
  listenerCount: number
  isActive: boolean
  isLive: boolean
}

// Socket.IO event payloads
export interface AudioChunkPayload {
  languageCode: string
  pcm16Base64: string
}

export interface TranscriptPayload {
  languageCode: string
  original: string
  translated: string
  isFinal: boolean
}

export interface SessionStatus {
  sessionId: string
  isLive: boolean
  speakerConnected: boolean
  activeLanguages: string[]
}

export type TranslationProvider = 'openai' | 'gemini'

export interface SessionJoinPayload {
  sessionId: string
  targetLanguages: string[]
  provider?: TranslationProvider
}

export interface ListenerJoinPayload {
  sessionId: string
}

export interface ListenerSelectPayload {
  sessionId: string
  languageCode: string
}
