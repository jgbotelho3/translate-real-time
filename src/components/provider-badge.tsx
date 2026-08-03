'use client'

import { useAppStore } from '@/stores/app-store'

// Shows which translation engine is active (the speaker's selected provider).
// Purely informational so you can tell Gemini vs OpenAI at a glance.
export function ProviderBadge({ className = '' }: { className?: string }) {
  const provider = useAppStore((s) => s.translationProvider)
  const isGemini = provider === 'gemini'
  const label = isGemini ? 'Gemini' : 'OpenAI'
  return (
    <span
      title={`Motor de tradução ativo: ${label}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold ${
        isGemini
          ? 'border-[#1a73e8]/30 bg-[#1a73e8]/10 text-[#1a73e8]'
          : 'border-[#10a37f]/30 bg-[#10a37f]/10 text-[#0d8c6d]'
      } ${className}`}
    >
      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
        translate
      </span>
      {label}
    </span>
  )
}
