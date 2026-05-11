'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

type Fight = {
  id: string; title: string; image: string | null
  team_a: string[]; team_b: string[]; team_c: string[]
  winner: string | null; deaths: string[]
  episode_global: number | null; episode_name: string | null
  episode_series: string | null; episode_num: number | null
  arc: string | null; rating: number | null; notes: string
  created_at: string
}

type CF = { id: string; name: string; tag: string; image: string | null }
type Ep = { id: string; global_episode: number; episode: number; series: string; name: string; arc: string | null }

export default function FightPanel({
  fight, characters, caseFiles, episodes,
  isEditing, onEdit, onCancel, onSave, onDelete,
  navigateToCF, navigateToEp,
}: {
  fight: Fight
  characters: CF[]
  caseFiles: CF[]
  episodes: Ep[]
  isEditing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (draft: Fight) => void
  onDelete: () => void
  navigateToCF: (id: string) => void
  navigateToEp: (series: string, epGlobal: number) => void
}) {
  const router = useRouter()

  const [draft,         setDraft]         = useState<Fight>({ ...fight })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [useTeamC,      setUseTeamC]      = useState((fight.team_c?.length || 0) > 0)
  const [teamSearchA,   setTeamSearchA]   = useState('')
  const [teamSearchB,   setTeamSearchB]   = useState('')
  const [teamSearchC,   setTeamSearchC]   = useState('')
  const [deathSearch,   setDeathSearch]   = useState('')
  const [epSearch,      setEpSearch]      = useState(fight.episode_name || '')
  const [showEpDd,      setShowEpDd]      = useState(false)

  useEffect(() => {
    setDraft({ ...fight })
    setUseTeamC((fight.team_c?.length || 0) > 0)
    setEpSearch(fight.episode_name || '')
    setConfirmDelete(false)
  }, [fight.id])

  function update(key: string, value: unknown) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function addToTeam(team: 'team_a' | 'team_b' | 'team_c', name: string) {
    if (!name.trim()) return
    if ((draft[team] || []).includes(name)) return
    update(team, [...(draft[team] || []), name])
  }

  function removeFromTeam(team: 'team_a' | 'team_b' | 'team_c', name: string) {
    update(team, (draft[team] || []).filter(n => n !== name))
  }

  function addDeath(name: string) {
    if (!name.trim() || (draft.deaths || []).includes(name)) return
    update('deaths', [...(draft.deaths || []), name])
    setDeathSearch('')
  }

  function removeDeath(name: string) {
    update('deaths', (draft.deaths || []).filter(n => n !== name))
  }

  function pickEpisode(ep: Ep) {
    update('episode_global', ep.global_episode)
    update('episode_name', ep.name)
    update('episode_series', ep.series)
    update('episode_num', ep.episode)
    if (ep.arc && !draft.arc) update('arc', ep.arc)
    setEpSearch(ep.name)
    setShowEpDd(false)
  }

  function clearEpisode() {
    update('episode_global', null)
    update('episode_name', null)
    update('episode_series', null)
    update('episode_num', null)
    setEpSearch('')
  }

  function charSearch(q: string) {
    return q.trim()
      ? characters.filter(c => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
      : []
  }

  function findCF(name: string): CF | undefined {
    return caseFiles.find(c => c.name === name && c.tag === 'characters')
  }

  // Returns an avatar <div> — plain function, not a component, so no hook rules apply
  function avatarEl(name: string, size = 40) {
    const cf = findCF(name)
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: 'var(--primary)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: 'white',
        fontSize: Math.floor(size * 0.28), fontWeight: 700,
      }}>
        {cf?.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={cf.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials}
      </div>
    )
  }

  const allTeamMembers = [
    ...(draft.team_a || []),
    ...(draft.team_b || []),
    ...(draft.team_c || []),
  ]

  // ── VIEW MODE ──────────────────────────────────────────────────────────────────
  if (!isEditing) {
    const teams = [
      { label: 'Team A', members: fight.team_a || [] },
      { label: 'Team B', members: fight.team_b || [] },
      ...(fight.team_c?.length ? [{ label: 'Team C', members: fight.team_c }] : []),
    ]

    return (
      <div className="p-6 space-y-6">

        {/* Image */}
        {fight.image && (
          <div className="rounded-xl overflow-hidden" style={{ aspectRatio: '16/9', background: 'var(--muted)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fight.image} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>FIGHT</div>
            <h2 className="font-display font-bold text-3xl leading-tight" style={{ color: 'var(--foreground)' }}>
              {fight.title || 'Untitled Fight'}
            </h2>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onEdit}
              className="px-3 py-1.5 rounded-xl text-sm border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent' }}
              onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onMouseOut={e => (e.currentTarget.style.borderColor = '')}>
              Edit
            </button>
            <button onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 rounded-xl text-sm border transition-colors"
              style={{ borderColor: 'var(--border)', color: '#ef4444', background: 'transparent' }}
              onMouseOver={e => (e.currentTarget.style.borderColor = '#ef4444')}
              onMouseOut={e => (e.currentTarget.style.borderColor = '')}>
              Delete
            </button>
          </div>
        </div>

        {/* Draw / No Contest / Interrupted banner */}
        {['Draw', 'No Contest', 'Interrupted'].includes(fight.winner || '') && (
          <div className="text-center py-2 rounded-xl mb-2 font-eyebrow text-xs"
            style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}>
            {fight.winner?.toUpperCase()}
          </div>
        )}

        {/* Teams */}
        <div className={`grid gap-4 ${(fight.team_c?.length || 0) > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {teams.map(team => {
            const isWinner = fight.winner === team.label
            return (
              <div key={team.label}
                className="rounded-xl p-4 transition-all"
                style={{
                  borderColor: isWinner ? 'var(--primary)' : 'var(--border)',
                  borderWidth: isWinner ? '2px' : '1px',
                  borderStyle: 'solid',
                  background: isWinner
                    ? 'color-mix(in oklab, var(--primary) 8%, var(--muted))'
                    : 'var(--muted)',
                }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-eyebrow text-[9px]"
                    style={{ color: isWinner ? 'var(--primary)' : 'var(--muted-foreground)' }}>
                    {team.label}
                  </div>
                  {isWinner && (
                    <span className="font-eyebrow text-[8px] px-2 py-0.5 rounded-lg"
                      style={{ background: 'var(--primary)', color: 'white' }}>
                      ★ WINNER
                    </span>
                  )}
                </div>
                {team.members.length > 0 ? (
                  <div className="space-y-1.5">
                    {team.members.map(name => {
                      const cf = caseFiles.find(c => c.name === name && c.tag === 'characters')
                      return cf ? (
                        <button key={name}
                          onClick={() => router.push(`/casefiles/characters?selected=${cf.id}`)}
                          className="flex items-center gap-2 hover:opacity-80 transition-opacity w-full"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                          {avatarEl(name, 32)}
                          <span className="text-sm font-medium" style={{ color: 'var(--primary)' }}>{name}</span>
                        </button>
                      ) : (
                        <div key={name} className="flex items-center gap-2">
                          {avatarEl(name, 32)}
                          <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{name}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>—</div>
                )}
              </div>
            )
          })}
        </div>

        {/* Rating */}
        {fight.rating != null && (
          <div className="rounded-xl p-4" style={{ background: 'var(--muted)' }}>
            <div className="font-eyebrow text-[9px] mb-2" style={{ color: 'var(--muted-foreground)' }}>RATING</div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>★ {fight.rating}/10</span>
              <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${(fight.rating / 10) * 100}%`, background: 'var(--primary)' }} />
              </div>
            </div>
          </div>
        )}

        {/* Episode + Arc */}
        {(fight.episode_name || fight.arc) && (
          <div className="grid grid-cols-2 gap-4">
            {fight.episode_name && (
              <div>
                <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>EPISODE</div>
                <button
                  onClick={() => router.push(`/episodes?series=${fight.episode_series}&ep=${fight.episode_global}`)}
                  className="text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {fight.episode_series === 'naruto' ? 'Naruto' : 'Shippuden'} · Ep {fight.episode_num}: {fight.episode_name} →
                </button>
              </div>
            )}
            {fight.arc && (
              <div>
                <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>ARC</div>
                <div className="text-sm" style={{ color: 'var(--foreground)' }}>{fight.arc}</div>
              </div>
            )}
          </div>
        )}

        {/* Deaths */}
        {(fight.deaths?.length > 0) && (
          <div>
            <div className="font-eyebrow text-[9px] mb-2" style={{ color: '#ef4444' }}>DEATHS</div>
            <div className="flex flex-wrap gap-2">
              {fight.deaths.map(d => {
                const cf = findCF(d)
                return (
                  <button key={d}
                    onClick={() => cf && navigateToCF(cf.id)}
                    className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-xl border font-medium"
                    style={{
                      borderColor: '#ef4444',
                      background: 'color-mix(in oklab, #ef4444 12%, var(--surface))',
                      color: '#ef4444',
                      cursor: cf ? 'pointer' : 'default',
                    }}>
                    {avatarEl(d, 20)}
                    💀 {d}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Notes */}
        {fight.notes && (
          <div>
            <div className="font-eyebrow text-[9px] mb-2" style={{ color: 'var(--muted-foreground)' }}>NOTES</div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>{fight.notes}</p>
          </div>
        )}

        {confirmDelete && (
          <ConfirmModal
            message={`Delete "${fight.title || 'this fight'}"? This cannot be undone.`}
            confirmLabel="Delete"
            onConfirm={onDelete}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </div>
    )
  }

  // ── EDIT MODE ──────────────────────────────────────────────────────────────────
  const deathResults = charSearch(deathSearch)
  const epResultsEdit = epSearch.trim() && showEpDd
    ? episodes.filter(e => e.name.toLowerCase().includes(epSearch.toLowerCase())).slice(0, 8)
    : []

  return (
    <div className="p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl" style={{ color: 'var(--foreground)' }}>
          {draft.id.startsWith('temp_') ? 'New Fight' : 'Edit Fight'}
        </h2>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent' }}>
            Cancel
          </button>
          <button onClick={() => onSave(draft)}
            className="px-4 py-1.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
            Save Fight
          </button>
        </div>
      </div>

      {/* Image URL */}
      <EditField label="FIGHT IMAGE URL">
        <input type="text" value={draft.image || ''}
          onChange={e => update('image', e.target.value || null)}
          placeholder="https://…"
          className="input-field" />
      </EditField>

      {/* Title */}
      <EditField label="FIGHT TITLE">
        <input type="text" value={draft.title}
          onChange={e => update('title', e.target.value)}
          placeholder="e.g. Naruto vs Sasuke — Valley of the End"
          className="input-field" />
      </EditField>

      {/* Teams */}
      <div className="space-y-4">
        <TeamField
          label="TEAM A"
          members={draft.team_a || []}
          search={teamSearchA}
          onSearch={setTeamSearchA}
          suggestions={charSearch(teamSearchA)}
          onAdd={name => { addToTeam('team_a', name); setTeamSearchA('') }}
          onRemove={name => removeFromTeam('team_a', name)}
        />
        <TeamField
          label="TEAM B"
          members={draft.team_b || []}
          search={teamSearchB}
          onSearch={setTeamSearchB}
          suggestions={charSearch(teamSearchB)}
          onAdd={name => { addToTeam('team_b', name); setTeamSearchB('') }}
          onRemove={name => removeFromTeam('team_b', name)}
        />
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none"
          style={{ color: 'var(--muted-foreground)' }}>
          <input type="checkbox" checked={useTeamC}
            onChange={e => { setUseTeamC(e.target.checked); if (!e.target.checked) update('team_c', []) }}
            style={{ accentColor: 'var(--primary)' }} />
          Include a third team (Team C)
        </label>
        {useTeamC && (
          <TeamField
            label="TEAM C"
            members={draft.team_c || []}
            search={teamSearchC}
            onSearch={setTeamSearchC}
            suggestions={charSearch(teamSearchC)}
            onAdd={name => { addToTeam('team_c', name); setTeamSearchC('') }}
            onRemove={name => removeFromTeam('team_c', name)}
          />
        )}
      </div>

      {/* WHO WON? — team selector */}
      <EditField label="WHO WON?">
        <div className="flex flex-wrap gap-2">
          {[
            ...(draft.team_a?.length ? [{ label: 'Team A', members: draft.team_a }] : []),
            ...(draft.team_b?.length ? [{ label: 'Team B', members: draft.team_b }] : []),
            ...(draft.team_c?.length ? [{ label: 'Team C', members: draft.team_c }] : []),
            { label: 'Draw', members: [] },
            { label: 'No Contest', members: [] },
            { label: 'Interrupted', members: [] },
          ].map(option => {
            const isSelected = draft.winner === option.label
            return (
              <button key={option.label}
                type="button"
                onClick={() => update('winner', isSelected ? null : option.label)}
                className="px-4 py-2.5 rounded-xl border transition-all text-sm font-medium"
                style={{
                  borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                  background: isSelected ? 'color-mix(in oklab, var(--primary) 15%, var(--surface))' : 'var(--muted)',
                  color: isSelected ? 'var(--primary)' : 'var(--foreground)',
                  outline: isSelected ? '2px solid var(--primary)' : 'none',
                  cursor: 'pointer',
                }}>
                {isSelected && '✓ '}{option.label}
                {option.members.length > 0 && (
                  <span className="ml-1.5 text-xs opacity-60">
                    ({option.members.slice(0, 2).join(', ')}{option.members.length > 2 ? '…' : ''})
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </EditField>

      {/* Episode */}
      <EditField label="EPISODE">
        <div className="relative">
          <input type="text" value={epSearch}
            onChange={e => { setEpSearch(e.target.value); update('episode_name', null); setShowEpDd(true) }}
            onFocus={() => setShowEpDd(true)}
            onBlur={() => setTimeout(() => setShowEpDd(false), 150)}
            placeholder="Search episode…"
            className="input-field pr-8" />
          {draft.episode_name && (
            <button onClick={clearEpisode}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
              style={{ color: 'var(--muted-foreground)' }}>✕</button>
          )}
          {epResultsEdit.length > 0 && (
            <div className="absolute z-20 w-full rounded-xl border mt-1 overflow-y-auto shadow-lg"
              style={{ maxHeight: '200px', borderColor: 'var(--border)', background: 'var(--surface)' }}>
              {epResultsEdit.map(ep => (
                <button key={ep.id}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-muted/50 transition-colors"
                  style={{ color: 'var(--foreground)' }}
                  onMouseDown={() => pickEpisode(ep)}>
                  <span style={{ color: 'var(--muted-foreground)' }}>
                    {ep.series === 'naruto' ? 'N' : 'S'} · Ep {ep.episode} ·{' '}
                  </span>
                  {ep.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </EditField>

      {/* Arc */}
      <EditField label="ARC">
        <input type="text" value={draft.arc || ''}
          onChange={e => update('arc', e.target.value || null)}
          placeholder="Auto-fills from episode, or type manually"
          className="input-field" />
      </EditField>

      {/* Rating */}
      <EditField label="FIGHT RATING (1–10)">
        <div className="flex items-center gap-3">
          <input type="number" min={1} max={10} step={0.5}
            value={draft.rating ?? ''}
            onChange={e => update('rating', e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="—"
            className="input-field text-center"
            style={{ width: '6rem' }} />
          {draft.rating != null && (
            <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--border)' }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${(draft.rating / 10) * 100}%`, background: 'var(--primary)' }} />
            </div>
          )}
        </div>
      </EditField>

      {/* Deaths */}
      <EditField label="DEATHS">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {(draft.deaths || []).map(d => (
            <span key={d}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl border font-medium"
              style={{ borderColor: '#ef4444', background: 'color-mix(in oklab, #ef4444 12%, var(--surface))', color: '#ef4444' }}>
              💀 {d}
              <button onClick={() => removeDeath(d)} className="hover:opacity-60 ml-0.5">×</button>
            </span>
          ))}
        </div>
        <div className="relative">
          <input type="text" value={deathSearch}
            onChange={e => setDeathSearch(e.target.value)}
            placeholder="Search character to mark as death…"
            className="input-field" />
          {deathResults.length > 0 && (
            <div className="absolute z-20 w-full rounded-xl border mt-1 overflow-y-auto shadow-lg"
              style={{ maxHeight: '160px', borderColor: 'var(--border)', background: 'var(--surface)' }}>
              {deathResults.map(c => (
                <button key={c.id}
                  className="w-full px-3 py-2 text-xs text-left hover:bg-muted/50"
                  style={{ color: 'var(--foreground)' }}
                  onMouseDown={() => addDeath(c.name)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </EditField>

      {/* Notes */}
      <EditField label="NOTES">
        <textarea value={draft.notes || ''}
          onChange={e => update('notes', e.target.value)}
          rows={4}
          placeholder="Fight notes, observations, memorable moments…"
          className="input-field resize-none" />
      </EditField>

    </div>
  )
}

// ── Helper components ──────────────────────────────────────────────────────────

function TeamField({ label, members, search, onSearch, suggestions, onAdd, onRemove }: {
  label: string
  members: string[]
  search: string
  onSearch: (v: string) => void
  suggestions: { id: string; name: string }[]
  onAdd: (name: string) => void
  onRemove: (name: string) => void
}) {
  return (
    <div className="rounded-xl border p-4 space-y-3"
      style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
      <div className="font-eyebrow text-[9px]" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
      {members.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {members.map(m => (
            <span key={m}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl border"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)' }}>
              {m}
              <button onClick={() => onRemove(m)} className="hover:opacity-60 ml-0.5"
                style={{ color: 'var(--muted-foreground)' }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <input type="text" value={search}
          onChange={e => onSearch(e.target.value)}
          placeholder="Add character to this team…"
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {suggestions.length > 0 && (
          <div className="absolute z-20 w-full rounded-xl border mt-1 overflow-y-auto shadow-lg"
            style={{ maxHeight: '160px', borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {suggestions.map(c => (
              <button key={c.id}
                className="w-full px-3 py-2 text-xs text-left hover:bg-muted/50 transition-colors"
                style={{ color: 'var(--foreground)' }}
                onMouseDown={() => onAdd(c.name)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EditField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="font-eyebrow text-[9px] mb-1.5" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
      {children}
    </div>
  )
}

function ConfirmModal({ message, confirmLabel, onConfirm, onCancel }: {
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="rounded-2xl border p-6 w-full max-w-sm mx-4 space-y-4"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <h3 className="font-display font-bold text-lg" style={{ color: 'var(--foreground)' }}>
          Are you sure?
        </h3>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-sm border"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent' }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-medium"
            style={{ background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
