import { Sidebar } from '@/components/sidebar'
import { TopNav } from '@/components/top-nav'
import { StreamCard } from '@/components/stream-card'
import { AudioPlayer } from '@/components/audio-player'
import { AudioVisualizer } from '@/components/audio-visualizer'
import { LiveTranscript } from '@/components/live-transcript'
import { BottomNav } from '@/components/bottom-nav'

const streams = [
  { language: 'Español', listeners: '1.2k', active: true },
  { language: 'Français', listeners: '450', active: false },
  { language: 'Mandarin', listeners: '2.8k', active: false },
]

export default function Home() {
  return (
    <div className="flex min-h-screen bg-[#f9f9ff] text-[#191c21]">
      {/* Sidebar — desktop only */}
      <Sidebar />

      <main className="flex flex-1 flex-col md:ml-64">
        <TopNav />

        {/* Layout unificado: mobile = coluna única, md = 2 colunas */}
        <div className="flex flex-1 flex-col gap-6 px-4 pb-44 pt-4 md:flex-row md:gap-8 md:p-8 md:pb-8">

          {/* Coluna esquerda — streams + player */}
          <section className="flex flex-col gap-4 md:w-80 md:gap-6">

            {/* Session status + language switcher — mobile only */}
            <div className="flex flex-col items-center gap-3 md:hidden">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#90efef]/30 px-4 py-1.5 text-[#006a6a]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#006a6a] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#006a6a]" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest">LIVE SESSION</span>
              </div>

              <div className="flex items-center gap-5 rounded-xl border border-[#c2c6d4]/20 bg-white px-6 py-3 shadow-sm">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-semibold uppercase text-[#424752]">From</span>
                  <span
                    className="text-lg font-bold text-[#00488d]"
                    style={{ fontFamily: 'Manrope, sans-serif' }}
                  >
                    English
                  </span>
                </div>
                <span className="material-symbols-outlined text-[#c2c6d4]">trending_flat</span>
                <div className="flex flex-col items-start">
                  <span className="text-[10px] font-semibold uppercase text-[#424752]">To</span>
                  <span
                    className="text-lg font-bold text-[#00488d]"
                    style={{ fontFamily: 'Manrope, sans-serif' }}
                  >
                    Spanish
                  </span>
                </div>
              </div>
            </div>

            {/* Available Streams */}
            <div>
              <div className="mb-3 flex items-end justify-between">
                <h2
                  className="text-lg font-bold md:text-xl"
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  Available Streams
                </h2>
                <span className="text-xs font-medium text-[#005db5] md:hidden">See all</span>
              </div>

              {/* Mobile: scroll horizontal de cards */}
              <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:hidden">
                {streams.map((s) => (
                  <StreamCard
                    key={s.language}
                    language={s.language}
                    listeners={s.listeners}
                    active={s.active}
                    variant="card"
                  />
                ))}
              </div>

              {/* Desktop: lista vertical */}
              <div className="hidden space-y-3 md:block">
                {streams.map((s) => (
                  <StreamCard key={s.language} language={s.language} active={s.active} variant="list" />
                ))}
              </div>
            </div>

            {/* Audio Visualizer — mobile only */}
            <div className="md:hidden">
              <AudioVisualizer />
            </div>

            {/* Audio Player full — desktop only */}
            <div className="mt-auto hidden md:block">
              <AudioPlayer />
            </div>
          </section>

          {/* Coluna direita — transcript */}
          <div className="flex flex-1 flex-col">
            <LiveTranscript />
          </div>
        </div>
      </main>

      {/* Mini player — mobile only, fixed above bottom nav */}
      <div className="md:hidden">
        <AudioPlayer mini />
      </div>

      {/* Bottom nav — mobile only */}
      <BottomNav />
    </div>
  )
}
