'use client'

import { useState, useEffect } from 'react'
import { THEMES, UNLOCK_CODES, UNLOCKED_THEMES_KEY, type ThemeId } from '@/lib/themes'
import { applyTheme, loadSavedTheme } from '@/lib/theme'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_ADDONS = { showFiller: true, showRatings: true, showCrunchyroll: true }

export default function ThemesPage() {
  const supabase = createClient()
  const [activeTheme, setActiveTheme]   = useState<ThemeId>('leaf')
  const [unlocked, setUnlocked]         = useState<ThemeId[]>(['leaf'])
  const [code, setCode]                 = useState('')
  const [codeMsg, setCodeMsg]           = useState<{ text: string; ok: boolean } | null>(null)
  const [showCodeModal, setShowCodeModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [addons, setAddons] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return DEFAULT_ADDONS
    try {
      const saved = localStorage.getItem('naruto-addons')
      if (saved) return { ...DEFAULT_ADDONS, ...JSON.parse(saved) }
    } catch {}
    return DEFAULT_ADDONS
  })

  useEffect(() => {
    setMounted(true)
    setActiveTheme(loadSavedTheme())
    try {
      const saved = localStorage.getItem(UNLOCKED_THEMES_KEY)
      if (saved) setUnlocked(JSON.parse(saved))
    } catch {}
  }, [])

  function selectTheme(id: ThemeId) {
    if (!unlocked.includes(id)) return
    applyTheme(id)
    setActiveTheme(id)
  }

  function handleNumpad(digit: string) {
    if (digit === 'del') {
      setCode(prev => prev.slice(0, -1))
      return
    }
    const next = (code + digit).slice(-6)
    setCode(next)
    if (next.length === 6) {
      const target = UNLOCK_CODES[next]
      if (target && !unlocked.includes(target)) {
        const updated = [...unlocked, target]
        setUnlocked(updated)
        try { localStorage.setItem(UNLOCKED_THEMES_KEY, JSON.stringify(updated)) } catch {}
        const theme = THEMES.find(t => t.id === target)
        setCodeMsg({ text: `${theme?.emoji} ${theme?.name} theme unlocked!`, ok: true })
      } else if (target) {
        setCodeMsg({ text: 'Already unlocked', ok: false })
      } else {
        setCodeMsg({ text: 'Incorrect code', ok: false })
      }
      setCode('')
      setTimeout(() => setCodeMsg(null), 3000)
    }
  }

  async function toggleAddon(key: string) {
    const updated = { ...addons, [key]: !addons[key] }
    setAddons(updated)
    localStorage.setItem('naruto-addons', JSON.stringify(updated)) // sync, immediate
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('profiles').update({ addons: updated }).eq('id', user.id)
    } catch {}
  }

  const card: React.CSSProperties = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '1rem',
    boxShadow: 'var(--shadow-soft)',
  }

  const eyebrow: React.CSSProperties = {
    fontFamily: "'Bebas Neue', sans-serif",
    letterSpacing: '0.18em',
    fontSize: '0.7rem',
    color: 'var(--muted-foreground)',
  }

  return (
    <div style={{ padding: '1.5rem 2.5rem', height: 'calc(100vh - 57px)', overflowY: 'auto' }}>

      {/* Unlock Code Modal */}
      {showCodeModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowCodeModal(false); setCode(''); setCodeMsg(null) } }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: '1.25rem', border: '1px solid var(--border)', width: '100%', maxWidth: '360px', boxShadow: 'var(--shadow-soft)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div>
                <div style={eyebrow}>UNLOCK CODE</div>
                <h3 className="font-display font-bold" style={{ fontSize: '1.1rem', color: 'var(--foreground)', marginTop: '0.15rem' }}>Enter Secret Code</h3>
              </div>
              <button onClick={() => { setShowCodeModal(false); setCode(''); setCodeMsg(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted-foreground)', marginBottom: '1rem', lineHeight: 1.5 }}>
              Enter a 6-digit code to unlock hidden themes.
            </p>
            <div style={{ display: 'flex', gap: '0.45rem', marginBottom: '1rem', justifyContent: 'center' }}>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{
                  width: 36, height: 44, border: '2px solid',
                  borderColor: code.length > i ? 'var(--primary)' : 'var(--border)',
                  borderRadius: '0.5rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', fontWeight: 700, color: 'var(--foreground)',
                  background: 'var(--surface-elevated)', transition: 'border-color 0.15s',
                }}>
                  {code[i] ? '●' : ''}
                </div>
              ))}
            </div>
            {codeMsg && (
              <div style={{
                fontSize: '0.78rem', fontWeight: 600, textAlign: 'center',
                marginBottom: '0.75rem', padding: '0.4rem 0.75rem', borderRadius: '0.5rem',
                background: codeMsg.ok ? 'color-mix(in oklab, var(--primary) 12%, var(--surface))' : '#ef444418',
                color: codeMsg.ok ? 'var(--primary)' : '#ef4444',
              }}>
                {codeMsg.text}
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              {['1','2','3','4','5','6','7','8','9','del','0','↵'].map(key => {
                const isAction = key === 'del' || key === '↵'
                return (
                  <button key={key}
                    onClick={() => key !== '↵' && handleNumpad(key === 'del' ? 'del' : key)}
                    style={{
                      padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)',
                      background: isAction ? 'var(--muted)' : 'var(--surface-elevated)',
                      color: isAction ? 'var(--muted-foreground)' : 'var(--foreground)',
                      fontSize: '1rem', fontWeight: 600, cursor: key !== '↵' ? 'pointer' : 'default',
                      transition: 'background 0.1s', fontFamily: "'Space Grotesk', sans-serif",
                    }}
                    onMouseEnter={e => { if (key !== '↵') (e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = isAction ? 'var(--muted)' : 'var(--surface-elevated)' }}
                  >
                    {key}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={eyebrow}>THEMES & ADDONS</div>
          <h1 className="font-display font-bold" style={{ fontSize: '1.75rem', color: 'var(--foreground)', marginTop: '0.25rem' }}>
            Customise Your Experience
          </h1>
        </div>
        <button
          onClick={() => { setShowCodeModal(true); setCode(''); setCodeMsg(null) }}
          style={{ ...card, padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--muted-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          🔑 Unlock Code
        </button>
      </div>

      {/* ── Themes ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ ...eyebrow, marginBottom: '0.75rem' }}>THEMES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem' }}>
          {THEMES.map(theme => {
            const isUnlocked = unlocked.includes(theme.id)
            const isActive   = activeTheme === theme.id
            return (
              <button
                key={theme.id}
                suppressHydrationWarning
                onClick={() => selectTheme(theme.id)}
                disabled={mounted ? !isUnlocked : false}
                style={{
                  ...card,
                  padding: '1.25rem',
                  cursor: isUnlocked ? 'pointer' : 'default',
                  opacity: isUnlocked ? 1 : 0.55,
                  border: isActive
                    ? '2px solid var(--primary)'
                    : '1px solid var(--border)',
                  boxShadow: isActive ? 'var(--shadow-glow)' : 'var(--shadow-soft)',
                  textAlign: 'left',
                  transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
                  position: 'relative',
                  background: 'var(--surface)',
                }}
              >
                {/* Active badge */}
                {isActive && (
                  <span style={{
                    position: 'absolute', top: '0.6rem', right: '0.6rem',
                    background: 'var(--primary)', color: 'var(--primary-foreground)',
                    fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                    padding: '0.15rem 0.45rem', borderRadius: '999px',
                    fontFamily: "'Bebas Neue', sans-serif",
                  }}>ACTIVE</span>
                )}

                {/* Colour preview swatches */}
                <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.85rem' }}>
                  {[theme.preview.sidebar, theme.preview.primary, theme.preview.surface, theme.preview.bg].map((c, i) => (
                    <div key={i} style={{
                      width: i === 1 ? 28 : 18,
                      height: 28,
                      borderRadius: '6px',
                      background: c,
                      border: '1px solid rgba(0,0,0,0.1)',
                      flexShrink: 0,
                    }} />
                  ))}
                </div>

                {/* Lock overlay for locked themes */}
                {!isUnlocked && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>🔒</span>
                  </div>
                )}

                <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{theme.emoji}</div>
                <div className="font-display" style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--foreground)', marginBottom: '0.25rem' }}>
                  {theme.name}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)', lineHeight: 1.45 }}>
                  {isUnlocked ? theme.description : (theme.unlockHint ?? theme.description)}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Addons ─────────────────────────────────────────────── */}
      <section>
        <div style={{ ...eyebrow, marginBottom: '0.75rem' }}>ADDONS</div>
        <div style={{ ...card, overflow: 'hidden' }}>
          {[
            {
              key: 'showFiller',
              label: 'Show Filler Episodes',
              sub: 'Include filler episodes in the episode list',
              value: addons.showFiller,
            },
            {
              key: 'showRatings',
              label: 'Show Ratings',
              sub: 'Display personal ratings on episode cards',
              value: addons.showRatings,
            },
            {
              key: 'showCrunchyroll',
              label: 'Crunchyroll Links',
              sub: 'Show Crunchyroll watch links on episode cards',
              value: addons.showCrunchyroll,
            },
          ].map((addon, i, arr) => (
            <div
              key={addon.key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.25rem',
                borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <div>
                <div className="font-display" style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--foreground)', marginBottom: '0.15rem' }}>
                  {addon.label}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--muted-foreground)' }}>
                  {addon.sub}
                </div>
              </div>
              <button
                role="switch"
                aria-checked={mounted ? addon.value : false}
                suppressHydrationWarning
                onClick={() => toggleAddon(addon.key)}
                style={{
                  width: 44, height: 24, borderRadius: 999, flexShrink: 0,
                  background: mounted && addon.value ? 'var(--primary)' : 'var(--muted)',
                  border: 'none', cursor: 'pointer', position: 'relative',
                  transition: 'background 0.2s',
                }}
              >
                <span suppressHydrationWarning style={{
                  position: 'absolute', top: 3, width: 18, height: 18,
                  borderRadius: 999, background: 'white',
                  left: mounted && addon.value ? 23 : 3,
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
