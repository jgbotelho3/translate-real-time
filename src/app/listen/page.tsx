'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AudioVisualizer } from '@/components/audio-visualizer'
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
    setConnected,
    activeLanguageCode,
    setActiveLanguageCode,
    availableStreams,
    setAvailableStreams,
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

  const displayStreams =
    availableStreams.length > 0
      ? availableStreams.map((s) => ({
          language: `${s.flag} ${s.label}`,
          active: s.languageCode === activeLanguageCode,
          languageCode: s.languageCode,
        }))
      : SUPPORTED_LANGUAGES.slice(0, 3).map((l, i) => ({
          language: `${l.flag} ${l.label}`,
          active: i === 0,
          languageCode: l.code,
        }))

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-black px-6 py-12 text-white">
      {/* Language options */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {displayStreams.map((s) => (
          <button
            key={s.languageCode}
            onClick={() => handleSelectLanguage(s.languageCode)}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
              s.active
                ? 'bg-[#90efef] text-black'
                : 'border border-white/20 text-white/70 hover:border-white/50 hover:text-white'
            }`}
          >
            {s.language}
          </button>
        ))}
      </div>

      {/* Wave — signals that audio is being received */}
      <div className="w-full max-w-md">
        <AudioVisualizer
          dark
          frequencies={analyserData ?? undefined}
          label={audioPlayer.isPlaying ? (activeLanguage?.label ?? '') : 'aguardando áudio…'}
        />
      </div>

      {/* Play / pause */}
      <button
        onClick={handlePlayPause}
        aria-label={audioPlayer.isPlaying ? 'Pausar' : 'Tocar'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-white transition-all active:scale-95 hover:bg-white/20"
      >
        <span
          className="material-symbols-outlined text-3xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {audioPlayer.isPlaying ? 'pause' : 'play_arrow'}
        </span>
      </button>
    </div>
  )
}
