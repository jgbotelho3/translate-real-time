export function TopNav() {
  return (
    <header className="sticky top-0 z-40 flex w-full items-center justify-between border-b border-transparent bg-[#f9f9ff]/90 px-4 py-3 backdrop-blur-sm md:px-8 md:py-4">
      {/* Mobile: brand logo */}
      <div className="flex items-center gap-2 md:hidden">
        <span className="material-symbols-outlined text-[#005FB8]">language</span>
        <h1
          className="text-lg font-bold text-[#00488d]"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Fluid Intelligence
        </h1>
      </div>

      {/* Desktop: session info */}
      <div className="hidden items-center gap-4 md:flex">
        <span
          className="material-symbols-outlined text-[#006a6a]"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          sensors
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-medium uppercase tracking-wide text-[#424752]">
            LIVE SESSION
          </span>
          <span className="text-sm font-bold" style={{ fontFamily: 'Manrope, sans-serif' }}>
            English to Spanish
          </span>
        </div>
      </div>

      {/* Right: icons + avatar */}
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-3 text-slate-500 md:flex">
          <span className="material-symbols-outlined cursor-pointer transition-colors hover:text-[#005FB8]">
            wifi_tethering
          </span>
          <span className="material-symbols-outlined cursor-pointer transition-colors hover:text-[#005FB8]">
            volume_up
          </span>
          <span className="material-symbols-outlined cursor-pointer transition-colors hover:text-[#005FB8]">
            settings
          </span>
        </div>
        <div className="h-10 w-10 rounded-full bg-[#e1e2ea]" />
      </div>
    </header>
  )
}
