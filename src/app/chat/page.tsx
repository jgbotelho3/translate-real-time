'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AudioVisualizer } from '@/components/audio-visualizer'
import { SpeakerAccessGate } from '@/components/speaker-access-gate'
import { ProviderSelect } from '@/components/provider-select'
import { useSocket } from '@/hooks/use-socket'
import { useAudioPlayer } from '@/hooks/use-audio-player'
import { useMicrophone } from '@/hooks/use-microphone'
import { useAppStore } from '@/stores/app-store'
import { SUPPORTED_LANGUAGES } from '@/lib/languages'
import type { AudioChunkPayload, TranslationProvider } from '@/types'

const ACCESS_CODE_STORAGE_KEY = 'speaker-access-code'

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black">Loading…</div>}>
      <ChatPageContent />
    </Suspense>
  )
}

// Private 1-1 conversation. The host (access-code holder) opens /chat and shares
// the link; the guest opens /chat?room=ID. Each picks their own language and
// hears the other translated into it.
function ChatPageContent() {
  const searchParams = useSearchParams()
  const guestRoomId = searchParams.get('room')
  const isHost = !guestRoomId

  const [roomId] = useState(() => guestRoomId ?? crypto.randomUUID())
  const [accessCode, setAccessCode] = useState<string>(() =>
    typeof window !== 'undefined' ? (sessionStorage.getItem(ACCESS_CODE_STORAGE_KEY) ?? '') : '',
  )
  const storeProvider = useAppStore((s) => s.translationProvider)
  // Both sides must feed the room's provider at its input rate, so the guest
  // takes the provider from the host's link.
  const provider: TranslationProvider = isHost
    ? storeProvider
    : searchParams.get('provider') === 'gemini'
      ? 'gemini'
      : 'openai'

  const [language, setLanguage] = useState('pt')
  const [inCall, setInCall] = useState(false)
  const [peers, setPeers] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [analyserData, setAnalyserData] = useState<Uint8Array | null>(null)

  const { socketRef, isConnected } = useSocket('/chat')
  const audioPlayer = useAudioPlayer(100)
  const audioPlayerRef = useRef(audioPlayer)
  useEffect(() => {
    audioPlayerRef.current = audioPlayer
  })

  const onAudioChunk = useCallback(
    (base64: string) => {
      // Half-duplex: don't send mic audio while the translated peer is playing,
      // otherwise the speaker output leaks into the mic and gets re-translated.
      if (audioPlayerRef.current.isPlaying) return
      socketRef.current?.emit('chat:audio', { pcm16Base64: base64 })
    },
    [socketRef],
  )

  const { error: micError, startCapture, stopCapture } = useMicrophone({
    onAudioChunk,
    sampleRate: provider === 'gemini' ? 16000 : 24000,
  })

  useEffect(() => {
    const socket = socketRef.current
    if (!socket) return
    const handleChunk = (p: AudioChunkPayload) => audioPlayerRef.current.enqueueChunk(p.pcm16Base64)
    const handlePeers = (p: { count: number }) => setPeers(p.count)
    const handleError = (p: { message: string }) => {
      setError(p.message)
      setInCall(false)
      stopCapture()
    }
    socket.on('audio:chunk', handleChunk)
    socket.on('chat:peers', handlePeers)
    socket.on('chat:error', handleError)
    return () => {
      socket.off('audio:chunk', handleChunk)
      socket.off('chat:peers', handlePeers)
      socket.off('chat:error', handleError)
    }
  }, [socketRef, isConnected, stopCapture])

  // Host opens the room as soon as the page connects (and again on reconnect),
  // so the guest can join via the link before the host clicks "Entrar".
  useEffect(() => {
    if (isHost && accessCode && isConnected) {
      socketRef.current?.emit('chat:open', { roomId, provider, code: accessCode })
    }
  }, [isHost, accessCode, isConnected, roomId, provider, socketRef])

  // Rejoin after a socket reconnect (server dropped our translator on disconnect).
  useEffect(() => {
    if (inCall && isConnected) {
      socketRef.current?.emit('chat:join', { roomId, language, provider, code: accessCode })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected])

  useEffect(() => {
    if (!audioPlayer.isPlaying) {
      setAnalyserData(null)
      return
    }
    const id = setInterval(() => setAnalyserData(audioPlayer.getAnalyserData()), 80)
    return () => clearInterval(id)
  }, [audioPlayer.isPlaying, audioPlayer])

  const handleJoin = async () => {
    setError(null)
    audioPlayer.ensureContext() // unlock playback within the click gesture (iOS)
    if (!(await startCapture())) return
    setInCall(true)
    socketRef.current?.emit('chat:join', { roomId, language, provider, code: accessCode })
  }

  const handleLeave = () => {
    stopCapture()
    socketRef.current?.emit('chat:leave')
    audioPlayer.reset()
    setInCall(false)
    setPeers(0)
  }

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/chat?room=${roomId}&provider=${provider}` : ''

  if (isHost && !accessCode) {
    return (
      <SpeakerAccessGate
        onUnlock={(code) => {
          sessionStorage.setItem(ACCESS_CODE_STORAGE_KEY, code)
          setAccessCode(code)
        }}
      />
    )
  }

  const status = !inCall
    ? 'Escolha seu idioma e entre na conversa'
    : peers < 2
      ? 'Aguardando o outro participante…'
      : audioPlayer.isPlaying
        ? 'Ouvindo tradução…'
        : 'Conectado — pode falar'

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 bg-black px-6 py-12 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="Beplay Translate" className="absolute left-6 top-6 h-8 w-auto" />

      <p className="text-xs font-bold uppercase tracking-widest text-white/50">Seu idioma</p>
      <div className="-mt-4 flex flex-wrap items-center justify-center gap-3">
        {SUPPORTED_LANGUAGES.map((l) => (
          <button
            key={l.code}
            disabled={inCall}
            onClick={() => setLanguage(l.code)}
            className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all active:scale-95 disabled:cursor-not-allowed ${
              l.code === language
                ? 'bg-[#90efef] text-black'
                : 'border border-white/20 text-white/70 hover:border-white/50 hover:text-white disabled:opacity-40'
            }`}
          >
            {l.flag} {l.label}
          </button>
        ))}
      </div>

      {isHost && !inCall && (
        <div className="rounded-xl bg-white p-3">
          <ProviderSelect />
        </div>
      )}

      <div className="w-full max-w-md">
        <AudioVisualizer dark frequencies={analyserData ?? undefined} label={status} />
      </div>

      {(error || micError) && <p className="text-sm font-medium text-[#ff8a80]">{error ?? micError}</p>}

      <button
        onClick={inCall ? handleLeave : handleJoin}
        disabled={!isConnected}
        className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-all active:scale-95 disabled:opacity-40 ${
          inCall ? 'bg-[#c62828] text-white' : 'bg-[#90efef] text-black'
        }`}
      >
        <span className="material-symbols-outlined text-lg">{inCall ? 'call_end' : 'call'}</span>
        {inCall ? 'Sair da conversa' : 'Entrar na conversa'}
      </button>

      {isHost && (
        <div className="flex w-full max-w-md flex-col items-center gap-2">
          <p className="text-xs text-white/50">Envie este link para o outro participante:</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(shareUrl)
              setCopied(true)
            }}
            className="w-full truncate rounded-xl border border-white/20 px-4 py-2.5 text-xs text-white/80 hover:border-white/50"
          >
            {copied ? 'Link copiado!' : shareUrl}
          </button>
        </div>
      )}

      <p className="text-center text-[11px] text-white/40">Use fones de ouvido para melhor resultado.</p>
    </div>
  )
}
