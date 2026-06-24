import { create } from 'zustand'
import type { TranscriptBlock, TranslationStream } from '@/types'

interface AppState {
  // Audio
  volume: number
  setVolume: (volume: number) => void

  // Connection
  isConnected: boolean
  setConnected: (connected: boolean) => void

  // Session
  sessionId: string | null
  sessionMode: 'speaker' | 'listener' | null
  setSessionId: (id: string | null) => void
  setSessionMode: (mode: 'speaker' | 'listener' | null) => void

  // Active language stream
  activeLanguageCode: string
  setActiveLanguageCode: (code: string) => void

  // Available translation streams (populated from server)
  availableStreams: TranslationStream[]
  setAvailableStreams: (streams: TranslationStream[]) => void
  updateStreamListeners: (languageCode: string, delta: number) => void

  // Transcripts
  transcripts: TranscriptBlock[]
  addTranscript: (block: TranscriptBlock) => void
  clearTranscripts: () => void

  // Speaker is broadcasting
  speakerIsLive: boolean
  setSpeakerIsLive: (live: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Audio
  volume: 85,
  setVolume: (v) => set({ volume: v }),

  // Connection
  isConnected: false,
  setConnected: (c) => set({ isConnected: c }),

  // Session
  sessionId: null,
  sessionMode: null,
  setSessionId: (id) => set({ sessionId: id }),
  setSessionMode: (mode) => set({ sessionMode: mode }),

  // Active language
  activeLanguageCode: 'pt',
  setActiveLanguageCode: (code) => set({ activeLanguageCode: code }),

  // Streams
  availableStreams: [],
  setAvailableStreams: (streams) => set({ availableStreams: streams }),
  updateStreamListeners: (languageCode, delta) =>
    set((state) => ({
      availableStreams: state.availableStreams.map((s) =>
        s.languageCode === languageCode ? { ...s, listenerCount: Math.max(0, s.listenerCount + delta) } : s,
      ),
    })),

  // Transcripts
  transcripts: [],
  addTranscript: (block) =>
    set((state) => ({
      transcripts: [...state.transcripts.slice(-99), block],
    })),
  clearTranscripts: () => set({ transcripts: [] }),

  // Speaker live state
  speakerIsLive: false,
  setSpeakerIsLive: (live) => set({ speakerIsLive: live }),
}))
