'use client'

import { useCallback, useRef, useState } from 'react'
import { useSocket } from '@/hooks/use-socket'
import { useMicrophone } from '@/hooks/use-microphone'
import { useAppStore } from '@/stores/app-store'
import { SUPPORTED_LANGUAGES } from '@/lib/languages'
import type { TranslationStream } from '@/types'

export function useTranslationSession(selectedLanguageCodes: string[], accessCode: string) {
  const [isStreaming, setIsStreaming] = useState(false)
  const [sessionId, setSessionIdLocal] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [micFrequencies, setMicFrequencies] = useState<Uint8Array | null>(null)

  const { socketRef, isConnected } = useSocket('/speaker')

  const { setSessionId, setSessionMode, setSpeakerIsLive, setAvailableStreams, setConnected } = useAppStore()

  const onAudioChunk = useCallback(
    (base64: string) => {
      socketRef.current?.emit('speaker:audio', { pcm16Base64: base64 })
    },
    [socketRef],
  )

  const onAnalyserData = useCallback((data: Uint8Array) => {
    setMicFrequencies(data)
  }, [])

  const { isCapturing, error: micError, startCapture, stopCapture } = useMicrophone({ onAudioChunk, onAnalyserData })

  const startSession = useCallback(async () => {
    setError(null)
    try {
      // 1. Request ephemeral key + session ID from the server
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ languages: selectedLanguageCodes, code: accessCode }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create session')
      }

      const { sessionId: newId } = (await res.json()) as { sessionId: string }

      // 2. Update global store
      setSessionId(newId)
      setSessionMode('speaker')
      setSessionIdLocal(newId)

      // 3. Prepare available streams in store
      const streams: TranslationStream[] = selectedLanguageCodes
        .map((code) => SUPPORTED_LANGUAGES.find((l) => l.code === code))
        .filter(Boolean)
        .map((lang) => ({
          languageCode: lang!.code,
          label: lang!.label,
          flag: lang!.flag,
          listenerCount: 0,
          isActive: true,
          isLive: false,
        }))
      setAvailableStreams(streams)

      // 4. Tell the server to start Realtime sessions (must happen within ~55s of /api/session)
      // Wait for socket to be connected first
      await new Promise<void>((resolve, reject) => {
        const deadline = setTimeout(() => reject(new Error('Socket connection timeout')), 5000)
        const check = setInterval(() => {
          if (socketRef.current?.connected) {
            clearTimeout(deadline)
            clearInterval(check)
            resolve()
          }
        }, 100)
      })

      socketRef.current?.emit('speaker:join', {
        sessionId: newId,
        targetLanguages: selectedLanguageCodes,
      })

      // 5. Start microphone capture
      await startCapture()
      setIsStreaming(true)
      setSpeakerIsLive(true)
      setConnected(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start session'
      setError(message)
      console.error('[useTranslationSession] startSession error:', err)
    }
  }, [
    selectedLanguageCodes,
    accessCode,
    socketRef,
    startCapture,
    setSessionId,
    setSessionMode,
    setSpeakerIsLive,
    setAvailableStreams,
    setConnected,
  ])

  const stopSession = useCallback(() => {
    stopCapture()
    socketRef.current?.emit('speaker:stop')
    setIsStreaming(false)
    setSpeakerIsLive(false)
    setConnected(false)
    setSessionId(null)
    setSessionMode(null)
    setSessionIdLocal(null)
  }, [stopCapture, socketRef, setSpeakerIsLive, setConnected, setSessionId, setSessionMode])

  return {
    sessionId,
    isStreaming,
    isCapturing,
    isConnected,
    error: error ?? micError,
    micFrequencies,
    startSession,
    stopSession,
  }
}
