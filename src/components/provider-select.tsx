'use client'

import { useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import type { TranslationProvider } from '@/types'

const OPTIONS: { value: TranslationProvider; label: string; hint: string }[] = [
  { value: 'gemini', label: 'Google Gemini', hint: 'Live Translate — streaming contínuo' },
  { value: 'openai', label: 'OpenAI Realtime', hint: 'gpt-realtime — commit forçado' },
]

// Dropdown to pick the translation engine before broadcasting.
// Once streaming starts (`disabled`), the choice is locked.
export function ProviderSelect({ disabled = false }: { disabled?: boolean }) {
  const provider = useAppStore((s) => s.translationProvider)
  const setProvider = useAppStore((s) => s.setTranslationProvider)
  const [open, setOpen] = useState(false)
  const current = OPTIONS.find((o) => o.value === provider) ?? OPTIONS[0]

  return (
    <div className="relative">
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-[#424752]">
        Motor de tradução
      </span>
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-56 items-center gap-2 rounded-xl border border-[#c2c6d4]/50 bg-white px-4 py-2.5 text-sm font-semibold text-[#191c21] transition-colors hover:border-[#00488d] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[#c2c6d4]/50"
      >
        <span className="material-symbols-outlined text-base text-[#00488d]">translate</span>
        <span className="flex-1 text-left">{current.label}</span>
        <span className="material-symbols-outlined text-base text-[#424752]">
          {disabled ? 'lock' : open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open && !disabled && (
        <>
          {/* click-outside backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <ul
            role="listbox"
            className="absolute left-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-[#c2c6d4]/40 bg-white py-1 shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
          >
            {OPTIONS.map((o) => {
              const selected = o.value === provider
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setProvider(o.value)
                      setOpen(false)
                    }}
                    className={`flex w-full items-start gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[#ecedf6] ${
                      selected ? 'bg-[#ecedf6]/60' : ''
                    }`}
                  >
                    <span className="material-symbols-outlined mt-0.5 text-base text-[#00488d]">
                      {selected ? 'radio_button_checked' : 'radio_button_unchecked'}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-[#191c21]">{o.label}</span>
                      <span className="block text-[11px] text-[#424752]">{o.hint}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {disabled && (
        <span className="mt-1 block text-[10px] text-[#424752]">
          Bloqueado durante a transmissão
        </span>
      )}
    </div>
  )
}
