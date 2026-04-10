import { create } from 'zustand'

interface AppState {
  volume: number
  activeStream: string
  isConnected: boolean
  setVolume: (volume: number) => void
  setActiveStream: (stream: string) => void
  setConnected: (connected: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  volume: 85,
  activeStream: 'Español',
  isConnected: true,
  setVolume: (v) => set({ volume: v }),
  setActiveStream: (s) => set({ activeStream: s }),
  setConnected: (c) => set({ isConnected: c }),
}))
