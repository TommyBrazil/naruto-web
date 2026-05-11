'use client'

import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/':              'Dashboard',
  '/episodes':      'Episode Log',
  '/casefiles':     'Case Files',
  '/fights':        'Fight Tracker',
  '/rankings':      'Rankings',
  '/insights':      'Insights',
  '/encyclopedia':  'Ninja Encyclopedia',
  '/themes':        'Themes & Addons',
  '/settings':      'Settings',
}

export default function MobileHeader({ profile }: { profile: any }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname]
    || PAGE_TITLES[Object.keys(PAGE_TITLES).find(k => k !== '/' && pathname.startsWith(k)) ?? '']
    || 'Naruto'

  return (
    <header className="md:hidden flex items-center justify-between px-4 py-3 flex-shrink-0 border-b"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/naruto.webp" alt="Naruto" style={{ height: '28px', width: 'auto' }} suppressHydrationWarning />
      <span className="font-display font-bold text-base" style={{ color: 'var(--foreground)' }}>
        {title}
      </span>
      <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={{ background: 'var(--primary)', color: 'white' }}>
        {profile?.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={profile.image} alt={profile?.name || ''} className="w-full h-full object-cover" />
          : (profile?.name?.[0]?.toUpperCase() || 'S')}
      </div>
    </header>
  )
}
