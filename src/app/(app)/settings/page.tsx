'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const RANKS = [
  'Academy Student', 'Genin', 'Chunin', 'Jonin', 'Tokubetsu Jonin',
  'Kage', 'Sannin', 'Anbu Black Ops', 'Rogue Ninja', 'Unknown',
]

const VILLAGES = [
  'Konoha', 'Sunagakure', 'Kirigakure', 'Kumogakure', 'Iwagakure',
  'Otogakure', 'Akatsuki', 'Independent', 'Unknown',
]

const inputStyle: React.CSSProperties = {
  width: '100%', borderRadius: '0.75rem',
  border: '1px solid var(--border)', background: 'var(--muted)',
  color: 'var(--foreground)', outline: 'none',
  padding: '0.5rem 0.75rem', fontSize: '0.875rem',
}

export default function SettingsPage() {
  const [name, setName]                 = useState('')
  const [rank, setRank]                 = useState('Genin')
  const [village, setVillage]           = useState('Konoha')
  const [image, setImage]               = useState('')
  const [email, setEmail]               = useState('')
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [loading, setLoading]           = useState(true)
  const [deleteInput, setDeleteInput]   = useState('')
  const [showDeleteZone, setShowDeleteZone] = useState(false)
  const [reseeding, setReseeding]       = useState(false)
  const [reseedDone, setReseedDone]     = useState(false)
  const [geminiKey, setGeminiKey]       = useState('')
  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [savingKey, setSavingKey]       = useState(false)
  const [savedKey, setSavedKey]         = useState(false)
  const supabase = createClient()
  const router   = useRouter()

  useEffect(() => { loadProfile() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email || '')
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setName(data.name || '')
      setRank(data.rank || 'Genin')
      setVillage(data.village || 'Konoha')
      setImage(data.image || '')
      setGeminiKey(data.gemini_key || '')
    }
    setLoading(false)
  }

  async function saveProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSaving(true)
    await supabase.from('profiles').update({ name, rank, village, image }).eq('id', user.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function saveGeminiKey() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setSavingKey(true)
    await supabase.from('profiles').update({ gemini_key: geminiKey.trim() || null }).eq('id', user.id)
    setSavingKey(false)
    setSavedKey(true)
    setTimeout(() => setSavedKey(false), 2500)
  }

  async function sendPasswordReset() {
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    alert(`Password reset email sent to ${email}`)
  }

  async function reseedEpisodes() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setReseeding(true)
    await supabase.from('episodes').delete().eq('user_id', user.id)
    setReseedDone(true)
    setReseeding(false)
    setTimeout(() => router.push('/episodes'), 1500)
  }

  async function deleteAllData() {
    if (deleteInput !== 'DELETE') return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await Promise.all([
      supabase.from('episodes').delete().eq('user_id', user.id),
      supabase.from('case_files').delete().eq('user_id', user.id),
      supabase.from('fights').delete().eq('user_id', user.id),
      supabase.from('rankings').delete().eq('user_id', user.id),
      supabase.from('encyclopedia').delete().eq('user_id', user.id),
      supabase.from('activity').delete().eq('user_id', user.id),
      supabase.from('profiles').delete().eq('id', user.id),
    ])
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 57px)' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  const sectionCard: React.CSSProperties = {
    borderRadius: '1rem', border: '1px solid var(--border)',
    background: 'var(--surface)', padding: '1.25rem',
    display: 'flex', flexDirection: 'column', gap: '1rem',
  }

  return (
    <div style={{ padding: '1.5rem 2.5rem', height: 'calc(100vh - 57px)', overflowY: 'auto' }}>
      <div style={{ maxWidth: '42rem', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="font-eyebrow" style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', letterSpacing: '0.18em', marginBottom: '0.25rem' }}>
          ACCOUNT
        </div>
        <h1 className="font-display font-bold" style={{ fontSize: '1.75rem', color: 'var(--foreground)' }}>
          Settings
        </h1>
      </div>

      {/* ── Section 01: Profile ─────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="font-eyebrow" style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', letterSpacing: '0.18em', marginBottom: '0.5rem' }}>
          SECTION 01
        </div>
        <h2 className="font-display font-bold" style={{ fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '0.875rem' }}>
          Your Profile
        </h2>

        <div style={sectionCard}>

          {/* Avatar + URL */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '0.875rem', flexShrink: 0,
              background: 'var(--primary)', color: 'var(--primary-foreground)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '1.4rem', overflow: 'hidden',
            }}>
              {image
                ? <img src={image} alt={name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                : name[0]?.toUpperCase() || 'S'}
            </div>
            <div style={{ flex: 1 }}>
              <div className="font-eyebrow" style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
                AVATAR URL
              </div>
              <input
                type="text" value={image} onChange={e => setImage(e.target.value)}
                placeholder="https://… (image URL)"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <div className="font-eyebrow" style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
              NAME
            </div>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Your ninja name…"
              style={inputStyle}
            />
          </div>

          {/* Rank */}
          <div>
            <div className="font-eyebrow" style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
              RANK
            </div>
            <select value={rank} onChange={e => setRank(e.target.value)}
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
              {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Village */}
          <div>
            <div className="font-eyebrow" style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
              VILLAGE
            </div>
            <select value={village} onChange={e => setVillage(e.target.value)}
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>
              {VILLAGES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>

          {/* Save */}
          <button onClick={saveProfile} disabled={saving} style={{
            width: '100%', padding: '0.625rem', borderRadius: '0.75rem', border: 'none',
            background: saved ? '#10b981' : 'var(--primary)', color: 'var(--primary-foreground)',
            fontSize: '0.875rem', fontWeight: 600, cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1, transition: 'background 0.3s',
          }}>
            {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* ── Section 02: Account ─────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="font-eyebrow" style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', letterSpacing: '0.18em', marginBottom: '0.5rem' }}>
          SECTION 02
        </div>
        <h2 className="font-display font-bold" style={{ fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '0.875rem' }}>
          Account
        </h2>

        <div style={sectionCard}>

          {/* Email — read only */}
          <div>
            <div className="font-eyebrow" style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
              EMAIL
            </div>
            <div style={{ ...inputStyle, color: 'var(--muted-foreground)' }}>{email}</div>
          </div>

          {/* Password reset */}
          <div>
            <div className="font-eyebrow" style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
              PASSWORD
            </div>
            <button onClick={sendPasswordReset} style={{
              width: '100%', padding: '0.625rem', borderRadius: '0.75rem',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--foreground)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              Send Password Reset Email
            </button>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted-foreground)', marginTop: '0.35rem' }}>
              We'll send a reset link to {email}
            </p>
          </div>

          {/* Sign out */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <button onClick={signOut} style={{
              width: '100%', padding: '0.625rem', borderRadius: '0.75rem',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--muted-foreground)', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
            }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 02.5: AI ────────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="font-eyebrow" style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', letterSpacing: '0.18em', marginBottom: '0.5rem' }}>
          SECTION 02.5
        </div>
        <h2 className="font-display font-bold" style={{ fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '0.875rem' }}>
          AI Integration
        </h2>

        <div style={sectionCard}>
          <div>
            <div className="font-eyebrow" style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
              GEMINI API KEY
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              Powers the ✦ AI button on case files. Get a free key at{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                aistudio.google.com
              </a>.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type={showGeminiKey ? 'text' : 'password'}
                value={geminiKey}
                onChange={e => setGeminiKey(e.target.value)}
                placeholder="AIza…"
                style={{ ...inputStyle, flex: 1, fontFamily: geminiKey ? 'monospace' : undefined }}
              />
              <button
                onClick={() => setShowGeminiKey(v => !v)}
                style={{
                  padding: '0.5rem 0.75rem', borderRadius: '0.75rem',
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--muted-foreground)', fontSize: '0.75rem', cursor: 'pointer',
                  flexShrink: 0,
                }}>
                {showGeminiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button onClick={saveGeminiKey} disabled={savingKey} style={{
            width: '100%', padding: '0.625rem', borderRadius: '0.75rem', border: 'none',
            background: savedKey ? '#10b981' : 'var(--primary)', color: 'var(--primary-foreground)',
            fontSize: '0.875rem', fontWeight: 600, cursor: savingKey ? 'default' : 'pointer',
            opacity: savingKey ? 0.7 : 1, transition: 'background 0.3s',
          }}>
            {savingKey ? 'Saving…' : savedKey ? '✓ Saved!' : 'Save API Key'}
          </button>
        </div>
      </div>

      {/* ── Section 03: Data ────────────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="font-eyebrow" style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', letterSpacing: '0.18em', marginBottom: '0.5rem' }}>
          SECTION 03
        </div>
        <h2 className="font-display font-bold" style={{ fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '0.875rem' }}>
          Data
        </h2>

        <div style={sectionCard}>
          <div>
            <div className="font-eyebrow" style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
              EPISODE DATA
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
              Re-seeds all 730 episodes from scratch. Your watched status, notes, and ratings will be lost.
            </p>
            <button onClick={reseedEpisodes} disabled={reseeding || reseedDone} style={{
              width: '100%', padding: '0.625rem', borderRadius: '0.75rem',
              border: '1px solid var(--border)', background: 'transparent',
              color: reseedDone ? '#10b981' : 'var(--foreground)',
              fontSize: '0.875rem', fontWeight: 500, cursor: reseeding ? 'default' : 'pointer',
              opacity: reseeding ? 0.7 : 1,
            }}
              onMouseEnter={e => { if (!reseeding && !reseedDone) e.currentTarget.style.borderColor = 'var(--primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
              {reseeding ? 'Deleting episodes…' : reseedDone ? '✓ Done! Redirecting…' : 'Re-seed All Episodes'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Section 04: Danger Zone ─────────────────────────── */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="font-eyebrow" style={{ fontSize: '0.7rem', color: '#ef4444', letterSpacing: '0.18em', marginBottom: '0.5rem' }}>
          SECTION 04
        </div>
        <h2 className="font-display font-bold" style={{ fontSize: '1.1rem', color: 'var(--foreground)', marginBottom: '0.875rem' }}>
          Danger Zone
        </h2>

        <div style={{
          ...sectionCard,
          borderColor: '#ef4444',
          background: 'color-mix(in oklab, #ef4444 5%, var(--surface))',
        }}>
          <div>
            <div className="font-eyebrow" style={{ fontSize: '0.65rem', color: '#ef4444', letterSpacing: '0.12em', marginBottom: '0.3rem' }}>
              DELETE ALL DATA
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)', marginBottom: '0.875rem', lineHeight: 1.5 }}>
              Permanently deletes your account and all data — episodes, case files, fights, rankings, everything. This cannot be undone.
            </p>

            {!showDeleteZone ? (
              <button onClick={() => setShowDeleteZone(true)} style={{
                width: '100%', padding: '0.625rem', borderRadius: '0.75rem',
                border: '1px solid #ef4444', background: 'transparent',
                color: '#ef4444', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
              }}>
                I want to delete my account
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ fontSize: '0.78rem', fontWeight: 600, color: '#ef4444' }}>
                  Type DELETE to confirm:
                </p>
                <input
                  type="text" value={deleteInput}
                  onChange={e => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  style={{
                    ...inputStyle,
                    borderColor: deleteInput === 'DELETE' ? '#ef4444' : 'var(--border)',
                    fontFamily: 'monospace',
                  }}
                />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => { setShowDeleteZone(false); setDeleteInput('') }}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: '0.75rem',
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer',
                    }}>
                    Cancel
                  </button>
                  <button
                    onClick={deleteAllData}
                    disabled={deleteInput !== 'DELETE'}
                    style={{
                      flex: 1, padding: '0.5rem', borderRadius: '0.75rem', border: 'none',
                      background: deleteInput === 'DELETE' ? '#ef4444' : 'var(--muted)',
                      color: deleteInput === 'DELETE' ? 'white' : 'var(--muted-foreground)',
                      fontSize: '0.875rem', fontWeight: 600,
                      cursor: deleteInput === 'DELETE' ? 'pointer' : 'default',
                      opacity: deleteInput === 'DELETE' ? 1 : 0.5,
                      transition: 'background 0.15s',
                    }}>
                    Delete Everything
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      </div>
    </div>
  )
}
