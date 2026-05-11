'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UNLOCKED_THEMES_KEY } from '@/lib/themes'
import { useAddons } from '@/context/AddonsContext'
import { callGemini, parseAIResponse, buildEpisodeGenPrompt, getNoteSectionsAI } from '@/lib/gemini'
import type { CaseFileForPrompt, EpisodeForPrompt } from '@/lib/gemini'

type Episode = {
  id: string
  global_episode: number
  series: string
  episode: number
  name: string
  type: string
  watched: boolean
  personal_notes: string
  personal_rating: number | null
  watch_progress: number | null
  in_this_episode: string[]
  arc: string | null
  is_filler: boolean
  thumbnail: string | null
  runtime: number | null
  air_date: string | null
  overview: string | null
  imdb: number | null
  crunchyroll: string | null
  watch_after_global?: number | null
}

type CaseFile = {
  id: string
  name: string
  tag: string
  clan?: string | null
  group?: string | null
  image?: string | null
}

const TAG_COLORS: Record<string, string> = {
  characters: '#b45000',
  jutsu:      '#0050b4',
  clans:      '#8c0000',
  groups:     '#005032',
  villages:   '#006e32',
  locations:  '#143c82',
  events:     '#827800',
  other:      '#5a0082',
}

function EpisodesPageInner() {
  const searchParams = useSearchParams()
  const paramSeries  = searchParams.get('series')
  const paramEp      = searchParams.get('ep') ? parseInt(searchParams.get('ep')!) : null

  const [episodes, setEpisodes]     = useState<Episode[]>([])
  const [caseFiles, setCaseFiles]   = useState<CaseFile[]>([])
  const [loading, setLoading]       = useState(true)
  const [currentSeries, setCurrentSeries] = useState<string | null>(null)
  const [unlockToast, setUnlockToast] = useState<string | null>(null)
  const supabase = createClient()
  const { showFiller: addonShowFiller, showRatings, showCrunchyroll } = useAddons()

  useEffect(() => {
    loadAll()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-navigate to series+episode when arriving via URL params
  useEffect(() => {
    if (!loading && paramSeries) {
      setCurrentSeries(paramSeries)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, paramSeries])

  // Resolve the initial episode from URL params (only when episodes are loaded)
  const initialEp: Episode | null = (!loading && paramSeries && paramEp)
    ? (episodes.find(e => e.global_episode === paramEp && e.series === paramSeries) ?? null)
    : null

  async function loadAll() {
    setLoading(true)
    const [{ data: eps }, { data: cfs }] = await Promise.all([
      supabase.from('episodes').select('*').order('global_episode', { ascending: true }),
      supabase.from('case_files').select('id, name, tag, clan, group, image').order('name'),
    ])
    setEpisodes(eps || [])
    setCaseFiles(cfs || [])
    setLoading(false)
  }

  async function markWatched(ep: Episode) {
    const newWatched = !ep.watched
    await supabase.from('episodes').update({ watched: newWatched }).eq('id', ep.id)
    setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, watched: newWatched } : e))
    if (newWatched) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) await supabase.from('activity').insert({ action: 'Watched episode', name: ep.name, type: 'episode', user_id: user.id })
      // Unlock Shippuden theme on Naruto Ep 220
      if (ep.series === 'naruto' && ep.episode === 220) {
        try {
          const saved = localStorage.getItem(UNLOCKED_THEMES_KEY)
          const current: string[] = saved ? JSON.parse(saved) : ['leaf']
          if (!current.includes('shippuden')) {
            const updated = [...current, 'shippuden']
            localStorage.setItem(UNLOCKED_THEMES_KEY, JSON.stringify(updated))
            setUnlockToast('🌑 Shippuden theme unlocked! Visit Themes & Addons to apply it.')
            setTimeout(() => setUnlockToast(null), 5000)
          }
        } catch {}
      }
    }
  }

  async function watchUpToHere(ep: Episode) {
    const toMark = episodes.filter(e =>
      e.series === ep.series && e.type === 'episode' && e.global_episode <= ep.global_episode && !e.watched
    )
    if (toMark.length === 0) return
    const ids = toMark.map(e => e.id)
    await supabase.from('episodes').update({ watched: true }).in('id', ids)
    setEpisodes(prev => prev.map(e => ids.includes(e.id) ? { ...e, watched: true } : e))
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('activity').insert({ action: 'Watched episode', name: ep.name, type: 'episode', user_id: user.id })
  }

  async function saveNotes(ep: Episode, notes: string) {
    await supabase.from('episodes').update({ personal_notes: notes }).eq('id', ep.id)
    setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, personal_notes: notes } : e))
  }

  async function addCaseFile(ep: Episode, cfId: string) {
    const cf      = caseFiles.find(c => c.id === cfId)
    if (!cf) return
    const current = Array.isArray(ep.in_this_episode) ? ep.in_this_episode : []
    const toAdd   = new Set(current)
    toAdd.add(cfId)
    if (cf.tag === 'characters') {
      if (cf.clan && typeof cf.clan === 'string' && cf.clan.startsWith('cf_')) {
        const clanCf = caseFiles.find(c => c.id === cf.clan)
        if (clanCf?.tag === 'clans') toAdd.add(cf.clan)
      }
      if (cf.group && typeof cf.group === 'string' && cf.group.startsWith('cf_')) {
        const groupCf = caseFiles.find(c => c.id === cf.group)
        if (groupCf?.tag === 'groups') toAdd.add(cf.group)
      }
    }
    const updated = Array.from(toAdd)
    await supabase.from('episodes').update({ in_this_episode: updated }).eq('id', ep.id)
    setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, in_this_episode: updated } : e))
  }

  async function removeCaseFile(ep: Episode, cfId: string) {
    const updated = (Array.isArray(ep.in_this_episode) ? ep.in_this_episode : []).filter((id: string) => id !== cfId)
    await supabase.from('episodes').update({ in_this_episode: updated }).eq('id', ep.id)
    setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, in_this_episode: updated } : e))
  }

  async function saveRating(ep: Episode, rating: number | null) {
    await supabase.from('episodes').update({ personal_rating: rating }).eq('id', ep.id)
    setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, personal_rating: rating } : e))
  }

  async function saveProgress(ep: Episode, progress: number) {
    await supabase.from('episodes').update({ watch_progress: progress }).eq('id', ep.id)
    setEpisodes(prev => prev.map(e => e.id === ep.id ? { ...e, watch_progress: progress } : e))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 57px)' }}>
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 animate-spin mx-auto"
            style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
          <p className="text-sm text-muted-foreground">Loading episodes…</p>
        </div>
      </div>
    )
  }

  if (!currentSeries) {
    return <SeriesSelect episodes={episodes} onSelect={setCurrentSeries} />
  }

  return (
    <>
      {unlockToast && (
        <div style={{
          position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, background: 'var(--sidebar)', color: 'white',
          padding: '0.75rem 1.25rem', borderRadius: '0.875rem',
          boxShadow: 'var(--shadow-glow)', fontSize: '0.875rem', fontWeight: 600,
          maxWidth: '90vw', textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.15)',
        }}>
          {unlockToast}
        </div>
      )}
      <EpisodeList
        episodes={episodes}
        caseFiles={caseFiles}
        series={currentSeries}
        initialEp={initialEp}
        contextShowFiller={addonShowFiller}
        showRatings={showRatings}
        showCrunchyroll={showCrunchyroll}
        onBack={() => setCurrentSeries(null)}
        onMarkWatched={markWatched}
        onWatchUpToHere={watchUpToHere}
        onSaveNotes={saveNotes}
        onSaveRating={saveRating}
        onSaveProgress={saveProgress}
        onAddCaseFile={addCaseFile}
        onRemoveCaseFile={removeCaseFile}
      />
    </>
  )
}

export default function EpisodesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 57px)' }}>
        <div className="w-10 h-10 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
      </div>
    }>
      <EpisodesPageInner />
    </Suspense>
  )
}

// ─── Series Selection — converted from el-series-select HTML + updateSeriesSelectionStats() ─────

function SeriesSelect({ episodes, onSelect }: {
  episodes: Episode[]
  onSelect: (s: string) => void
}) {
  const series = [
    {
      key:         'naruto',
      backdrop:    '/assets/narutobackdrop.jpg',
      logo:        '/assets/naruto.webp',
      label:       'SERIES ONE',
      title:       'NARUTO',
      crunchyroll: 'https://www.crunchyroll.com/series/GY9PJ5KWR/naruto',
    },
    {
      key:         'shippuden',
      backdrop:    '/assets/shippudenbackdrop.jpg',
      logo:        '/assets/shippuden.webp',
      label:       'SERIES TWO',
      title:       'SHIPPUDEN',
      crunchyroll: 'https://www.crunchyroll.com/series/GYQ4MW246/naruto-shippuden',
    },
  ]

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 57px)', gap: '12px', padding: '12px' }}>
      {series.map(s => {
        const seriesEps = episodes.filter(e => e.series === s.key && e.type === 'episode')
        const watched   = seriesEps.filter(e => e.watched).length
        const total     = seriesEps.length || (s.key === 'naruto' ? 220 : 500)
        const pct       = total > 0 ? Math.round((watched / total) * 100) : 0

        return (
          <div key={s.key} className="el-series-card" onClick={() => onSelect(s.key)}>
            <div className="el-series-backdrop">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="el-backdrop-img" src={s.backdrop} alt={s.title} />
              <div className="el-backdrop-overlay"></div>
            </div>
            <div className="el-series-content">
              <div className="font-eyebrow text-[10px] mb-3" style={{ color: 'rgba(255,255,255,.6)' }}>{s.label}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.logo} alt={s.title}
                style={{ maxHeight: '48px', width: 'auto', objectFit: 'contain', objectPosition: 'left bottom', display: 'block', marginLeft: '0', marginRight: 'auto', marginBottom: '1rem' }} />
              <div className="el-series-stats">
                <div>
                  <div className="el-series-stat-val">{watched}</div>
                  <div className="el-series-stat-lbl">WATCHED</div>
                </div>
                <div>
                  <div className="el-series-stat-val">{total}</div>
                  <div className="el-series-stat-lbl">EPISODES</div>
                </div>
                <div>
                  <div className="el-series-stat-val">{pct}%</div>
                  <div className="el-series-stat-lbl">COMPLETE</div>
                </div>
              </div>
              <button className="el-series-btn">▶ Enter {s.key === 'naruto' ? 'the Academy' : 'Shippuden'}</button>
              <a href={s.crunchyroll} target="_blank" rel="noopener"
                onClick={e => e.stopPropagation()}
                className="text-xs underline mt-2 inline-block"
                style={{ color: 'rgba(255,255,255,0.5)' }}>
                Watch on Crunchyroll →
              </a>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Episode List — converted from renderEpisodeList() + renderSeriesBlock() ────────────────────

function EpisodeList({ episodes, caseFiles, series, initialEp, contextShowFiller, showRatings, showCrunchyroll, onBack, onMarkWatched, onWatchUpToHere, onSaveNotes, onSaveRating, onSaveProgress, onAddCaseFile, onRemoveCaseFile }: {
  episodes: Episode[]
  caseFiles: CaseFile[]
  series: string
  initialEp?: Episode | null
  contextShowFiller: boolean
  showRatings: boolean
  showCrunchyroll: boolean
  onBack: () => void
  onMarkWatched: (ep: Episode) => void
  onWatchUpToHere: (ep: Episode) => void
  onSaveNotes: (ep: Episode, notes: string) => void
  onSaveRating: (ep: Episode, rating: number | null) => void
  onSaveProgress: (ep: Episode, progress: number) => void
  onAddCaseFile: (ep: Episode, cfId: string) => void
  onRemoveCaseFile: (ep: Episode, cfId: string) => void
}) {
  // Auto-select: URL param episode OR first unwatched episode in series
  const firstUnwatched = !initialEp
    ? (episodes.find(e => e.series === series && e.type === 'episode' && !e.watched) ?? null)
    : null
  const autoEp = initialEp ?? firstUnwatched
  const autoArcId = autoEp?.arc
    ? autoEp.arc.toLowerCase().replace(/[^a-z0-9]/g, '-')
    : null

  const [openArcs, setOpenArcs]     = useState<Set<string>>(() =>
    autoArcId ? new Set([autoArcId]) : new Set()
  )
  const [filter, setFilter]         = useState<'all' | 'watched' | 'unwatched'>('all')
  const [showFiller, setShowFiller] = useState(contextShowFiller)
  const [search, setSearch]         = useState('')
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)

  // Sync local filler toggle when addon context changes
  useEffect(() => { setShowFiller(contextShowFiller) }, [contextShowFiller])
  const [selectedEp, setSelectedEp] = useState<Episode | null>(autoEp ?? null)

  // Keep selectedEp in sync when episodes state updates (e.g. after markWatched, saveNotes, addCaseFile)
  useEffect(() => {
    if (selectedEp) {
      const updated = episodes.find(e => e.id === selectedEp.id)
      if (updated) setSelectedEp(updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodes])

  // Scroll to the auto-selected episode card after mount
  useEffect(() => {
    if (!autoEp) return
    setTimeout(() => {
      document.getElementById(`ep-${autoEp.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 400)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggleArc(arcId: string) {
    setOpenArcs(prev => {
      const next = new Set(prev)
      if (next.has(arcId)) next.delete(arcId)
      else next.add(arcId)
      return next
    })
  }

  function selectEpisode(ep: Episode) {
    setSelectedEp(prev => prev?.id === ep.id ? null : ep)
    // Auto-open the arc containing this episode
    const arcId = (ep.arc || 'Other').toLowerCase().replace(/[^a-z0-9]/g, '-')
    setOpenArcs(prev => { const next = new Set(prev); next.add(arcId); return next })
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileSheetOpen(true)
    }
  }

  const seriesLabel  = series === 'naruto' ? 'NARUTO · ORIGINAL' : 'NARUTO SHIPPUDEN'
  const allSeriesEps = episodes.filter(e => e.series === series && e.type === 'episode')
  const totalWatched = allSeriesEps.filter(e => e.watched).length
  const totalEps     = allSeriesEps.length

  // Apply filters + search — matches renderEpisodeList()
  const filtered = episodes.filter(ep => {
    if (ep.series !== series) return false
    if (!showFiller && ep.is_filler) return false
    if (filter === 'watched' && !ep.watched) return false
    if (filter === 'unwatched' && ep.watched) return false
    if (search) {
      const q = search.toLowerCase()
      if (!ep.name.toLowerCase().includes(q) && !(ep.arc || '').toLowerCase().includes(q)) return false
    }
    return true
  })

  // Build arc map — same logic as renderSeriesBlock()
  const filteredMovies = filtered.filter(e => e.series === series && e.type === 'movie')
  const seriesEps      = filtered.filter(e => e.series === series && e.type === 'episode')

  type ArcEntry = { eps: Episode[]; maxGlobal: number; minGlobal: number; minEp: number; maxEp: number }
  const arcMap = new Map<string, ArcEntry>()
  seriesEps.forEach(ep => {
    const arc = ep.arc || 'Other'
    if (arc === 'Standalone') return
    if (!arcMap.has(arc)) arcMap.set(arc, { eps: [], maxGlobal: 0, minGlobal: Infinity, minEp: Infinity, maxEp: 0 })
    const entry = arcMap.get(arc)!
    entry.eps.push(ep)
    if (ep.global_episode > entry.maxGlobal) entry.maxGlobal = ep.global_episode
    if (ep.global_episode < entry.minGlobal) entry.minGlobal = ep.global_episode
    if (ep.episode < entry.minEp) entry.minEp = ep.episode
    if (ep.episode > entry.maxEp) entry.maxEp = ep.episode
  })

  const allStandalone = seriesEps.filter(e => e.arc === 'Standalone').sort((a, b) => a.episode - b.episode)
  const absorbedIds   = new Set<string>()

  arcMap.forEach(entry => {
    const within = allStandalone.filter(e => e.episode >= entry.minEp && e.episode <= entry.maxEp)
    within.forEach(e => {
      if (!absorbedIds.has(e.id)) {
        entry.eps.push(e)
        absorbedIds.add(e.id)
        if (e.global_episode > entry.maxGlobal) entry.maxGlobal = e.global_episode
        if (e.global_episode < entry.minGlobal) entry.minGlobal = e.global_episode
      }
    })
    entry.eps.sort((a, b) => a.episode - b.episode)
  })

  const standaloneEps = allStandalone.filter(e => !absorbedIds.has(e.id))

  type Item =
    | { type: 'arc'; arcName: string; entry: ArcEntry; minEp: number }
    | { type: 'movie'; movie: Episode; minEp: number }
    | { type: 'standalone'; ep: Episode; minEp: number }

  const items: Item[] = []

  // Sort arcs by minimum global_episode so movies slot in at their natural position
  arcMap.forEach((entry, arcName) => {
    items.push({ type: 'arc', arcName, entry, minEp: entry.minGlobal })
  })

  // All movies sorted by global_episode — no special end-group
  filteredMovies.forEach(movie => {
    const minEp = movie.watch_after_global != null ? movie.watch_after_global + 0.5 : movie.global_episode
    items.push({ type: 'movie', movie, minEp })
  })

  standaloneEps.forEach(ep => items.push({ type: 'standalone', ep, minEp: ep.global_episode }))
  items.sort((a, b) => a.minEp - b.minEp)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 57px)' }}>

      {/* Toolbar — matches el-list-view toolbar */}
      <div className="flex-shrink-0 flex items-center gap-3 flex-wrap px-4 py-3 border-b border-border">
        <button onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border text-sm text-muted-foreground transition-colors"
          style={{ flexShrink: 0 }}
          onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
          onMouseOut={e => (e.currentTarget.style.borderColor = '')}>
          ‹ Series
        </button>

        <div className="font-eyebrow text-[11px] text-muted-foreground flex-shrink-0">{seriesLabel}</div>

        {/* Search */}
        <div className="relative flex-1" style={{ minWidth: '180px' }}>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">🔍</span>
          <input type="text" placeholder="Search episodes or arcs…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-border bg-surface text-sm focus:outline-none"
            style={{ color: 'var(--foreground)' }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onBlur={e => (e.currentTarget.style.borderColor = '')} />
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5">
          {(['all', 'unwatched', 'watched'] as const).map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className="el-filter-btn px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-surface"
              style={filter === f ? { background: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' } : {}}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Filler toggle */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none"
          onClick={() => setShowFiller(v => !v)}>
          <div className="relative" style={{ width: '32px', height: '16px', flexShrink: 0 }}>
            <div className="absolute inset-0 rounded-full transition-colors"
              style={{ background: showFiller ? 'var(--primary)' : 'var(--muted-foreground)' }}></div>
            <div className="absolute top-[2px] w-3 h-3 rounded-full bg-white shadow transition-all"
              style={{ left: showFiller ? 'calc(100% - 14px)' : '2px' }}></div>
          </div>
          Show filler
        </div>

        <div className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
          {totalWatched} / {totalEps} episodes watched
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex gap-4 flex-1 min-h-0 px-4 py-3">

        {/* Left panel: arc list */}
        <div className="flex flex-col min-w-0 md:border-r w-full md:w-[55%]">
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">

            {items.length === 0 && (
              <p className="text-sm text-muted-foreground px-3 py-4 italic text-center">No episodes match the current filter.</p>
            )}

            {items.map((item, i) => {
              if (item.type === 'arc') {
                const { arcName, entry } = item
                const arcId      = arcName.toLowerCase().replace(/[^a-z0-9]/g, '-')
                const isOpen     = openArcs.has(arcId)
                const allArcEps  = allSeriesEps.filter(e =>
                  (e.arc || 'Other') === arcName ||
                  (e.arc === 'Standalone' && e.episode >= entry.minEp && e.episode <= entry.maxEp)
                )
                const arcWatched = allArcEps.filter(e => e.watched).length
                const arcPct     = allArcEps.length > 0 ? Math.round((arcWatched / allArcEps.length) * 100) : 0
                const isFiller   = entry.eps.length > 0 && entry.eps.every(e => e.is_filler)

                return (
                  <div key={`${arcName}-${i}`} className="arc-block rounded-xl border border-border overflow-hidden bg-surface">
                    <div className="flex items-center justify-between px-5 py-4 cursor-pointer transition-colors"
                      onMouseOver={e => (e.currentTarget.style.background = 'var(--muted)')}
                      onMouseOut={e => (e.currentTarget.style.background = '')}
                      onClick={() => toggleArc(arcId)}>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base font-bold">{arcName}</span>
                        {isFiller && (
                          <span className="font-eyebrow text-[8px] px-1.5 py-0.5 rounded bg-accent text-muted-foreground">FILLER</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{arcWatched} / {allArcEps.length}</span>
                        <div className="arc-track h-2 rounded-full overflow-hidden" style={{ width: '96px' }}>
                          <div className="arc-fill h-full" style={{ width: `${arcPct}%` }}></div>
                        </div>
                        <span className="text-muted-foreground text-xs"
                          style={{ display: 'inline-block', transform: isOpen ? '' : 'rotate(-90deg)', transition: 'transform 0.15s' }}>▾</span>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="arc-episodes divide-border">
                        {entry.eps.map(ep => (
                          <EpisodeCard
                            key={ep.id}
                            ep={ep}
                            episodes={allSeriesEps}
                            showFiller={showFiller}
                            showRatings={showRatings}
                            showCrunchyroll={showCrunchyroll}
                            isSelected={selectedEp?.id === ep.id}
                            onSelect={() => selectEpisode(ep)}
                            onMarkWatched={() => onMarkWatched(ep)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              if (item.type === 'movie') {
                return (
                  <MovieCard
                    key={item.movie.id}
                    movie={item.movie}
                    isSelected={selectedEp?.id === item.movie.id}
                    onSelect={() => selectEpisode(item.movie)}
                  />
                )
              }

              if (item.type === 'standalone') {
                return (
                  <StandaloneEpisode
                    key={item.ep.id}
                    ep={item.ep}
                    showFiller={showFiller}
                    isSelected={selectedEp?.id === item.ep.id}
                    onSelect={() => selectEpisode(item.ep)}
                  />
                )
              }

              return null
            })}


          </div>
        </div>

        {/* Right panel: episode detail */}
        <div className="hidden md:flex rounded-2xl border border-border bg-surface shadow-soft overflow-y-auto flex-shrink-0" style={{ width: '45%' }}>
          {!selectedEp ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: '2.5rem', textAlign: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '3rem', lineHeight: 1 }}>📺</div>
              <div className="font-display text-lg font-semibold">Select an episode</div>
              <p className="text-sm text-muted-foreground">Click any episode to see details, add notes, and track case files</p>
            </div>
          ) : (
            <EpisodeDetail
              ep={selectedEp}
              caseFiles={caseFiles}
              showRatings={showRatings}
              showCrunchyroll={showCrunchyroll}
              onMarkWatched={() => onMarkWatched(selectedEp)}
              onWatchUpToHere={() => onWatchUpToHere(selectedEp)}
              onSaveNotes={notes => onSaveNotes(selectedEp, notes)}
              onSaveRating={rating => onSaveRating(selectedEp, rating)}
              onSaveProgress={progress => onSaveProgress(selectedEp, progress)}
              onAddCaseFile={cfId => onAddCaseFile(selectedEp, cfId)}
              onRemoveCaseFile={cfId => onRemoveCaseFile(selectedEp, cfId)}
              onClose={() => setSelectedEp(null)}
            />
          )}
        </div>

      </div>

      {/* Mobile bottom sheet */}
      {mobileSheetOpen && selectedEp && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setMobileSheetOpen(false)} />
          <div className="relative rounded-t-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--surface)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-center px-4 py-3 border-b flex-shrink-0 relative"
              style={{ borderColor: 'var(--border)' }}>
              <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-strong)' }} />
              <button onClick={() => setMobileSheetOpen(false)}
                className="absolute right-4 text-sm"
                style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <div className="overflow-y-auto flex-1">
              <EpisodeDetail
                ep={selectedEp}
                caseFiles={caseFiles}
                showRatings={showRatings}
                showCrunchyroll={showCrunchyroll}
                onMarkWatched={() => { onMarkWatched(selectedEp) }}
                onWatchUpToHere={() => onWatchUpToHere(selectedEp)}
                onSaveNotes={notes => onSaveNotes(selectedEp, notes)}
                onSaveRating={rating => onSaveRating(selectedEp, rating)}
                onSaveProgress={progress => onSaveProgress(selectedEp, progress)}
                onAddCaseFile={cfId => onAddCaseFile(selectedEp, cfId)}
                onRemoveCaseFile={cfId => onRemoveCaseFile(selectedEp, cfId)}
                onClose={() => setMobileSheetOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ─── AI helpers ──────────────────────────────────────────────────────────────

const AI_OVERVIEW_KEY_MAP_EP: Record<string, string> = {
  summary: 'summary', village: 'village', clan: 'clan', group: 'group',
  rank: 'rank', status: 'status', kekkeiGenkai: 'kekkei_genkai', voiceActor: 'voice_actor',
  jutsuType: 'jutsu_type', chakraNature: 'chakra_nature',
  groupType: 'group_type', affiliation: 'affiliation',
  nation: 'nation', kageTitle: 'kage_title', allianceStatus: 'alliance_status',
  regionNation: 'region_nation', locationType: 'location_type',
  eventType: 'event_type', outcome: 'outcome', arc: 'arc',
}

function epAiResolveLinks(html: string, allCFs: { id: string; name: string }[]): string {
  if (!html) return html
  const nameToId: Record<string, string> = {}
  allCFs.forEach(c => { nameToId[c.name.toLowerCase()] = c.id })
  return html.replace(/\[LINK:([^\]]+)\]/g, (_m, linkName) => {
    const id = nameToId[linkName.trim().toLowerCase()]
    if (!id) return linkName.trim()
    return `<span data-cf-id="${id}" style="color:var(--primary);text-decoration:underline;text-decoration-style:dotted;cursor:pointer;font-weight:600">${linkName.trim()}</span>`
  })
}

// ─── Episode Card — converted from renderEpisodeCard() ───────────────────────

function EpisodeCard({ ep, episodes, showFiller, showRatings, showCrunchyroll, isSelected, onSelect, onMarkWatched }: {
  ep: Episode
  episodes: Episode[]
  showFiller: boolean
  showRatings: boolean
  showCrunchyroll: boolean
  isSelected: boolean
  onSelect: () => void
  onMarkWatched: () => void
}) {
  const state    = getEpisodeState(ep, episodes)
  const isMovie  = ep.type === 'movie'
  const epNum    = isMovie ? '🎬 MOVIE' : `EP ${ep.episode}`

  const stateClass = state === 'watched' ? ' state-watched'
    : state === 'up-next' ? ' state-up-next'
    : state === 'in-progress' ? ' state-in-progress'
    : ''

  const stateBadge = state === 'up-next'
    ? <span className="ep-state-badge up-next">UP NEXT</span>
    : state === 'in-progress'
    ? <span className="ep-state-badge in-progress">IN PROGRESS</span>
    : null

  const showCR = showCrunchyroll && !ep.watched && !isMovie && !!ep.crunchyroll && ep.crunchyroll.startsWith('http')

  return (
    <div id={`ep-${ep.id}`}
      className={`ep-card flex items-center gap-3 px-4 py-4 cursor-pointer transition-colors${stateClass}${isSelected ? ' ep-card-selected' : ''}`}
      data-global-ep={ep.global_episode}
      onClick={onSelect}>
      <div className="relative flex-shrink-0 rounded-lg overflow-hidden bg-muted" style={{ width: '112px', aspectRatio: '16/9' }}>
        {ep.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ep.thumbnail} alt="" className="w-full h-full object-cover object-center" loading="lazy" />
        )}
        {ep.watched && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'color-mix(in oklch,var(--primary) 25%,transparent)' }}>
            <span className="font-bold" style={{ color: 'var(--primary)' }}>✓</span>
          </div>
        )}
        {!ep.watched && (ep.watch_progress ?? 0) > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'rgba(0,0,0,.35)' }}>
            <div className="h-full" style={{ width: `${Math.min(100, ((ep.watch_progress ?? 0) / (ep.runtime || 24)) * 100)}%`, background: '#f59e0b' }}></div>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="font-eyebrow text-[9px] text-muted-foreground">{epNum}</span>
          {ep.is_filler && showFiller && (
            <span className="font-eyebrow text-[8px] px-1 py-0.5 rounded bg-accent text-muted-foreground">FILLER</span>
          )}
          {stateBadge}
        </div>
        <div className="font-display text-base font-medium truncate" style={{ color: 'var(--foreground)' }}>{ep.name}</div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {ep.runtime && <span className="text-[10px] text-muted-foreground">{ep.runtime}m</span>}
          {showRatings && ep.imdb && <span className="text-[10px] text-muted-foreground">★ {ep.imdb}</span>}
        </div>
      </div>
      <div className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: ep.watched ? 'var(--primary)' : 'var(--border)' }}></div>
    </div>
  )
}

// ─── Standalone Episode — converted from renderStandaloneEpisode() ────────────

function StandaloneEpisode({ ep, showFiller, isSelected, onSelect }: {
  ep: Episode
  showFiller: boolean
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border my-1 cursor-pointer transition-colors${ep.watched ? ' opacity-60' : ''}${isSelected ? ' ep-card-selected' : ''}`}
      style={{ borderColor: 'var(--border)', borderStyle: 'dashed' }}
      data-global-ep={ep.global_episode}
      onClick={onSelect}
      onMouseOver={e => (e.currentTarget.style.background = 'color-mix(in oklch,var(--muted) 50%,transparent)')}
      onMouseOut={e => (e.currentTarget.style.background = isSelected ? '' : '')}>
      <div className="relative flex-shrink-0 rounded-lg overflow-hidden bg-muted" style={{ width: '80px', aspectRatio: '16/9' }}>
        {ep.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ep.thumbnail} alt="" className="w-full h-full object-cover object-center" loading="lazy" />
        )}
        {ep.watched && (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'color-mix(in oklch,var(--primary) 25%,transparent)' }}>
            <span className="font-bold" style={{ color: 'var(--primary)' }}>✓</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="font-eyebrow text-[9px] text-muted-foreground">EP {ep.episode} · STANDALONE</span>
          {ep.is_filler && showFiller && (
            <span className="font-eyebrow text-[8px] px-1 py-0.5 rounded bg-accent text-muted-foreground">FILLER</span>
          )}
        </div>
        <div className="font-display text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{ep.name}</div>
        {ep.runtime && <div className="text-[10px] text-muted-foreground mt-0.5">{ep.runtime}m</div>}
      </div>
      <div className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: ep.watched ? 'var(--primary)' : 'var(--border)' }}></div>
    </div>
  )
}

// ─── Movie Card — converted from renderMovieCard() ────────────────────────────

function MovieCard({ movie, isSelected, onSelect }: { movie: Episode; isSelected: boolean; onSelect: () => void }) {
  return (
    <div className="arc-block rounded-xl overflow-hidden my-2 mx-1"
      style={{
        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-strong)',
        background: isSelected ? 'color-mix(in oklab, var(--primary) 8%, var(--surface-elevated))' : 'var(--surface-elevated)',
      }}>
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onSelect}>
        <div className="relative flex-shrink-0 rounded-lg overflow-hidden bg-muted" style={{ width: '112px', aspectRatio: '16/9' }}>
          {movie.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={movie.thumbnail} alt="" className="w-full h-full object-cover object-center" loading="lazy" />
          )}
          {movie.watched && (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'color-mix(in oklch,var(--primary) 25%,transparent)' }}>
              <span className="font-bold" style={{ color: 'var(--primary)' }}>✓</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-eyebrow text-[9px] text-muted-foreground">🎬 MOVIE</span>
          </div>
          <div className="font-display text-base font-bold truncate">{movie.name}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{movie.runtime ? `${movie.runtime} min` : ''}</div>
        </div>
        <div className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: movie.watched ? 'var(--primary)' : 'var(--border)' }}></div>
      </div>
    </div>
  )
}

// ─── Episode Detail — converted from el-detail-content HTML + selectEpisode() ──

function EpisodeDetail({ ep, caseFiles, showRatings, showCrunchyroll, onMarkWatched, onWatchUpToHere, onSaveNotes, onSaveRating, onSaveProgress, onAddCaseFile, onRemoveCaseFile, onClose }: {
  ep: Episode
  caseFiles: CaseFile[]
  showRatings: boolean
  showCrunchyroll: boolean
  onMarkWatched: () => void
  onWatchUpToHere: () => void
  onSaveNotes: (notes: string) => void
  onSaveRating: (rating: number | null) => void
  onSaveProgress: (progress: number) => void
  onAddCaseFile: (cfId: string) => void
  onRemoveCaseFile: (cfId: string) => void
  onClose: () => void
}) {
  const [notes, setNotes]               = useState(ep.personal_notes || '')
  const [saveStatus, setSaveStatus]     = useState<'idle' | 'saving' | 'saved'>('idle')
  const [progress, setProgress]         = useState(ep.watch_progress ?? 0)
  const [cfSearchOpen, setCfSearchOpen] = useState(false)
  const [cfSearch, setCfSearch]         = useState('')
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── AI state ────────────────────────────────────────────────────────────────
  type NewCFEntry = { name: string; tag: string; overview?: Record<string,string>; notes?: Record<string,string> }
  const [aiStage,          setAiStage]          = useState<'closed'|'nokey'|'configure'|'loading'|'preview'|'done'>('closed')
  const [aiKey,            setAiKey]            = useState('')
  const [aiEntries,        setAiEntries]        = useState<NewCFEntry[]>([])
  const [aiChecked,        setAiChecked]        = useState<Set<number>>(new Set())
  const [aiError,          setAiError]          = useState('')
  const [aiCreating,       setAiCreating]       = useState(false)
  const [aiCreated,        setAiCreated]        = useState(0)
  const [aiAllEps,         setAiAllEps]         = useState<EpisodeForPrompt[]>([])
  const [aiCurrentGlobal,  setAiCurrentGlobal]  = useState(1)
  const [aiPrompt,         setAiPrompt]         = useState('')
  const [aiCopied,         setAiCopied]         = useState(false)
  const [aiManualResponse, setAiManualResponse] = useState('')
  const supabaseAI = createClient()

  useEffect(() => {
    setNotes(ep.personal_notes || '')
    setProgress(ep.watch_progress ?? 0)
    setSaveStatus('idle')
    setCfSearch('')
    setCfSearchOpen(false)
  }, [ep.id])

  function handleNotesChange(val: string) {
    setNotes(val)
    setSaveStatus('saving')
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      await onSaveNotes(val)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 1000)
  }

  function handleProgressChange(val: number) {
    setProgress(val)
    if (progressRef.current) clearTimeout(progressRef.current)
    progressRef.current = setTimeout(() => { onSaveProgress(val) }, 600)
  }

  async function openEpAIModal() {
    const { data: { user } } = await supabaseAI.auth.getUser()
    if (!user) return
    const { data: profile } = await supabaseAI.from('profiles').select('gemini_key').eq('id', user.id).single()
    const key = profile?.gemini_key || ''
    if (!key) { setAiStage('nokey'); return }
    setAiKey(key)

    const { data: eps } = await supabaseAI
      .from('episodes')
      .select('id, global_episode, series, episode, name, type, watched, personal_notes')
      .eq('user_id', user.id)
      .order('global_episode', { ascending: true })

    const fullEps: EpisodeForPrompt[] = (eps || []).map((e: Record<string,unknown>) => ({
      id: String(e.id), global_episode: Number(e.global_episode), series: String(e.series),
      episode: Number(e.episode), name: String(e.name), type: String(e.type),
      watched: Boolean(e.watched), personal_notes: e.personal_notes as string|null,
    }))

    const watchedEps = fullEps.filter(e => e.watched)
    const currentGlobal = watchedEps.length > 0 ? Math.max(...watchedEps.map(e => e.global_episode)) : 1

    setAiAllEps(fullEps)
    setAiCurrentGlobal(currentGlobal)
    setAiEntries([])
    setAiError('')
    setAiManualResponse('')

    // Build prompt immediately so Copy Prompt works right away
    const epForPrompt: EpisodeForPrompt = {
      id: ep.id, global_episode: ep.global_episode, series: ep.series,
      episode: ep.episode, name: ep.name, type: ep.type, watched: ep.watched,
      personal_notes: ep.personal_notes,
    }
    const cfsForPrompt: CaseFileForPrompt[] = caseFiles.map(c => ({
      id: c.id, name: c.name, tag: c.tag, summary: null, village: null, clan: null,
      group: null, rank: null, status: null, kekkei_genkai: null, voice_actor: null,
      jutsu_type: null, chakra_nature: null, group_type: null, group_type_other: null,
      affiliation: null, nation: null, kage_title: null, alliance_status: null,
      region_nation: null, location_type: null, location_type_other: null,
      event_type: null, event_type_other: null, outcome: null, arc: null, notes: null,
    }))
    const builtPrompt = buildEpisodeGenPrompt(epForPrompt, cfsForPrompt, fullEps, currentGlobal)
    setAiPrompt(builtPrompt)

    setAiStage('configure')
  }

  function processEpResponse(raw: string) {
    try {
      const parsed = parseAIResponse(raw)
      const entries: NewCFEntry[] = Array.isArray(parsed) ? parsed : (parsed ? [parsed as NewCFEntry] : [])
      setAiEntries(entries)
      setAiChecked(new Set(entries.map((_: NewCFEntry, i: number) => i)))
      setAiStage('preview')
    } catch (err) {
      console.error('AI parse error:', err)
      setAiError(err instanceof Error ? err.message : 'Unknown error')
      setAiStage('configure') // Always exit loading on error
    }
  }

  async function runEpAIGenerate() {
    setAiStage('loading')
    setAiError('')
    try {
      const epForPrompt: EpisodeForPrompt = {
        id: ep.id, global_episode: ep.global_episode, series: ep.series,
        episode: ep.episode, name: ep.name, type: ep.type, watched: ep.watched,
        personal_notes: ep.personal_notes,
      }
      const cfsForPrompt: CaseFileForPrompt[] = caseFiles.map(c => ({
        id: c.id, name: c.name, tag: c.tag, summary: null, village: null, clan: null,
        group: null, rank: null, status: null, kekkei_genkai: null, voice_actor: null,
        jutsu_type: null, chakra_nature: null, group_type: null, group_type_other: null,
        affiliation: null, nation: null, kage_title: null, alliance_status: null,
        region_nation: null, location_type: null, location_type_other: null,
        event_type: null, event_type_other: null, outcome: null, arc: null, notes: null,
      }))
      const prompt = buildEpisodeGenPrompt(epForPrompt, cfsForPrompt, aiAllEps, aiCurrentGlobal)
      setAiPrompt(prompt)
      const raw = await callGemini(prompt, aiKey)
      processEpResponse(raw)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unknown error')
      setAiStage('configure')
    }
  }

  async function runEpAIImport() {
    setAiCreating(true)
    setAiError('')

    const timeout = setTimeout(() => {
      setAiCreating(false)
      setAiError('Import timed out. Try again.')
      setAiStage('preview')
    }, 30000)

    try {
      const { data: { user }, error: userError } = await supabaseAI.auth.getUser()
      if (userError) throw new Error(userError.message)
      if (!user) throw new Error('Not authenticated')

      let created = 0
      const filesToCreate = aiEntries.filter((_: NewCFEntry, i: number) => aiChecked.has(i))

      for (const nf of filesToCreate) {
        if (!nf.name) continue
        const exists = caseFiles.find(c => c.name.toLowerCase() === nf.name.toLowerCase())
        if (exists) continue
        const newCFData: Record<string, unknown> = { id: crypto.randomUUID(), name: nf.name, tag: nf.tag || 'other', user_id: user.id, created_at: new Date().toISOString() }
        if (nf.overview) {
          Object.entries(nf.overview).forEach(([k, v]) => {
            const dbKey = AI_OVERVIEW_KEY_MAP_EP[k]
            if (dbKey && v && String(v).trim()) newCFData[dbKey] = String(v).trim()
          })
        }
        if (nf.notes) {
          const newSecs = getNoteSectionsAI(nf.tag || 'other')
          const notesObj: Record<string, string> = {}
          newSecs.forEach(s => {
            if (nf.notes![s.key]) notesObj[s.key] = epAiResolveLinks(nf.notes![s.key], caseFiles)
          })
          newCFData.notes = notesObj
        }
        const { data: inserted, error: insertError } = await supabaseAI
          .from('case_files').insert(newCFData).select('id').single()
        if (insertError) {
          console.error('Supabase insert error:', insertError)
          throw new Error(insertError.message)
        }
        if (inserted) {
          onAddCaseFile(inserted.id)
          created++
        }
      }

      setAiCreated(created)
      setAiStage('done')
    } catch (err) {
      console.error('AI import failed:', err)
      setAiError('Import failed: ' + (err instanceof Error ? err.message : String(err)))
      setAiStage('preview') // Return to preview so user can retry
    } finally {
      clearTimeout(timeout)
      setAiCreating(false)
    }
  }

  const isMovie      = ep.type === 'movie'
  const seriesLabel  = ep.series === 'naruto' ? 'Naruto' : 'Shippuden'
  const epLabel      = isMovie ? '🎬 Movie' : `${seriesLabel} Ep. ${ep.episode}`
  const eyebrow      = (epLabel + (ep.arc ? ' · ' + ep.arc : '')).toUpperCase()

  const trackedIds   = Array.isArray(ep.in_this_episode) ? ep.in_this_episode : []
  const trackedSet   = new Set(trackedIds)
  const trackedCFs   = trackedIds.map(id => caseFiles.find(c => c.id === id)).filter(Boolean) as CaseFile[]

  const q            = cfSearch.toLowerCase().trim()
  const searchResults = caseFiles
    .filter(c => !trackedSet.has(c.id) && (q === '' || c.name.toLowerCase().includes(q)))
    .slice(0, 16)

  return (
    <div className="p-6 space-y-5">

      {/* Thumbnail */}
      {ep.thumbnail && (
        <div className="rounded-xl overflow-hidden bg-muted" style={{ aspectRatio: '16/9' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ep.thumbnail} alt="" className="w-full h-full object-cover object-center" />
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="font-eyebrow text-[10px] text-muted-foreground">{eyebrow}</span>
          {ep.is_filler && (
            <span className="font-eyebrow text-[9px] px-2 py-0.5 rounded bg-accent text-muted-foreground">FILLER</span>
          )}
          {isMovie && (
            <span className="font-eyebrow text-[9px] px-2 py-0.5 rounded text-primary"
              style={{ background: 'color-mix(in oklch,var(--primary) 20%,transparent)' }}>🎬 MOVIE</span>
          )}
        </div>
        <h2 className="font-display text-lg font-bold leading-tight">{ep.name}</h2>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
          {ep.runtime && <span>{ep.runtime} min</span>}
          {ep.air_date && <span>{ep.air_date}</span>}
          {showRatings && ep.imdb && <span>★ {ep.imdb} TMDB</span>}
        </div>
      </div>

      {/* Overview */}
      {ep.overview && (
        <p className="text-sm text-muted-foreground leading-relaxed">{ep.overview}</p>
      )}

      {/* Watch action row */}
      <div className="flex gap-2 items-center flex-wrap">
        <button onClick={onMarkWatched}
          className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium shadow-glow transition-opacity"
          style={{ opacity: ep.watched ? 0.65 : 1, border: 'none', minWidth: '120px' }}>
          {ep.watched ? '✓ Watched' : 'Mark Watched'}
        </button>
        {!ep.watched && !isMovie && (
          <button onClick={onWatchUpToHere}
            className="px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors flex-shrink-0"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
            Watch up to here
          </button>
        )}
        {showCrunchyroll && !ep.watched && ep.crunchyroll && (
          <a href={ep.crunchyroll} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors flex-shrink-0"
            style={{ borderColor: '#F47521', color: '#F47521', textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/crunchrollimage.png" alt="" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
            <span>Watch</span>
          </a>
        )}
      </div>

      {/* Personal Rating */}
      <div>
        <div className="font-eyebrow text-[9px] mb-2" style={{ color: 'var(--muted-foreground)' }}>YOUR RATING</div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={10}
            step={0.1}
            value={ep.personal_rating ?? ''}
            onChange={e => {
              const val = e.target.value === '' ? null : Math.min(10, Math.max(1, parseFloat(e.target.value)))
              onSaveRating(val)
            }}
            placeholder="—"
            className="w-20 rounded-xl border px-3 py-2 text-sm text-center font-bold"
            style={{
              borderColor: ep.personal_rating ? 'var(--primary)' : 'var(--border)',
              background: 'var(--muted)',
              color: ep.personal_rating ? 'var(--primary)' : 'var(--foreground)',
              outline: 'none',
            }}
          />
          {ep.personal_rating && (
            <>
              <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--muted)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${(ep.personal_rating / 10) * 100}%`, background: 'var(--primary)' }} />
              </div>
              <button onClick={() => onSaveRating(null)}
                className="text-xs hover:opacity-60"
                style={{ color: 'var(--muted-foreground)' }}>✕</button>
            </>
          )}
        </div>
      </div>

      {/* Watch Progress — only when not fully watched */}
      {!ep.watched && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="font-eyebrow text-[9px]" style={{ color: 'var(--muted-foreground)' }}>WATCH PROGRESS</div>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {progress}m / {ep.runtime || 24}m
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={ep.runtime || 24}
            step={1}
            value={progress}
            onChange={e => handleProgressChange(parseInt(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: 'var(--primary)' }}
          />
          <div className="flex justify-between text-[9px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            <span>0m</span>
            <span>{ep.runtime || 24}m</span>
          </div>
        </div>
      )}

      {/* Case Files tracker — matches char-tracker HTML */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="font-eyebrow text-[10px] text-muted-foreground">CASE FILES IN THIS EPISODE</div>
          <button onClick={() => { setCfSearchOpen(v => !v); setCfSearch('') }}
            className="text-[10px] text-primary font-medium hover:opacity-80">
            {cfSearchOpen ? '✕ Close' : '+ Add'}
          </button>
        </div>

        {/* chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {trackedCFs.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">No case files tracked yet</span>
          ) : trackedCFs.map(cf => (
            <span key={cf.id}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
              style={{
                background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
                color: 'var(--foreground)',
                border: '1px solid color-mix(in oklch, var(--primary) 30%, transparent)',
              }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: TAG_COLORS[cf.tag] || '#8A93A8', flexShrink: 0, display: 'inline-block' }} />
              {cf.name}
              <button onClick={() => onRemoveCaseFile(cf.id)}
                style={{ opacity: .5, fontSize: '.9rem', lineHeight: 1, marginLeft: '.1rem' }} title="Remove">×</button>
            </span>
          ))}
        </div>

        {/* search box */}
        {cfSearchOpen && (
          <div>
            <input type="text" value={cfSearch} onChange={e => setCfSearch(e.target.value)}
              placeholder="Search case files…" autoFocus
              className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm focus:outline-none focus:border-primary"
              style={{ color: 'var(--foreground)' }} />
            <div className="mt-1 rounded-xl border border-border bg-surface max-h-40 overflow-y-auto">
              {searchResults.length === 0 ? (
                <p className="text-xs text-muted-foreground px-3 py-2 italic">
                  {caseFiles.length === 0 ? 'No case files found. Create them in Case Files first.' : 'No case files found.'}
                </p>
              ) : searchResults.map(cf => {
                const initials = cf.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <button key={cf.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
                    onClick={() => { onAddCaseFile(cf.id); setCfSearch('') }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: TAG_COLORS[cf.tag] || '#8A93A8', flexShrink: 0 }} />
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.6rem', fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                      {cf.image
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={cf.image} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        : initials}
                    </div>
                    <span>{cf.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Personal Notes — autosave with 1s debounce */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="font-eyebrow text-[10px] text-muted-foreground">PERSONAL NOTES</div>
          {saveStatus === 'saving' && <span className="text-[9px] text-muted-foreground">Saving…</span>}
          {saveStatus === 'saved'  && <span className="text-[9px] text-primary">Saved ✓</span>}
        </div>
        <textarea
          rows={4}
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Your thoughts, reactions, theories…"
          className="w-full rounded-xl border border-border bg-muted p-3 text-sm resize-none focus:outline-none focus:border-primary"
          style={{ color: 'var(--foreground)' }}
        />
      </div>

      {/* ✦ Generate Case Files button — only for watched eps or eps with notes */}
      {(ep.watched || (ep.personal_notes && ep.personal_notes.trim())) && !isMovie && (
        <button
          onClick={openEpAIModal}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-sm font-medium transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--primary)', background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
          onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
          ✦ Generate Case Files
        </button>
      )}

      {/* ── Episode AI Modal ──────────────────────────────────────────────────── */}
      {aiStage !== 'closed' && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setAiStage('closed') }}
        >
          <div style={{ background: 'var(--surface)', borderRadius: '1.25rem', border: '1px solid var(--border)', width: '100%', maxWidth: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-soft)' }}>

            {/* Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="font-eyebrow text-[9px]" style={{ color: 'var(--primary)', marginBottom: '0.15rem' }}>GENERATE CASE FILES</div>
                <h3 className="font-display font-bold text-base" style={{ color: 'var(--foreground)' }}>{ep.name}</h3>
              </div>
              <button onClick={() => setAiStage('closed')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              {aiStage === 'nokey' && (
                <>
                  <div style={{ textAlign: 'center', fontSize: '2rem' }}>✦</div>
                  <p className="text-sm" style={{ color: 'var(--foreground)', textAlign: 'center' }}>No Gemini API key configured.</p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.6 }}>Add your free key in Settings to use AI generation.</p>
                </>
              )}

              {aiStage === 'configure' && (
                <>
                  <div style={{ borderRadius: '0.75rem', padding: '0.75rem 1rem', background: 'color-mix(in oklab, var(--primary) 10%, var(--surface))', border: '1px solid color-mix(in oklab, var(--primary) 30%, transparent)', fontSize: '0.8rem', color: 'var(--foreground)', display: 'flex', gap: '0.5rem' }}>
                    <span style={{ color: 'var(--primary)' }}>🛡</span>
                    <span>Spoiler protection: AI will only use info up to episode {aiCurrentGlobal}.</span>
                  </div>
                  <div style={{ borderRadius: '0.875rem', border: '1px solid var(--border)', padding: '1rem', background: 'var(--muted)', fontSize: '0.8rem', color: 'var(--foreground)', lineHeight: 1.6 }}>
                    <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>WHAT THIS DOES</div>
                    Looks at your episode notes and suggests <strong>new case files</strong> for characters, jutsu, locations and other subjects that appeared in this episode but don't have a file yet.
                    <div className="mt-2 text-xs" style={{ color: 'var(--muted-foreground)' }}>Will NOT update existing case files. Use the ✦ AI button on individual case files to update them.</div>
                  </div>
                  {ep.personal_notes && ep.personal_notes.trim() && (
                    <div>
                      <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>YOUR EPISODE NOTES</div>
                      <div className="text-sm rounded-xl border p-3" style={{ borderColor: 'var(--border)', color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>{ep.personal_notes.trim()}</div>
                    </div>
                  )}
                  {!ep.personal_notes?.trim() && (
                    <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No personal notes recorded — return an empty array will be generated if notes are absent.</div>
                  )}
                  {aiError && (
                    <div style={{ borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.8rem', background: 'color-mix(in oklab, #ef4444 10%, var(--surface))', border: '1px solid color-mix(in oklab, #ef4444 30%, transparent)', color: 'var(--foreground)' }}>
                      <strong>Error:</strong> {aiError}
                    </div>
                  )}
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{caseFiles.length} case files in your system. AI will avoid creating duplicates.</div>

                  {/* Copy Prompt + Paste Response */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <button
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(aiPrompt) } catch {
                          const ta = document.createElement('textarea')
                          ta.value = aiPrompt; ta.style.cssText = 'position:fixed;opacity:0'
                          document.body.appendChild(ta); ta.select()
                          document.execCommand('copy'); document.body.removeChild(ta)
                        }
                        setAiCopied(true)
                        setTimeout(() => setAiCopied(false), 2000)
                      }}
                      className="w-full py-2 rounded-xl text-sm font-medium border"
                      style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'transparent', cursor: 'pointer' }}>
                      {aiCopied ? '✓ Copied!' : '📋 Copy Prompt'}
                    </button>

                    <details>
                      <summary className="text-xs cursor-pointer" style={{ color: 'var(--muted-foreground)', userSelect: 'none' }}>
                        Paste response manually
                      </summary>
                      <textarea
                        value={aiManualResponse}
                        onChange={e => setAiManualResponse(e.target.value)}
                        placeholder="Paste Gemini response here…"
                        rows={6}
                        className="w-full mt-2 rounded-xl border px-3 py-2 text-xs font-mono resize-none focus:outline-none"
                        style={{ borderColor: 'var(--border)', background: 'var(--muted)', color: 'var(--foreground)' }}
                      />
                      <button
                        onClick={() => processEpResponse(aiManualResponse)}
                        disabled={!aiManualResponse.trim()}
                        className="w-full mt-2 py-2 rounded-xl text-sm font-medium"
                        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', cursor: aiManualResponse.trim() ? 'pointer' : 'default', opacity: aiManualResponse.trim() ? 1 : 0.5 }}>
                        Import Pasted Response
                      </button>
                    </details>
                  </div>
                </>
              )}

              {aiStage === 'loading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '1rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent' }} className="animate-spin" />
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Generating…</div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Analysing episode and checking existing case files</div>
                </div>
              )}

              {aiStage === 'preview' && (
                <>
                  {aiError && (
                    <div style={{ borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.8rem', background: 'color-mix(in oklab, #ef4444 10%, var(--surface))', border: '1px solid color-mix(in oklab, #ef4444 30%, transparent)', color: 'var(--foreground)' }}>
                      <strong>Error:</strong> {aiError}
                    </div>
                  )}
                  {aiEntries.length === 0 ? (
                    <p className="text-sm text-center" style={{ color: 'var(--muted-foreground)', padding: '2rem 0' }}>No new case files to create for this episode.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>NEW CASE FILES</div>
                      {aiEntries.map((nf, i) => (
                        <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.75rem', border: '1px solid var(--border)', padding: '0.625rem 0.875rem', cursor: 'pointer' }}>
                          <input type="checkbox" checked={aiChecked.has(i)} onChange={e => {
                            setAiChecked(prev => {
                              const next = new Set(prev)
                              if (e.target.checked) next.add(i); else next.delete(i)
                              return next
                            })
                          }} />
                          <div>
                            <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{nf.name}</span>
                            <span className="font-eyebrow text-[9px] ml-2" style={{ color: 'var(--muted-foreground)' }}>{nf.tag}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}

              {aiStage === 'done' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 0', gap: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem' }}>✦</div>
                  <h3 className="font-display font-bold text-lg" style={{ color: 'var(--foreground)' }}>Import Complete</h3>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {aiCreated} new case file{aiCreated !== 1 ? 's' : ''} created
                    {aiCreated > 0 ? ' and linked to this episode' : ''}
                  </p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.625rem' }}>
              {aiStage === 'nokey' && (
                <>
                  <button onClick={() => setAiStage('closed')} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>Close</button>
                  <a href="/settings" style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Go to Settings</a>
                </>
              )}
              {aiStage === 'configure' && (
                <>
                  <button onClick={() => setAiStage('closed')} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={runEpAIGenerate} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>✦ Generate via API</button>
                </>
              )}
              {aiStage === 'preview' && (
                <>
                  <button onClick={() => setAiStage('configure')} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>← Back</button>
                  <button onClick={runEpAIImport} disabled={aiCreating || aiEntries.length === 0} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.875rem', fontWeight: 600, cursor: (aiCreating || aiEntries.length === 0) ? 'default' : 'pointer', opacity: (aiCreating || aiEntries.length === 0) ? 0.7 : 1 }}>{aiCreating ? 'Creating…' : '✦ Create Selected'}</button>
                </>
              )}
              {aiStage === 'done' && (
                <button onClick={() => setAiStage('closed')} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>Done</button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEpisodeState(ep: Episode, episodes: Episode[]): 'watched' | 'up-next' | 'in-progress' | 'normal' {
  if (ep.watched) return 'watched'
  if ((ep.watch_progress ?? 0) > 0) return 'in-progress'
  // up-next = first unwatched episode in the series
  const firstUnwatched = episodes
    .filter(e => e.series === ep.series && !e.watched)
    .sort((a, b) => a.global_episode - b.global_episode)[0]
  if (firstUnwatched && firstUnwatched.global_episode === ep.global_episode) return 'up-next'
  return 'normal'
}
