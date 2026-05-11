'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import CaseFileDetail from '@/components/CaseFileDetail'
import LoadingSpinner from '@/components/LoadingSpinner'

export type Relationship = {
  cfId: string
  cfName: string
  type: string
  familyDetail?: string
}

export type CaseFile = {
  id: string
  name: string
  tag: string
  image: string | null
  summary: string | null
  // Character / shared fields
  village: string | null
  clan: string | null
  group: string | null
  rank: string | null
  status: string | null
  kekkei_genkai: string | null
  voice_actor: string | null
  // Jutsu
  jutsu_type: string | null
  chakra_nature: string[]
  used_by: string[]
  // Clans
  notable_members: string[]
  // Groups
  group_type: string | null
  group_type_other: string | null
  leader: string | null
  affiliation: string | null
  members: string[]
  // Villages
  nation: string | null
  kage_title: string | null
  current_kage: string | null
  alliance_status: string | null
  village_members: string[]
  // Locations
  region_nation: string | null
  region_nation_other: string | null
  location_type: string | null
  location_type_other: string | null
  // Events
  event_type: string | null
  event_episode_global: number | null
  event_episode_name: string | null
  event_episode_series: string | null
  event_episode_num: number | null
  key_participants: string[]
  outcome: string | null
  outcome_other: string | null
  arc: string | null
  // Shared
  relationships: Relationship[]
  notes: Record<string, string> | null
  created_at: string
  updated_at: string
}

export type EpisodeBrief = {
  id: string
  global_episode: number
  series: string
  episode: number
  name: string
  in_this_episode: string[]
  arc: string | null
}

const TAG_META: Record<string, { label: string; color: string }> = {
  all:        { label: 'All Files',  color: '#6366f1' },
  characters: { label: 'Characters', color: '#b45000' },
  jutsu:      { label: 'Jutsu',      color: '#0050b4' },
  clans:      { label: 'Clans',      color: '#8c0000' },
  groups:     { label: 'Groups',     color: '#005032' },
  villages:   { label: 'Villages',   color: '#006e32' },
  locations:  { label: 'Locations',  color: '#143c82' },
  events:     { label: 'Events',     color: '#827800' },
  other:      { label: 'Other',      color: '#5a0082' },
}

const ALL_TAGS = ['characters', 'jutsu', 'clans', 'groups', 'villages', 'locations', 'events', 'other']

const SORT_OPTIONS = [
  { value: 'name_asc',  label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'newest',    label: 'Newest first' },
  { value: 'oldest',    label: 'Oldest first' },
]

// ── Inner component (uses useSearchParams) ────────────────────────────────────
function CaseFileTagPageInner() {
  const params        = useParams()
  const router        = useRouter()
  const searchParams  = useSearchParams()
  const tag           = params.tag as string
  const meta          = TAG_META[tag] || { label: tag, color: '#8A93A8' }
  const supabase      = createClient()
  const preselectedId = searchParams.get('selected')

  const [caseFiles,    setCaseFiles]    = useState<CaseFile[]>([])
  const [allCaseFiles, setAllCaseFiles] = useState<CaseFile[]>([])
  const [episodes,     setEpisodes]     = useState<EpisodeBrief[]>([])
  const [loading,      setLoading]      = useState(true)
  const [selected,     setSelected]     = useState<CaseFile | null>(null)
  const [search,       setSearch]       = useState('')
  const [sort,         setSort]         = useState('name_asc')
  const [showAdd,      setShowAdd]      = useState(false)
  const [addName,      setAddName]      = useState('')
  const [addTag,       setAddTag]       = useState(tag === 'all' ? 'characters' : tag)
  const [adding,       setAdding]       = useState(false)
  const [mobileView,   setMobileView]   = useState<'list' | 'detail'>('list')

  useEffect(() => {
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag])

  // Auto-select from URL param
  useEffect(() => {
    if (preselectedId && caseFiles.length > 0) {
      const cf = caseFiles.find(c => c.id === preselectedId)
      if (cf) setSelected(cf)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedId, caseFiles])

  // Keep selected in sync with caseFiles
  useEffect(() => {
    if (selected) {
      const updated = caseFiles.find(c => c.id === selected.id)
      if (updated) setSelected(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseFiles])

  async function loadAll() {
    setLoading(true)
    // Load case files
    if (tag === 'all') {
      const { data } = await supabase.from('case_files').select('*').order('name')
      const list = data || []
      setCaseFiles(list)
      setAllCaseFiles(list)
    } else {
      const [{ data: tagData }, { data: allData }] = await Promise.all([
        supabase.from('case_files').select('*').eq('tag', tag).order('name'),
        supabase.from('case_files').select('*').order('name'),
      ])
      setCaseFiles(tagData || [])
      setAllCaseFiles(allData || [])
    }
    // Load episodes for appearance tracking
    const { data: epData } = await supabase
      .from('episodes')
      .select('id,global_episode,series,episode,name,in_this_episode,arc')
      .order('global_episode')
    setEpisodes(epData || [])
    setLoading(false)
  }

  async function handleAdd() {
    const effectiveTag = tag === 'all' ? addTag : tag
    if (!addName.trim()) return
    setAdding(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAdding(false); return }

    const { data, error } = await supabase
      .from('case_files')
      .insert({
        id: `cf_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        user_id: user.id,
        name: addName.trim(),
        tag: effectiveTag,
        notes: {},
        relationships: [],
        chakra_nature: [],
        used_by: [],
        notable_members: [],
        members: [],
        village_members: [],
        key_participants: [],
      })
      .select()
      .single()

    if (error) {
      console.error('Create failed:', JSON.stringify(error))
      setAdding(false)
      return
    }

    const newList = tag === 'all'
      ? [...caseFiles, data].sort((a, b) => a.name.localeCompare(b.name))
      : (effectiveTag === tag ? [...caseFiles, data].sort((a, b) => a.name.localeCompare(b.name)) : caseFiles)
    setCaseFiles(newList)
    setAllCaseFiles(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    if (effectiveTag === tag || tag === 'all') setSelected(data)
    setShowAdd(false)
    setAddName('')
    setAdding(false)
  }

  function handleUpdate(updated: CaseFile) {
    setCaseFiles(prev => prev.map(c => c.id === updated.id ? updated : c))
    setAllCaseFiles(prev => prev.map(c => c.id === updated.id ? updated : c))
    setSelected(updated)
  }

  async function handleDelete(id: string) {
    await supabase.from('case_files').delete().eq('id', id)
    setCaseFiles(prev => prev.filter(c => c.id !== id))
    setAllCaseFiles(prev => prev.filter(c => c.id !== id))
    setSelected(null)
  }

  function navigateToCF(cfId: string) {
    const target = allCaseFiles.find(cf => cf.id === cfId)
    if (!target) return
    if (target.tag === tag || tag === 'all') {
      // Stay on current page, just select
      const cf = caseFiles.find(c => c.id === cfId)
      if (cf) { setSelected(cf); return }
    }
    router.push(`/casefiles/${target.tag}?selected=${cfId}`)
  }

  function goToEpisode(globalEp: number, series: string) {
    router.push(`/episodes?series=${series}&ep=${globalEp}`)
  }

  // Filter + sort
  const displayed = caseFiles
    .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'name_asc')  return a.name.localeCompare(b.name)
      if (sort === 'name_desc') return b.name.localeCompare(a.name)
      if (sort === 'newest')    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      if (sort === 'oldest')    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      return 0
    })

  if (loading) return <LoadingSpinner />

  return (
    <div className="relative" style={{ display: 'flex', height: 'calc(100vh - 57px)', padding: '12px', gap: '12px', overflow: 'hidden' }}>

      {/* Left panel: header + list */}
      <div
        className={`flex-col rounded-2xl border border-border bg-surface overflow-hidden transition-transform duration-300 ${mobileView === 'detail' ? '-translate-x-full md:translate-x-0 absolute md:relative inset-y-3 left-3 z-10' : 'translate-x-0'} flex`}
        style={{ width: mobileView === 'detail' ? undefined : '100%', maxWidth: '380px', minWidth: mobileView === 'list' ? undefined : '260px', flexShrink: 0 }}>

        {/* Left panel header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-border space-y-3">
          {/* Breadcrumb */}
          <button onClick={() => router.push('/casefiles')}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:opacity-70 transition-opacity">
            <span>‹</span>
            <span className="font-eyebrow tracking-widest">CASE FILES</span>
          </button>

          {/* Title row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: meta.color }} />
              <h1 className="font-display font-bold text-lg leading-tight">{meta.label}</h1>
              <span className="text-xs text-muted-foreground">{caseFiles.length}</span>
            </div>
            <button onClick={() => { setShowAdd(true); setAddName(''); setAddTag(tag === 'all' ? 'characters' : tag) }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium flex-shrink-0"
              style={{ background: meta.color, color: '#fff', border: 'none', cursor: 'pointer' }}>
              + New
            </button>
          </div>

          {/* Search + sort row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs pointer-events-none">🔍</span>
              <input type="text" placeholder={`Search…`} value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border bg-muted text-sm focus:outline-none"
                style={{ color: 'var(--foreground)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.currentTarget.style.borderColor = '')} />
            </div>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="px-2 py-1.5 rounded-xl border border-border bg-muted text-xs text-muted-foreground focus:outline-none"
              style={{ color: 'var(--foreground)' }}>
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {displayed.length === 0 && (
            <div className="text-center py-12 space-y-2">
              <div className="text-3xl">📁</div>
              <p className="text-sm text-muted-foreground italic">
                {search ? 'No results found.' : `No ${meta.label.toLowerCase()} yet. Add one!`}
              </p>
            </div>
          )}
          {displayed.map((cf, idx) => {
            const isSelected = selected?.id === cf.id
            const initials   = cf.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
            const cfMeta     = TAG_META[cf.tag] || meta
            return (
              <div key={cf.id}>
                {idx > 0 && (
                  <div className="mx-3" style={{ height: '1px', background: 'var(--border)', opacity: 0.5 }} />
                )}
                <div
                  className="flex items-center gap-3 px-3 py-4 rounded-xl cursor-pointer transition-colors"
                  style={{
                    background: isSelected ? meta.color + '14' : 'transparent',
                    borderLeft: isSelected ? `3px solid ${meta.color}` : '3px solid transparent',
                  }}
                  onMouseOver={e => { if (!isSelected) e.currentTarget.style.background = 'var(--muted)' }}
                  onMouseOut={e => { if (!isSelected) e.currentTarget.style.background = isSelected ? meta.color + '14' : 'transparent' }}
                  onClick={() => {
                    const next = isSelected ? null : cf
                    setSelected(next)
                    if (next && typeof window !== 'undefined' && window.innerWidth < 768) {
                      setMobileView('detail')
                    }
                  }}>
                  {/* Avatar */}
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: cfMeta.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {cf.image
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={cf.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: '#fff', fontSize: '.7rem', fontWeight: 700 }}>{initials}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{cf.name}</div>
                    <div className="flex items-center gap-1.5">
                      {tag === 'all' && (
                        <span className="font-eyebrow text-[8px] px-1 py-0.5 rounded"
                          style={{ background: cfMeta.color + '22', color: cfMeta.color }}>
                          {cf.tag}
                        </span>
                      )}
                      {cf.rank && <span className="text-xs text-muted-foreground truncate">{cf.rank}</span>}
                      {cf.village && !cf.rank && <span className="text-xs text-muted-foreground truncate">{cf.village}</span>}
                    </div>
                  </div>
                  {cf.status && (
                    <span className="text-[9px] font-eyebrow px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: cf.status === 'Deceased' ? '#8c000020' : '#00503220', color: cf.status === 'Deceased' ? '#8c0000' : '#005032' }}>
                      {cf.status.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right panel: detail */}
      <div className={`rounded-2xl border border-border bg-surface shadow-soft overflow-y-auto flex-col transition-transform duration-300 ${mobileView === 'detail' ? 'flex flex-1' : 'hidden md:flex flex-1'}`}>
        {/* Mobile back button */}
        {mobileView === 'detail' && (
          <button onClick={() => setMobileView('list')}
            className="md:hidden flex items-center gap-2 px-4 py-3 border-b text-sm font-medium flex-shrink-0"
            style={{ borderColor: 'var(--border)', color: 'var(--primary)', background: 'var(--surface)' }}>
            ← Case Files
          </button>
        )}
          {!selected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: '2.5rem', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '3rem', lineHeight: 1 }}>📁</div>
              <div className="font-display text-lg font-semibold">Select a case file</div>
              <p className="text-sm text-muted-foreground">Click any entry to view and edit details</p>
            </div>
          ) : (
            <CaseFileDetail
              key={selected.id}
              cf={selected}
              allCaseFiles={allCaseFiles}
              episodes={episodes}
              tagColor={TAG_META[selected.tag]?.color || meta.color}
              onUpdate={handleUpdate}
              onDelete={() => handleDelete(selected.id)}
              onNavigateCF={navigateToCF}
              onGoToEpisode={goToEpisode}
              loadCaseFiles={loadAll}
            />
          )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setShowAdd(false)}>
          <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft w-full max-w-sm mx-4"
            onClick={e => e.stopPropagation()}>
            <h2 className="font-display font-bold text-lg mb-4">
              New {tag === 'all' ? 'Case File' : meta.label.slice(0, -1)}
            </h2>

            {/* Tag selector (only for "all" page) */}
            {tag === 'all' && (
              <div className="mb-3">
                <label className="font-eyebrow text-[9px] text-muted-foreground block mb-1">CATEGORY</label>
                <select value={addTag} onChange={e => setAddTag(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  style={{ color: 'var(--foreground)' }}>
                  {ALL_TAGS.map(t => (
                    <option key={t} value={t}>{TAG_META[t]?.label || t}</option>
                  ))}
                </select>
              </div>
            )}

            <input type="text" value={addName} onChange={e => setAddName(e.target.value)}
              placeholder="Name…" autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
              className="w-full rounded-xl border border-border bg-muted px-3 py-2.5 text-sm focus:outline-none focus:border-primary mb-4"
              style={{ color: 'var(--foreground)' }} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground">
                Cancel
              </button>
              <button onClick={handleAdd} disabled={adding || !addName.trim()}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: meta.color, color: '#fff', border: 'none', cursor: adding ? 'default' : 'pointer', opacity: adding ? 0.65 : 1 }}>
                {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page export with Suspense boundary (required for useSearchParams) ─────────
export default function CaseFileTagPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <CaseFileTagPageInner />
    </Suspense>
  )
}
