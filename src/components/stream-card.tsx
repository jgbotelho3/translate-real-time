'use client'

interface StreamCardProps {
  language: string
  listeners?: string
  active?: boolean
  variant?: 'list' | 'card'
}

export function StreamCard({ language, listeners, active = false, variant = 'list' }: StreamCardProps) {
  if (variant === 'card') {
    if (active) {
      return (
        <div className="flex-shrink-0 w-36 p-4 rounded-xl bg-gradient-to-br from-[#00488d] to-[#005fb8] text-white shadow-lg cursor-pointer active:scale-95 transition-transform">
          <div className="flex justify-between items-start mb-6">
            <span
              className="material-symbols-outlined text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              pause_circle
            </span>
            <span className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-bold uppercase">
              Active
            </span>
          </div>
          <p className="font-bold text-lg leading-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {language}
          </p>
          {listeners && (
            <p className="text-white/70 text-xs mt-1">{listeners} Listeners</p>
          )}
        </div>
      )
    }
    return (
      <div className="flex-shrink-0 w-36 p-4 rounded-xl bg-[#ecedf6] text-[#191c21] cursor-pointer active:scale-95 transition-transform">
        <div className="flex justify-between items-start mb-6">
          <span className="material-symbols-outlined text-3xl text-[#005fb8]">play_circle</span>
        </div>
        <p className="font-bold text-lg leading-tight" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {language}
        </p>
        {listeners && (
          <p className="text-[#424752] text-xs mt-1">{listeners} Listeners</p>
        )}
      </div>
    )
  }

  // List variant (desktop sidebar)
  if (active) {
    return (
      <div className="active-glow flex cursor-pointer items-center justify-between rounded-xl border-2 border-[#00488d] bg-white p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#90efef] text-[#006e6e]">
            <span className="material-symbols-outlined">translate</span>
          </div>
          <div>
            <p className="font-bold text-[#191c21]">{language}</p>
            <p className="text-xs font-medium text-[#006a6a]">Streaming Now</p>
          </div>
        </div>
        <span
          className="material-symbols-outlined text-[#006a6a]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          graphic_eq
        </span>
      </div>
    )
  }

  return (
    <div className="flex cursor-pointer items-center justify-between rounded-xl bg-[#f2f3fb] p-4 transition-colors hover:bg-[#ecedf6]">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e1e2ea] text-[#424752]">
          <span className="material-symbols-outlined">translate</span>
        </div>
        <div>
          <p className="font-bold text-[#191c21]">{language}</p>
          <p className="text-xs text-[#424752]">Ready to join</p>
        </div>
      </div>
      <span className="material-symbols-outlined text-[#c2c6d4]">play_circle</span>
    </div>
  )
}
