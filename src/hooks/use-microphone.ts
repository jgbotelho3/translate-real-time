'use client'

import { useCallback, useRef, useState } from 'react'
import { float32ToBase64Pcm16 } from '@/lib/audio-utils'

const SAMPLE_RATE = 24000 // Required by OpenAI Realtime API
// createScriptProcessor requires a power-of-two buffer size (256–16384).
// We use 4096 and accumulate samples to emit ~100ms chunks (2400 samples).
const BUFFER_SIZE = 4096 // must be power of two
const CHUNK_SIZE = 2400 // 100ms at 24kHz

interface UseMicrophoneOptions {
  onAudioChunk: (base64: string) => void
  onAnalyserData?: (data: Uint8Array) => void
}

export function useMicrophone({ onAudioChunk, onAnalyserData }: UseMicrophoneOptions) {
  const [isCapturing, setIsCapturing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const sampleBufferRef = useRef<Float32Array>(new Float32Array(0))

  const startCapture = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)

      // Analyser for visualisation
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)

      // ScriptProcessor for PCM16 capture.
      // Note: ScriptProcessorNode is deprecated but widely supported.
      // AudioWorklet would be the modern alternative.
      // Buffer size must be a power of two; we accumulate samples to emit
      // CHUNK_SIZE (100ms) chunks to match what OpenAI Realtime API expects.
      sampleBufferRef.current = new Float32Array(0)
      const processor = audioContext.createScriptProcessor(BUFFER_SIZE, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0) // mono Float32Array
        const prev = sampleBufferRef.current
        const merged = new Float32Array(prev.length + inputData.length)
        merged.set(prev)
        merged.set(inputData, prev.length)

        let offset = 0
        while (offset + CHUNK_SIZE <= merged.length) {
          const chunk = merged.slice(offset, offset + CHUNK_SIZE)
          onAudioChunk(float32ToBase64Pcm16(chunk))
          offset += CHUNK_SIZE
        }
        sampleBufferRef.current = merged.slice(offset)
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      // Drive analyser callbacks
      if (onAnalyserData) {
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(dataArray)
          onAnalyserData(new Uint8Array(dataArray))
          animFrameRef.current = requestAnimationFrame(tick)
        }
        animFrameRef.current = requestAnimationFrame(tick)
      }

      setIsCapturing(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Microphone access denied'
      setError(message)
      console.error('[useMicrophone] error:', err)
    }
  }, [onAudioChunk, onAnalyserData])

  const stopCapture = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    processorRef.current?.disconnect()
    processorRef.current = null
    sampleBufferRef.current = new Float32Array(0)

    analyserRef.current?.disconnect()
    analyserRef.current = null

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    audioContextRef.current?.close()
    audioContextRef.current = null

    setIsCapturing(false)
  }, [])

  return { isCapturing, error, startCapture, stopCapture }
}
