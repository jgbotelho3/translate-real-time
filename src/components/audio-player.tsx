'use client'

import { useState } from 'react'
import { useAppStore } from '@/stores/app-store'

interface AudioPlayerProps {
  mini?: boolean
}

export function AudioPlayer({ mini = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(true)
  const volume = useAppStore((s) => s.volume)

  if (mini) {
    return (
      <div className="fixed bottom-[76px] left-4 right-4 z-40">
        <div className="flex items-center gap-3 rounded-2xl border border-[#c2c6d4]/20 bg-white/90 p-3 shadow-[0_8px_32px_rgba(0,0,0,0.10)] backdrop-blur-md">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#00488d] text-white">
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              graphic_eq
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p
                className="truncate text-sm font-bold text-[#00488d]"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Spanish Audio Stream
              </p>
              <span className="flex-shrink-0 text-[10px] font-bold text-[#424752]">{volume}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e7e8f0]">
              <div
                className="h-full rounded-full bg-[#00488d]"
                style={{ width: `${volume}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#00488d] text-white transition-transform active:scale-95"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-[#00488d] p-6 text-white shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest opacity-70">
          Playing: Spanish
        </span>
        <span className="material-symbols-outlined text-[#93f2f2]">podcasts</span>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-center gap-6">
          <button className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10">
            <span className="material-symbols-outlined">fast_rewind</span>
          </button>

          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#00488d] transition-transform active:scale-95"
          >
            <span
              className="material-symbols-outlined text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>

          <button className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/10">
            <span className="material-symbols-outlined">fast_forward</span>
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold opacity-70">
            <span>VOLUME</span>
            <span>{volume}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-[#93f2f2]" style={{ width: `${volume}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
