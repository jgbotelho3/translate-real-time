import Link from 'next/link'
import { Sidebar } from '@/components/sidebar'
import { TopNav } from '@/components/top-nav'
import { BottomNav } from '@/components/bottom-nav'

export default function HomePage() {
  return (
    <div className="flex min-h-screen bg-[#f9f9ff] text-[#191c21]">
      <Sidebar />

      <main className="flex flex-1 flex-col md:ml-64">
        <TopNav showSessionInfo={false} showConnectivityIcons={false} />

        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-44 pt-10 text-center md:p-8">
          <span
            className="material-symbols-outlined text-6xl text-[#00488d]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            translate
          </span>

          <div className="max-w-xl">
            <h1
              className="text-3xl font-bold text-[#00488d] md:text-4xl"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Bem-vindo ao Beplay Translate
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-[#424752] md:text-base">
              Tradução simultânea em tempo real. O palestrante fala em um idioma e cada
              ouvinte acompanha, ao vivo, no idioma que escolher — com áudio traduzido e
              transcrição contínua, sem instalar nada.
            </p>
          </div>

          <Link
            href="/speaker"
            className="mt-2 flex items-center gap-2 rounded-xl bg-[#00488d] px-6 py-3 text-sm font-bold text-white shadow-md transition-all active:scale-95 hover:bg-[#005fb8]"
          >
            <span className="material-symbols-outlined text-lg">mic</span>
            Iniciar transmissão
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
