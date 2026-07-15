'use client'

import { useState } from 'react'

interface SpeakerAccessGateProps {
  onUnlock: (code: string) => void
}

export function SpeakerAccessGate({ onUnlock }: SpeakerAccessGateProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || verifying) return

    setVerifying(true)
    setError(null)
    try {
      const res = await fetch('/api/verify-speaker-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = (await res.json()) as { ok?: boolean }
      if (res.ok && data.ok) {
        onUnlock(code)
      } else {
        setError('Código incorreto. Tente novamente.')
      }
    } catch {
      setError('Não foi possível verificar o código. Tente novamente.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f9f9ff] px-4 text-[#191c21]">
      <div className="w-full max-w-sm rounded-2xl border border-[#c2c6d4]/30 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span
            className="material-symbols-outlined text-5xl text-[#00488d]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            lock
          </span>
          <h1
            className="text-xl font-bold text-[#00488d]"
            style={{ fontFamily: 'Manrope, sans-serif' }}
          >
            Speaker Mode
          </h1>
          <p className="text-sm text-[#424752]">
            Digite o código de acesso para transmitir.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Código de acesso"
            autoFocus
            className="w-full rounded-xl border border-[#c2c6d4]/50 bg-[#f9f9ff] px-4 py-3 text-sm outline-none transition-colors focus:border-[#00488d]"
          />

          {error && <p className="text-xs font-medium text-[#c62828]">{error}</p>}

          <button
            type="submit"
            disabled={!code.trim() || verifying}
            className="flex items-center justify-center rounded-xl bg-[#00488d] px-4 py-3 text-sm font-bold text-white transition-all active:scale-95 hover:bg-[#005fb8] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {verifying ? 'Verificando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
