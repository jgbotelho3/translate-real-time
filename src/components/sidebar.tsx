'use client'

import Link from 'next/link'

const navItems = [
  { icon: 'mic', label: 'Speaker Mode', href: '#', active: false },
  { icon: 'hearing', label: 'Listener Mode', href: '#', active: true },
  { icon: 'history', label: 'History', href: '#', active: false },
  { icon: 'book', label: 'Library', href: '#', active: false },
]

const bottomItems = [
  { icon: 'help', label: 'Help', href: '#' },
  { icon: 'logout', label: 'Logout', href: '#' },
]

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 hidden h-full w-64 flex-col bg-[#ecedf6] p-4 text-sm md:flex">
      <div className="mb-8 px-3">
        <h1 className="text-xl font-bold tracking-tight text-[#00488d]" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Beplay Translate
        </h1>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={
              item.active
                ? 'flex items-center gap-3 rounded-lg bg-white p-3 font-bold text-[#005FB8] transition-all'
                : 'flex items-center gap-3 rounded-lg p-3 text-slate-600 transition-all hover:bg-white/50'
            }
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-1 border-t border-[#c2c6d4]/20 pt-4">
        <div className="mb-4 rounded-xl bg-[#005fb8] p-4 text-[#cadcff]">
          <p className="mb-2 text-xs font-bold">Upgrade to Pro</p>
          <p className="text-[10px] opacity-80">Unlimited translations and high-fidelity audio.</p>
        </div>

        {bottomItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center gap-3 rounded-lg p-3 text-slate-600 transition-all hover:bg-white/50"
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </aside>
  )
}
