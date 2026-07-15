'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const items = [
  { icon: 'home', label: 'Home', href: '/' },
  { icon: 'mic', label: 'Speak', href: '/speaker' },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed bottom-0 left-0 w-full md:hidden flex justify-around items-center px-4 pb-6 pt-2 bg-white/70 backdrop-blur-xl z-50 rounded-t-3xl shadow-[0_-4px_32px_rgba(0,0,0,0.06)] border-t border-[#005FB8]/10">
      {items.map((item) => {
        const active = pathname === item.href
        return (
        <Link
          key={item.label}
          href={item.href}
          className={`flex flex-col items-center justify-center px-5 py-3 rounded-2xl transition-all active:scale-90 duration-300 ease-out ${
            active
              ? 'bg-gradient-to-br from-[#00488d] to-[#005fb8] text-white'
              : 'text-[#191c21]/60'
          }`}
        >
          <span
            className={`material-symbols-outlined mb-1 ${
              active ? '' : 'text-[#005FB8]'
            }`}
          >
            {item.icon}
          </span>
          <span className="text-[10px] font-medium tracking-wide uppercase">{item.label}</span>
        </Link>
        )
      })}
    </nav>
  )
}
