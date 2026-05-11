'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ThemeId } from '@/lib/themes'

const THEME_LOGOS: Record<ThemeId, string> = {
  leaf:      '/assets/naruto.webp',
  shippuden: '/assets/shippuden.webp',
  akatsuki:  '/assets/akatsuki.png',
  sasuke:    '/assets/sasuke.png',
  sakura:    '/assets/sakura.png',
}

const NAV_ITEMS = [
  { href: '/',             label: 'Dashboard',         emoji: '📊' },
  { href: '/episodes',     label: 'Episode Log',        emoji: '📺' },
  { href: '/casefiles',    label: 'Case Files',         emoji: '📁' },
  { href: '/fights',       label: 'Fight Tracker',      emoji: '⚔️' },
  { href: '/rankings',     label: 'Rankings',           emoji: '🏆' },
  { href: '/insights',     label: 'Insights',           emoji: '📈' },
  { href: '/encyclopedia', label: 'Ninja Encyclopedia', emoji: '📖' },
  { href: '/themes',       label: 'Themes & Addons',    emoji: '🎨' },
  { href: '/settings',     label: 'Settings',           emoji: '⚙️' },
]

export default function Sidebar({ profile, streak }: { profile: any; streak: number }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const [currentLogo, setCurrentLogo] = useState('/assets/naruto.webp') // server-safe default

  useEffect(() => {
    // Read from data-theme — set synchronously by the inline script before React loads
    const t = (document.documentElement.getAttribute('data-theme') || 'leaf') as ThemeId
    setCurrentLogo(THEME_LOGOS[t] || THEME_LOGOS.leaf)

    const obs = new MutationObserver(() => {
      const theme = (document.documentElement.getAttribute('data-theme') || 'leaf') as ThemeId
      setCurrentLogo(THEME_LOGOS[theme] || THEME_LOGOS.leaf)
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-[220px] flex-shrink-0 flex flex-col h-full overflow-hidden"
      style={{
        background: 'var(--sidebar)',
        borderRight: '1px solid var(--border)',
        boxShadow: '2px 0 8px rgba(0,0,0,0.3)',
      }}>

      <div className="flex flex-col items-center justify-center px-4 py-4 flex-shrink-0">
        <img src={currentLogo} alt="Naruto Companion" suppressHydrationWarning
          style={{ maxHeight: '48px', width: 'auto', objectFit: 'contain' }} />
        <div className="text-center mt-1">
          <div className="font-display font-bold text-sm" style={{ color: 'white' }}>
            Naruto Companion
          </div>
          <div className="font-eyebrow text-[9px] tracking-widest"
            style={{ color: 'rgba(255,255,255,0.4)' }}>WATCH TRACKER</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <a key={item.href} href={item.href}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer"
              style={{
                background: active ? 'var(--sidebar-active)' : 'transparent',
                color: active ? 'white' : 'var(--sidebar-foreground)',
              }}>
              <span>{item.emoji}</span>
              <span>{item.label}</span>
            </a>
          )
        })}
      </nav>

      <div className="px-3 pb-4 space-y-2 flex-shrink-0">
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="font-eyebrow text-[9px] mb-1"
            style={{ color: 'rgba(255,255,255,0.4)' }}>WILL OF FIRE</div>
          <div className="text-sm font-bold" style={{ color: 'white' }}>{streak} day streak 🔥</div>
        </div>
        <button onClick={signOut}
          className="w-full text-xs py-2 rounded-xl transition-colors hover:bg-white/10"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          Sign Out
        </button>
      </div>
    </aside>
  )
}
