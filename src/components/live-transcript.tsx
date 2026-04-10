const transcriptBlocks = [
  {
    id: 1,
    time: '09:42:15',
    live: false,
    original:
      'Welcome to the international conference on fluid intelligence and neural networking strategies.',
    translated:
      'Bienvenidos a la conferencia internacional sobre inteligencia fluida y estrategias de redes neuronales.',
  },
  {
    id: 2,
    time: 'LIVE',
    live: true,
    original: 'Today we will explore how real-time translation bridges the gap between...',
    translated: 'Hoy exploraremos cómo la traducción en tiempo real cierra la brecha entre...',
  },
]

export function LiveTranscript() {
  return (
    <section className="flex flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between md:mb-6">
        <h2
          className="text-xl font-bold text-[#191c21]"
          style={{ fontFamily: 'Manrope, sans-serif' }}
        >
          Live Transcript
        </h2>
        <div className="flex items-center gap-2 rounded-full bg-[#90efef]/30 px-3 py-1.5 text-[#006a6a]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#006a6a]" />
          <span className="text-[10px] font-bold">SOCKET CONNECTED</span>
        </div>
      </div>

      {/* Container: mobile = flat list, md = card com overflow e fade */}
      <div className="flex-1 md:relative md:overflow-hidden md:rounded-3xl md:bg-[#f2f3fb] md:p-8">
        <div className="space-y-6 md:max-h-[calc(100vh-280px)] md:space-y-10 md:overflow-y-auto md:pr-4">
          {transcriptBlocks.map((block, i) => (
            <TranscriptBlock key={block.id} block={block} muted={i > 0} />
          ))}

          {/* Visualizer — desktop only */}
          <div className="hidden h-24 w-full items-center justify-center gap-1 py-12 md:flex">
            {[48, 64, 96, 72, 40, 56, 80, 48, 64].map((h, i) => (
              <div
                key={i}
                className={`w-2 rounded-full ${i === 2 || i === 6 ? 'bg-[#006a6a]' : 'bg-[#90efef]'}`}
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        </div>

        {/* Fade gradient — desktop only */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 hidden h-32 bg-gradient-to-t from-[#f2f3fb] to-transparent md:block" />
      </div>
    </section>
  )
}

function TranscriptBlock({
  block,
  muted,
}: {
  block: (typeof transcriptBlocks)[number]
  muted: boolean
}) {
  return (
    <div className={`space-y-3 ${muted ? 'md:opacity-60' : ''}`}>
      <div className="flex items-center gap-2">
        <div
          className={`h-1.5 w-1.5 rounded-full ${block.live ? 'bg-[#006a6a]' : 'bg-[#c2c6d4]'}`}
        />
        <span
          className={`text-[10px] font-bold uppercase tracking-widest ${
            block.live ? 'text-[#006a6a]' : 'text-[#424752]'
          }`}
        >
          {block.time}
        </span>
      </div>

      {/* Original */}
      <div className="rounded-2xl rounded-tl-none bg-[#d6e3ff] p-4 shadow-sm md:p-5">
        <p className="text-sm leading-relaxed text-[#001b3d]">{block.original}</p>
      </div>

      {/* Translation */}
      <div
        className={`ml-6 rounded-2xl rounded-tr-none border-l-4 border-[#006a6a] bg-[#96f0ff] p-4 shadow-sm md:ml-8 md:p-5 ${
          block.live ? 'animate-pulse' : ''
        }`}
      >
        <p className="text-sm font-semibold italic leading-relaxed text-[#001f24]">
          {block.translated}
        </p>
      </div>
    </div>
  )
}
