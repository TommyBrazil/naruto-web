'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

const PRIMARY_TABS = [
  { href: '/',          label: 'Home',     icon: '🏠', isMore: false },
  { href: '/episodes',  label: 'Episodes', icon: '📺', isMore: false },
  { href: '/casefiles', label: 'Files',    icon: '🗂️', isMore: false },
  { href: '/fights',    label: 'Fights',   icon: '⚔️', isMore: false },
  { href: '/more',      label: 'More',     icon: '☰',  isMore: true  },
]

const MORE_ITEMS = [
  { href: '/rankings',     label: 'Rankings',        icon: '🏆' },
  { href: '/insights',     label: 'Insights',        icon: '📊' },
  { href: '/encyclopedia', label: 'Encyclopedia',    icon: '📖' },
  { href: '/themes',       label: 'Themes & Addons', icon: '🎨' },
  { href: '/settings',     label: 'Settings',        icon: '⚙️' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)

  const isMoreActive = MORE_ITEMS.some(item => pathname.startsWith(item.href))

  return (
    <>
      {showMore && (
        <div className="md:hidden fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowMore(false)} />
      )}

      {showMore && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-50 rounded-t-2xl border-t border-x overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {MORE_ITEMS.map(item => (
            <Link key={item.href} href={item.href}
              onClick={() => setShowMore(false)}
              className="flex items-center gap-3 px-5 py-4 border-b"
              style={{
                borderColor: 'var(--border)',
                color: pathname.startsWith(item.href) ? 'var(--primary)' : 'var(--foreground)',
                textDecoration: 'none',
              }}>
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
              {pathname.startsWith(item.href) && (
                <span className="ml-auto w-2 h-2 rounded-full" style={{ background: 'var(--primary)' }} />
              )}
            </Link>
          ))}
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
        {PRIMARY_TABS.map(tab => {
          const isActive = tab.isMore
            ? isMoreActive || showMore
            : tab.href === '/'
              ? pathname === '/'
              : pathname.startsWith(tab.href)

          return (
            <button key={tab.href}
              onClick={() => {
                if (tab.isMore) {
                  setShowMore(v => !v)
                } else {
                  setShowMore(false)
                  window.location.href = tab.href
                }
              }}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative"
              style={{
                color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                minHeight: '56px',
              }}>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                  style={{ background: 'var(--primary)' }} />
              )}
              <span className="text-xl leading-none">{tab.icon}</span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
