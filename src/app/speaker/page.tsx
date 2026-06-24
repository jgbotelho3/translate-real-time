'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/sidebar'
import { TopNav } from '@/components/top-nav'
import { AudioVisualizer } from '@/components/audio-visualizer'
import { BottomNav } from '@/components/bottom-nav'
import { useTranslationSession } from '@/hooks/use-translation-session'
import { SUPPORTED_LANGUAGES } from '@/lib/languages'

export default function SpeakerPage() {
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['pt', 'en', 'es'])

  const { sessionId, isStreaming, isCapturing, isConnected, error, micFrequencies, startSession, stopSession } =
    useTranslationSession(selectedLanguages)

  const listenerUrl = sessionId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/listen?session=${sessionId}` : null

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )
  }

  return (
    <div className="flex min-h-screen bg-[#f9f9ff] text-[#191c21]">
      <Sidebar />

      <main className="flex flex-1 flex-col md:ml-64">
        <TopNav />

        <div className="flex flex-1 flex-col gap-6 px-4 pb-44 pt-4 md:gap-8 md:p-8 md:pb-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-2xl font-bold text-[#00488d]"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Speaker Mode
              </h1>
              <p className="mt-1 text-sm text-[#424752]">
                Speak and broadcast simultaneously to multiple languages
              </p>
            </div>
            {isStreaming && (
              <div className="flex items-center gap-2 rounded-full bg-[#90efef]/30 px-4 py-2 text-[#006a6a]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#006a6a] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#006a6a]" />
                </span>
                <span className="text-xs font-bold uppercase tracking-widest">LIVE</span>
              </div>
            )}
          </div>

          {/* Language selector */}
          <div>
            <h2
              className="mb-3 text-base font-bold"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Target Languages
            </h2>
            <div className="flex flex-wrap gap-3">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const selected = selectedLanguages.includes(lang.code)
                return (
                  <button
                    key={lang.code}
                    onClick={() => !isStreaming && toggleLanguage(lang.code)}
                    disabled={isStreaming}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
                      selected
                        ? 'bg-[#00488d] text-white shadow-md'
                        : 'bg-[#ecedf6] text-[#424752] hover:bg-[#e1e2ea]'
                    } ${isStreaming ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span>{lang.label}</span>
                    {selected && (
                      <span className="material-symbols-outlined text-sm text-[#90efef]">check</span>
                    )}
                  </button>
                )
              })}
            </div>
            {selectedLanguages.length === 0 && (
              <p className="mt-2 text-xs text-[#e53935]">Select at least one language</p>
            )}
          </div>

          {/* Microphone visualizer */}
          <div>
            <h2
              className="mb-3 text-base font-bold"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Microphone
            </h2>
            <AudioVisualizer
              frequencies={micFrequencies ?? undefined}
              label={
                isCapturing
                  ? 'Capturing microphone audio…'
                  : isStreaming
                    ? 'Mic inactive'
                    : 'Press Start to begin'
              }
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-[#ffebee] px-4 py-3 text-sm text-[#c62828]">
              <span className="font-bold">Error: </span>
              {error}
            </div>
          )}

          {/* Start / Stop button */}
          <div className="flex flex-col items-center gap-4">
            {!isStreaming ? (
              <button
                onClick={startSession}
                disabled={selectedLanguages.length === 0}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-[#00488d] text-white shadow-xl transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#005fb8]"
              >
                <span
                  className="material-symbols-outlined text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  mic
                </span>
              </button>
            ) : (
              <button
                onClick={stopSession}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-[#c62828] text-white shadow-xl transition-all active:scale-95 hover:bg-[#b71c1c]"
              >
                <span
                  className="material-symbols-outlined text-4xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  stop
                </span>
              </button>
            )}
            <p className="text-xs text-[#424752]">
              {!isStreaming ? 'Tap to start broadcasting' : 'Tap to stop broadcasting'}
            </p>
          </div>

          {/* Shareable listener URL */}
          {listenerUrl && (
            <div className="rounded-2xl border border-[#c2c6d4]/30 bg-white p-6 shadow-sm">
              <h2
                className="mb-2 text-base font-bold text-[#00488d]"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Share with Listeners
              </h2>
              <p className="mb-3 text-xs text-[#424752]">
                Share this link so others can join and listen to the translation:
              </p>
              <div className="flex items-center gap-2 rounded-xl bg-[#ecedf6] px-4 py-3">
                <span className="material-symbols-outlined text-[#005fb8]">link</span>
                <code className="flex-1 truncate text-xs text-[#191c21]">{listenerUrl}</code>
                <button
                  onClick={() => navigator.clipboard.writeText(listenerUrl)}
                  className="rounded-lg bg-[#00488d] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#005fb8] active:scale-95"
                >
                  Copy
                </button>
              </div>
              <p className="mt-3 text-xs font-medium text-[#006a6a]">
                Broadcasting to:{' '}
                {selectedLanguages
                  .map((c) => SUPPORTED_LANGUAGES.find((l) => l.code === c)?.label)
                  .filter(Boolean)
                  .join(', ')}
              </p>
            </div>
          )}

          {/* Connection status */}
          <div className="flex items-center gap-2 text-xs text-[#424752]">
            <span
              className={`h-2 w-2 rounded-full ${isConnected ? 'bg-[#006a6a]' : 'bg-[#c2c6d4]'}`}
            />
            {isConnected ? 'Connected to relay server' : 'Connecting to relay server…'}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
