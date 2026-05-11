'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const TAGS = [
  { key: 'all',        label: 'All Files',   image: '/assets/all.jpg',         color: 'rgba(0,0,0,0.92)' },
  { key: 'characters', label: 'Characters',  image: '/assets/characters.jpg',  color: '#b45000' },
  { key: 'jutsu',      label: 'Jutsu',        image: '/assets/jutsu.jpg',       color: '#0050b4' },
  { key: 'clans',      label: 'Clans',        image: '/assets/clans.jpg',       color: '#8c0000' },
  { key: 'groups',     label: 'Groups',       image: '/assets/groups.jpg',      color: '#005032' },
  { key: 'villages',   label: 'Villages',     image: '/assets/villages.jpg',    color: '#006e32' },
  { key: 'locations',  label: 'Locations',    image: '/assets/locations.jpg',   color: '#143c82' },
  { key: 'events',     label: 'Events',       image: '/assets/events.jpg',      color: '#827800' },
  { key: 'other',      label: 'Other',        image: '/assets/other.jpg',       color: '#5a0082' },
]

export default function CaseFilesPage() {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [hovered, setHovered] = useState<string | null>(null)
  const router  = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadCounts() {
      const { data } = await supabase
        .from('case_files')
        .select('tag')
      if (!data) return
      const map: Record<string, number> = {}
      data.forEach((row: { tag: string }) => {
        map[row.tag] = (map[row.tag] || 0) + 1
      })
      setCounts(map)
    }
    loadCounts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 57px)', padding: '12px', gap: '12px' }}>

      {/* Header */}
      <div className="flex-shrink-0">
        <div className="font-eyebrow text-[10px] tracking-widest text-muted-foreground">CASE FILES</div>
        <div className="flex items-baseline gap-3">
          <h1 className="font-display font-bold text-3xl text-foreground">Ninja Encyclopedia</h1>
          <span className="text-sm text-muted-foreground">{total} entries</span>
        </div>
      </div>

      {/* Tag strip menu */}
      <div style={{ display: 'flex', flex: 1, gap: '6px', minHeight: 0, overflow: 'hidden', borderRadius: '1rem' }}>
        {TAGS.map(tag => {
          const isHovered = hovered === tag.key
          const count     = tag.key === 'all' ? total : (counts[tag.key] || 0)
          return (
            <div
              key={tag.key}
              style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '0.875rem',
                cursor: 'pointer',
                flex: isHovered ? 4 : 1,
                transition: 'flex 0.35s cubic-bezier(.4,0,.2,1)',
                minWidth: 0,
                border: `2px solid ${isHovered ? tag.color : 'transparent'}`,
              }}
              onMouseEnter={() => setHovered(tag.key)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => router.push(`/casefiles/${tag.key}`)}>

              {/* Background image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={tag.image} alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', transition: 'transform 0.35s ease', transform: isHovered ? 'scale(1.04)' : 'scale(1)' }} />

              {/* Gradient overlay */}
              <div style={{ position: 'absolute', inset: 0, background: isHovered ? 'linear-gradient(to top, rgba(0,0,0,.82) 0%, rgba(0,0,0,.4) 50%, rgba(0,0,0,.18) 100%)' : 'linear-gradient(to top, rgba(0,0,0,.75) 0%, rgba(0,0,0,.55) 100%)' }} />

              {/* Collapsed label — rotated when narrow */}
              {!isHovered && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.9rem', letterSpacing: '0.1em', whiteSpace: 'nowrap', opacity: 0.9 }}>
                    {tag.label}
                  </div>
                </div>
              )}

              {/* Expanded content */}
              {isHovered && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '0.65rem', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.6)' }}>
                    {count} {count === 1 ? 'entry' : 'entries'}
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '2rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>
                    {tag.label}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/casefiles/${tag.key}`) }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', background: tag.color, color: '#fff', border: 'none', borderRadius: '.65rem', padding: '.5rem 1.25rem', fontFamily: "'Space Grotesk', sans-serif", fontSize: '.85rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start', marginTop: '.25rem' }}>
                    Open →
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
