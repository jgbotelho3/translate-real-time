'use client'

import { useEffect, useState } from 'react'
import type { TranscriptBlock as TranscriptBlockType } from '@/types'

const MOCK_BLOCKS: TranscriptBlockType[] = [
  {
    id: 'mock-1',
    timestamp: 0,
    original: 'Welcome to the international conference on fluid intelligence and neural networking strategies.',
    translated: 'Bienvenidos a la conferencia internacional sobre inteligencia fluida y estrategias de redes neuronales.',
    languageCode: 'es',
    isFinal: true,
  },
  {
    id: 'mock-2',
    timestamp: 0,
    original: 'Today we will explore how real-time translation bridges the gap between...',
    translated: 'Hoy exploraremos cómo la traducción en tiempo real cierra la brecha entre...',
    languageCode: 'es',
    isFinal: false,
  },
]

interface LiveTranscriptProps {
  transcripts?: TranscriptBlockType[]
  isConnected?: boolean
}

export function LiveTranscript({ transcripts, isConnected = false }: LiveTranscriptProps) {
  const blocks = transcripts && transcripts.length > 0 ? transcripts : MOCK_BLOCKS

  return (
    <section className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between md:mb-6">
        <h2
          className="text-xl font-bold text-[#191c21]"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Live Transcript
        </h2>
        <div
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 ${
            isConnected ? 'bg-[#90efef]/30 text-[#006a6a]' : 'bg-[#e7e8f0] text-[#424752]'
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${isConnected ? 'animate-pulse bg-[#006a6a]' : 'bg-[#c2c6d4]'}`}
          />
          <span className="text-[10px] font-bold">
            {isConnected ? 'SOCKET CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* Container: mobile = flat list, md = card com overflow e fade */}
      <div className="flex-1 md:relative md:overflow-hidden md:rounded-3xl md:bg-[#f2f3fb] md:p-8">
        <div className="space-y-6 md:max-h-[calc(100vh-280px)] md:space-y-10 md:overflow-y-auto md:pr-4">
          {blocks.map((block, i) => (
            <TranscriptBlockItem key={block.id} block={block} muted={i < blocks.length - 2} />
          ))}

          {/* Visualizer — desktop only */}
          <div className="hidden h-24 w-full items-center justify-center gap-1 py-12 md:flex">
            {[48, 64, 96, 72, 40, 56, 80, 48, 64].map((h, i) => (
              <div
                key={i}
                className={`w-2 rounded-full ${i === 2 || i === 6 ? 'bg-[#006a6a]' : 'bg-[#90efef]'}`}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        </div>

        {/* Fade gradient — desktop only */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 hidden h-32 bg-gradient-to-t from-[#f2f3fb] to-transparent md:block" />
      </div>
    </section>
  )
}

function TranscriptBlockItem({ block, muted }: { block: TranscriptBlockType; muted: boolean }) {
  const isLive = !block.isFinal
  // toLocaleTimeString() output differs between server and client locales — render
  // the formatted time only after mount to avoid hydration mismatches.
  const [formattedTime, setFormattedTime] = useState<string | null>(null)
  useEffect(() => {
    if (!isLive && block.timestamp > 0) {
      setFormattedTime(new Date(block.timestamp).toLocaleTimeString())
    }
  }, [isLive, block.timestamp])
  const time = isLive ? 'LIVE' : (formattedTime ?? '—')

  return (
    <div className={`space-y-3 ${muted ? 'md:opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <div className={`h-1.5 w-1.5 rounded-full ${isLive ? 'bg-[#006a6a]' : 'bg-[#c2c6d4]'}`} />
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${
            isLive ? 'text-[#006a6a]' : 'text-[#424752]'
          }`}
        >
          {time}
        </span>
      </div>

      {/* Original */}
      <div className="rounded-2xl rounded-tl-none bg-[#d6e3ff] p-4 shadow-sm md:p-5">
        <p className="text-sm leading-relaxed text-[#001b3d]">{block.original || '…'}</p>
      </div>

      {/* Translation */}
      <div
        className={`ml-6 rounded-2xl rounded-tr-none border-l-4 border-[#006a6a] bg-[#96f0ff] p-4 shadow-sm md:ml-8 md:p-5 ${
          isLive ? 'animate-pulse' : ''
        }`}
      >
        <p className="text-sm font-semibold italic leading-relaxed text-[#001f24]">
          {block.translated || '…'}
        </p>
      </div>
    </div>
  )
}
