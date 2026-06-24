'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { base64Pcm16ToFloat32 } from '@/lib/audio-utils'

const SAMPLE_RATE = 24000 // Must match OpenAI Realtime API output
const PRE_BUFFER_DURATION = 0.2 // 200ms jitter buffer before playback starts

export function useAudioPlayer(volume: number) {
  const [isPlaying, setIsPlaying] = useState(false)

  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const nextStartTimeRef = useRef<number>(0)
  const bufferedDurationRef = useRef<number>(0)
  const isStartedRef = useRef(false)

  // Chunks received while AudioContext is suspended are held here and
  // replayed once the context resumes (user gesture).
  const pendingChunksRef = useRef<string[]>([])

  const scheduleChunk = useCallback((ctx: AudioContext, base64: string) => {
    const float32 = base64Pcm16ToFloat32(base64)

    const audioBuffer = ctx.createBuffer(1, float32.length, SAMPLE_RATE)
    audioBuffer.getChannelData(0).set(float32)

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(gainNodeRef.current!)

    const chunkDuration = float32.length / SAMPLE_RATE

    if (!isStartedRef.current) {
      bufferedDurationRef.current += chunkDuration
      if (bufferedDurationRef.current >= PRE_BUFFER_DURATION) {
        nextStartTimeRef.current = ctx.currentTime + 0.01
        isStartedRef.current = true
        setIsPlaying(true)
      } else {
        // Still accumulating pre-buffer — discard, will be replaced by next chunks
        return
      }
    }

    source.start(nextStartTimeRef.current)
    nextStartTimeRef.current += chunkDuration

    source.onended = () => {
      if (nextStartTimeRef.current <= ctx.currentTime + 0.05) {
        setIsPlaying(false)
        isStartedRef.current = false
        bufferedDurationRef.current = 0
      }
    }
  }, [])

  // Lazy-init AudioContext. If suspended (browser autoplay policy), resumes it
  // and drains any chunks that arrived during suspension.
  const ensureContext = useCallback(() => {
    if (!audioContextRef.current) {
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      const gain = ctx.createGain()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256

      gain.connect(analyser)
      analyser.connect(ctx.destination)

      audioContextRef.current = ctx
      gainNodeRef.current = gain
      analyserRef.current = analyser
    }

    const ctx = audioContextRef.current
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        // Drain chunks that arrived during suspension
        if (pendingChunksRef.current.length > 0) {
          // Reset playback state so chunks are scheduled from ctx.currentTime, not the past
          nextStartTimeRef.current = 0
          isStartedRef.current = false
          bufferedDurationRef.current = 0
          const pending = pendingChunksRef.current.splice(0)
          for (const chunk of pending) {
            scheduleChunk(ctx, chunk)
          }
        }
      })
    }
    return ctx
  }, [scheduleChunk])

  // Sync volume → GainNode whenever it changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(volume / 100, gainNodeRef.current.context.currentTime, 0.01)
    }
  }, [volume])

  /**
   * Enqueue a base64-encoded PCM16 audio chunk for seamless sequential playback.
   * If the AudioContext is suspended (browser autoplay policy), chunks are buffered
   * and played automatically once ensureContext() is called (e.g. on user click).
   */
  const enqueueChunk = useCallback(
    (base64: string) => {
      const ctx = ensureContext()

      if (ctx.state === 'suspended') {
        // Browser blocked autoplay — hold the chunk until user interaction resumes context
        pendingChunksRef.current.push(base64)
        return
      }

      // Drain any chunks that arrived while suspended
      if (pendingChunksRef.current.length > 0) {
        const pending = pendingChunksRef.current.splice(0)
        for (const chunk of pending) {
          scheduleChunk(ctx, chunk)
        }
      }

      scheduleChunk(ctx, base64)
    },
    [ensureContext, scheduleChunk],
  )

  const pause = useCallback(() => {
    audioContextRef.current?.suspend()
    setIsPlaying(false)
  }, [])

  const resume = useCallback(() => {
    ensureContext()
    setIsPlaying(true)
  }, [ensureContext])

  const reset = useCallback(() => {
    nextStartTimeRef.current = 0
    bufferedDurationRef.current = 0
    isStartedRef.current = false
    pendingChunksRef.current = []
    setIsPlaying(false)
  }, [])

  const getAnalyserData = useCallback((): Uint8Array | null => {
    if (!analyserRef.current) return null
    const data = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(data)
    return data
  }, [])

  useEffect(() => {
    return () => {
      audioContextRef.current?.close()
    }
  }, [])

  return { isPlaying, enqueueChunk, pause, resume, reset, getAnalyserData, ensureContext }
}
