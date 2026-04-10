const bars = [
  { h: 8, accent: false },
  { h: 16, accent: false },
  { h: 32, accent: true },
  { h: 20, accent: false },
  { h: 40, accent: true },
  { h: 24, accent: false },
  { h: 36, accent: true },
  { h: 16, accent: false },
  { h: 28, accent: false },
  { h: 12, accent: false },
]

export function AudioVisualizer() {
  return (
    <section className="flex flex-col items-center py-4 bg-[#f2f3fb] rounded-2xl">
      <div className="flex items-center justify-center gap-1 w-full px-10 h-12">
        {bars.map((bar, i) => (
          <div
            key={i}
            className={`flex-1 rounded-full ${bar.accent ? 'bg-[#006a6a]' : 'bg-[#90efef]'}`}
            style={{ height: `${bar.h}px` }}
          />
        ))}
      </div>
      <p className="text-[10px] text-[#006a6a] font-bold uppercase mt-2 tracking-tighter">
        Processing Neural audio flow
      </p>
    </section>
  )
}
