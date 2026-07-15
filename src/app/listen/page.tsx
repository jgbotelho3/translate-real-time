'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { TopNav } from '@/components/top-nav'
import { StreamCard } from '@/components/stream-card'
import { AudioPlayer } from '@/components/audio-player'
import { AudioVisualizer } from '@/components/audio-visualizer'
import { LiveTranscript } from '@/components/live-transcript'
import { BottomNav } from '@/components/bottom-nav'
import { useSocket } from '@/hooks/use-socket'
import { useAudioPlayer } from '@/hooks/use-audio-player'
import { useAppStore } from '@/stores/app-store'
import { SUPPORTED_LANGUAGES } from '@/lib/languages'
import type { AudioChunkPayload, TranscriptPayload, SessionStatus, TranscriptBlock } from '@/types'

export default function ListenPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading…</div>}>
      <ListenPageContent />
    </Suspense>
  )
}

function ListenPageContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  const {
    volume,
    isConnected,
    setConnected,
    activeLanguageCode,
    setActiveLanguageCode,
    availableStreams,
    setAvailableStreams,
    transcripts,
    addTranscript,
    clearTranscripts,
  } = useAppStore()

  const { socketRef, isConnected: socketConnected } = useSocket('/listener')
  const audioPlayer = useAudioPlayer(volume)
  // Refs so event handlers always see the latest values without being in effect deps
  const audioPlayerRef = useRef(audioPlayer)
  useEffect(() => { audioPlayerRef.current = audioPlayer })
  const activeLanguageCodeRef = useRef(activeLanguageCode)
  useEffect(() => { activeLanguageCodeRef.current = activeLanguageCode }, [activeLanguageCode])
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null)
  const analyserIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync socket connection to store
  useEffect(() => {
    setConnected(socketConnected)
  }, [socketConnected, setConnected])

  // Join session and set up Socket.IO event handlers
  useEffect(() => {
    const socket = socketRef.current
    if (!socket || !sessionId) return

    const handleConnect = () => {
      console.log('[listen] socket connected — emitting listener:join', { sessionId, activeLanguageCode })
      socket.emit('listener:join', { sessionId })

      // Default: select first available language
      console.log('[listen] emitting listener:select-language', { sessionId, languageCode: activeLanguageCode })
      socket.emit('listener:select-language', {
        sessionId,
        languageCode: activeLanguageCode,
      })
    }

    const handleSessionStatus = (status: SessionStatus) => {
      console.log('[listen] session:status received:', status)
      if (status.isLive && status.activeLanguages.length > 0) {
        const streams = status.activeLanguages
          .map((code) => SUPPORTED_LANGUAGES.find((l) => l.code === code))
          .filter(Boolean)
          .map((lang) => ({
            languageCode: lang!.code,
            label: lang!.label,
            flag: lang!.flag,
            listenerCount: 0,
            isActive: lang!.code === activeLanguageCode,
            isLive: true,
          }))
        setAvailableStreams(streams)
      } else if (!status.isLive) {
        setAvailableStreams([])
      }
    }

    let audioChunkCount = 0
    const handleAudioChunk = (payload: AudioChunkPayload) => {
      audioChunkCount++
      const activeLang = activeLanguageCodeRef.current
      if (audioChunkCount === 1 || audioChunkCount % 50 === 0) {
        console.log(`[listen] audio:chunk #${audioChunkCount} received — lang: ${payload.languageCode}, active: ${activeLang}, match: ${payload.languageCode === activeLang}`)
      }
      if (payload.languageCode === activeLang) {
        // Enqueue for seamless playback. If the AudioContext hasn't been unlocked
        // yet (no user gesture), chunks buffer and drain automatically once the
        // listener selects a stream or presses play.
        audioPlayerRef.current.enqueueChunk(payload.pcm16Base64)
      }
    }

    const handleTranscriptDone = (payload: TranscriptPayload) => {
      console.log('[listen] transcript:done received:', { lang: payload.languageCode, translated: payload.translated?.slice(0, 60) })
      const block: TranscriptBlock = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        original: payload.original,
        translated: payload.translated,
        languageCode: payload.languageCode,
        isFinal: payload.isFinal,
      }
      addTranscript(block)
    }

    const handleTranscriptOriginal = (payload: TranscriptPayload) => {
      // Original text arrives separately — update the last transcript block for this language
      addTranscript({
        id: `orig-${Date.now()}`,
        timestamp: Date.now(),
        original: payload.original,
        translated: '',
        languageCode: payload.languageCode,
        isFinal: false,
      })
    }

    if (socket.connected) {
      handleConnect()
    } else {
      socket.once('connect', handleConnect)
    }

    // Debug: log every socket event received
    const handleAnyEvent = (event: string, ...args: unknown[]) => {
      console.log(`[listen] socket event: "${event}"`, args[0] ?? '')
    }
    socket.onAny(handleAnyEvent)

    socket.on('session:status', handleSessionStatus)
    socket.on('audio:chunk', handleAudioChunk)
    socket.on('transcript:done', handleTranscriptDone)
    socket.on('transcript:original', handleTranscriptOriginal)

    return () => {
      socket.offAny(handleAnyEvent)
      socket.off('connect', handleConnect)
      socket.off('session:status', handleSessionStatus)
      socket.off('audio:chunk', handleAudioChunk)
      socket.off('transcript:done', handleTranscriptDone)
      socket.off('transcript:original', handleTranscriptOriginal)
    }
  // audioPlayer and activeLanguageCode are intentionally excluded — accessed via refs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketRef, sessionId, setAvailableStreams, addTranscript])

  // Drive analyser for audio visualizer
  useEffect(() => {
    if (audioPlayer.isPlaying) {
      analyserIntervalRef.current = setInterval(() => {
        const data = audioPlayer.getAnalyserData()
        setAnalyserData(data)
      }, 80)
    } else {
      if (analyserIntervalRef.current) clearInterval(analyserIntervalRef.current)
      setAnalyserData(null)
    }
    return () => {
      if (analyserIntervalRef.current) clearInterval(analyserIntervalRef.current)
    }
  }, [audioPlayer.isPlaying, audioPlayer])

  const handleSelectLanguage = useCallback(
    (code: string) => {
      setActiveLanguageCode(code)
      audioPlayer.reset()
      // Unlock the AudioContext within this click gesture so incoming chunks for
      // the selected stream start playing automatically and continuously.
      audioPlayer.ensureContext()
      setAnalyserData(null)
      clearTranscripts()

      if (sessionId) {
        socketRef.current?.emit('listener:select-language', { sessionId, languageCode: code })
      }
    },
    [setActiveLanguageCode, audioPlayer, clearTranscripts, sessionId, socketRef],
  )

  const handlePlayPause = useCallback(() => {
    audioPlayer.ensureContext()
    if (audioPlayer.isPlaying) {
      audioPlayer.pause()
    } else {
      audioPlayer.resume()
    }
  }, [audioPlayer])

  const activeLanguage = SUPPORTED_LANGUAGES.find((l) => l.code === activeLanguageCode)
  const activeStreamLabel = activeLanguage ? `${activeLanguage.flag} ${activeLanguage.label}` : 'Select a stream'

  const displayStreams =
    availableStreams.length > 0
      ? availableStreams.map((s) => ({
          language: `${s.flag} ${s.label}`,
          listeners: s.listenerCount > 0 ? `${s.listenerCount}` : undefined,
          active: s.languageCode === activeLanguageCode,
          languageCode: s.languageCode,
        }))
      : SUPPORTED_LANGUAGES.slice(0, 3).map((l, i) => ({
          language: `${l.flag} ${l.label}`,
          listeners: undefined,
          active: i === 0,
          languageCode: l.code,
        }))

  const visibleTranscripts = transcripts.filter(
    (t) => t.languageCode === activeLanguageCode && (t.translated || t.original),
  )

  return (
    <div className="flex min-h-screen bg-[#f9f9ff] text-[#191c21]">
      <Sidebar />

      <main className="flex flex-1 flex-col md:ml-64">
        <TopNav />

        <div className="flex flex-1 flex-col gap-6 px-4 pb-44 pt-4 md:flex-row md:gap-8 md:p-8 md:pb-8">
          {/* Left column */}
          <section className="flex flex-col gap-4 md:w-80 md:gap-6">
            {/* Session status — mobile only */}
            <div className="flex flex-col items-center gap-3 md:hidden">
              <div
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 ${
                  isConnected ? 'bg-[#90efef]/30 text-[#006a6a]' : 'bg-[#e7e8f0] text-[#424752]'
                }`}
              >
                <span className="relative flex h-2 w-2">
                  {isConnected && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#006a6a] opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex h-2 w-2 rounded-full ${isConnected ? 'bg-[#006a6a]' : 'bg-[#c2c6d4]'}`}
                  />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {isConnected ? 'LIVE SESSION' : 'WAITING'}
                </span>
              </div>
            </div>

            {/* Available Streams */}
            <div>
              <div className="mb-3 flex items-end justify-between">
                <h2
                  className="text-lg font-bold md:text-xl"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  Available Streams
                </h2>
              </div>

              {/* Mobile: horizontal scroll */}
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:hidden">
                {displayStreams.map((s) => (
                  <StreamCard
                    key={s.languageCode}
                    language={s.language}
                    listeners={s.listeners}
                    active={s.active}
                    variant="card"
                    onClick={() => handleSelectLanguage(s.languageCode)}
                  />
                ))}
              </div>

              {/* Desktop: vertical list */}
              <div className="hidden space-y-3 md:block">
                {displayStreams.map((s) => (
                  <StreamCard
                    key={s.languageCode}
                    language={s.language}
                    active={s.active}
                    variant="list"
                    onClick={() => handleSelectLanguage(s.languageCode)}
                  />
                ))}
              </div>
            </div>

            {/* Audio Visualizer — mobile only */}
            <div className="md:hidden">
              <AudioVisualizer
                frequencies={analyserData ?? undefined}
                label={audioPlayer.isPlaying ? `Playing ${activeLanguage?.label ?? ''}` : 'Waiting for audio…'}
              />
            </div>

            {/* Audio Player — desktop only */}
            <div className="mt-auto hidden md:block">
              <AudioPlayer
                isPlaying={audioPlayer.isPlaying}
                label={`Playing: ${activeLanguage?.label ?? 'Select stream'}`}
                onPlayPause={handlePlayPause}
              />
            </div>
          </section>

          {/* Right column — transcript */}
          <div className="flex flex-1 flex-col">
            <LiveTranscript transcripts={visibleTranscripts} isConnected={isConnected} />
          </div>
        </div>
      </main>

      {/* Mini player — mobile only */}
      <div className="md:hidden">
        <AudioPlayer
          mini
          isPlaying={audioPlayer.isPlaying}
          label={activeStreamLabel}
          onPlayPause={handlePlayPause}
        />
      </div>

      <BottomNav />
    </div>
  )
}
