'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import FightPanel from '@/components/FightPanel'

type Fight = {
  id: string
  title: string
  image: string | null
  team_a: string[]
  team_b: string[]
  team_c: string[]
  winner: string | null
  deaths: string[]
  episode_global: number | null
  episode_name: string | null
  episode_series: string | null
  episode_num: number | null
  arc: string | null
  rating: number | null
  notes: string
  created_at: string
}

type CF = { id: string; name: string; tag: string; image: string | null }
type Ep = { id: string; global_episode: number; episode: number; series: string; name: string; arc: string | null }

const EMPTY_FIGHT = (): Omit<Fight, 'id' | 'created_at'> => ({
  title: '', image: null, team_a: [], team_b: [], team_c: [],
  winner: null, deaths: [],
  episode_global: null, episode_name: null, episode_series: null, episode_num: null,
  arc: null, rating: null, notes: '',
})

export default function FightsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [fights,     setFights]     = useState<Fight[]>([])
  const [caseFiles,  setCaseFiles]  = useState<CF[]>([])
  const [episodes,   setEpisodes]   = useState<Ep[]>([])
  const [selected,   setSelected]   = useState<Fight | null>(null)
  const [isEditing,  setIsEditing]  = useState(false)
  const [search,     setSearch]     = useState('')
  const [sort,       setSort]       = useState<'newest' | 'oldest' | 'rating'>('newest')
  const [loading,    setLoading]    = useState(true)
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: f }, { data: cf }, { data: ep }] = await Promise.all([
      supabase.from('fights').select('*').order('created_at', { ascending: false }),
      supabase.from('case_files').select('id, name, tag, image').order('name'),
      supabase.from('episodes').select('id, global_episode, episode, series, name, arc').order('global_episode'),
    ])
    setFights(f || [])
    setCaseFiles(cf || [])
    setEpisodes(ep || [])
    setLoading(false)
  }

  function createFight() {
    const temp: Fight = {
      ...EMPTY_FIGHT(),
      id: `temp_${Date.now()}`,
      created_at: new Date().toISOString(),
    }
    setSelected(temp)
    setIsEditing(true)
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileView('detail')
    }
  }

  function navigateToCF(cfId: string) {
    const cf = caseFiles.find(c => c.id === cfId)
    if (!cf) return
    router.push(`/casefiles/${cf.tag}`)
  }

  function navigateToEp(series: string, epGlobal: number) {
    router.push(`/episodes?series=${series}&ep=${epGlobal}`)
  }

  async function saveFight(draft: Fight) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (draft.id.startsWith('temp_')) {
      // Insert new fight
      const { data, error } = await supabase
        .from('fights')
        .insert({
          id:             `fight_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          user_id: user.id,
          title:          draft.title,
          image:          draft.image,
          team_a:         draft.team_a,
          team_b:         draft.team_b,
          team_c:         draft.team_c,
          winner:         draft.winner,
          deaths:         draft.deaths,
          episode_global: draft.episode_global,
          episode_name:   draft.episode_name,
          episode_series: draft.episode_series,
          episode_num:    draft.episode_num,
          arc:            draft.arc,
          rating:         draft.rating,
          notes:          draft.notes,
        })
        .select()
        .single()

      if (error) { console.error('Save failed:', JSON.stringify(error)); return }

      setFights(prev => [data, ...prev])
      setSelected(data)

      // Log activity
      await supabase.from('activity').insert({
        action: 'Added fight',
        name: draft.title || 'Untitled Fight',
        type: 'fight',
        user_id: user.id,
      }).then(() => {})  // fire-and-forget, ignore error

    } else {
      // Update existing fight
      const { error } = await supabase
        .from('fights')
        .update({
          title:          draft.title,
          image:          draft.image,
          team_a:         draft.team_a,
          team_b:         draft.team_b,
          team_c:         draft.team_c,
          winner:         draft.winner,
          deaths:         draft.deaths,
          episode_global: draft.episode_global,
          episode_name:   draft.episode_name,
          episode_series: draft.episode_series,
          episode_num:    draft.episode_num,
          arc:            draft.arc,
          rating:         draft.rating,
          notes:          draft.notes,
        })
        .eq('id', draft.id)

      if (error) { console.error('Update failed:', JSON.stringify(error)); return }

      setFights(prev => prev.map(f => f.id === draft.id ? draft : f))
      setSelected(draft)
    }

    setIsEditing(false)
  }

  async function deleteFight(id: string) {
    await supabase.from('fights').delete().eq('id', id)
    setFights(prev => prev.filter(f => f.id !== id))
    setSelected(null)
    setIsEditing(false)
  }

  const characters = caseFiles.filter(cf => cf.tag === 'characters')


  const filtered = fights
    .filter(f => !search.trim() ||
      f.title.toLowerCase().includes(search.toLowerCase()) ||
      (f.arc || '').toLowerCase().includes(search.toLowerCase()) ||
      [...(f.team_a || []), ...(f.team_b || []), ...(f.team_c || [])].some(n =>
        n.toLowerCase().includes(search.toLowerCase())
      )
    )
    .sort((a, b) => {
      if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      if (sort === 'rating') return (b.rating || 0) - (a.rating || 0)
      return 0
    })

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 57px)' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────────── */}
      <div className={`flex-col border-r flex-shrink-0 ${mobileView === 'detail' ? 'hidden md:flex' : 'flex w-full md:w-auto'}`}
        style={{ maxWidth: '380px', minWidth: '260px', borderColor: 'var(--border)', background: 'var(--surface)', width: mobileView === 'list' ? undefined : '35%' }}>

        {/* Header */}
        <div className="px-4 py-3 border-b flex-shrink-0 space-y-2"
          style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-eyebrow text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                FIGHT TRACKER
              </div>
              <div className="font-display font-bold text-lg" style={{ color: 'var(--foreground)' }}>
                {fights.length} fight{fights.length !== 1 ? 's' : ''}
              </div>
            </div>
            <button onClick={createFight}
              className="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm hover:opacity-80 transition-opacity"
              style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
              +
            </button>
          </div>

          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
              style={{ color: 'var(--muted-foreground)' }}>🔍</span>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search fights…"
              className="w-full rounded-xl border pl-8 pr-3 py-2 text-xs"
              style={{ borderColor: 'var(--border)', background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }}
              onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onBlur={e => (e.currentTarget.style.borderColor = '')} />
          </div>

          <select value={sort} onChange={e => setSort(e.target.value as 'newest' | 'oldest' | 'rating')}
            className="w-full rounded-xl border px-3 py-1.5 text-xs"
            style={{ borderColor: 'var(--border)', background: 'var(--muted)', color: 'var(--foreground)' }}>
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
              <div className="text-4xl mb-3">⚔️</div>
              <p className="font-display font-bold text-base mb-1" style={{ color: 'var(--foreground)' }}>
                {search ? 'No fights found' : 'No fights yet'}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                {search ? 'Try a different search' : 'Press + to record your first fight'}
              </p>
            </div>
          ) : filtered.map(fight => {
            const isSelected = selected?.id === fight.id
            const vsLabel = [
              (fight.team_a || []).slice(0, 2).join(' & '),
              (fight.team_b || []).slice(0, 2).join(' & '),
            ].filter(Boolean).join(' vs ')

            return (
              <button key={fight.id}
                className="w-full px-4 py-3 border-b text-left transition-colors hover:bg-muted/20"
                style={{
                  borderColor: 'var(--border)',
                  background: isSelected
                    ? 'color-mix(in oklab, var(--primary) 8%, var(--surface))'
                    : undefined,
                  borderLeft: isSelected
                    ? '3px solid var(--primary)'
                    : '3px solid transparent',
                }}
                onClick={() => {
                  setSelected(fight)
                  setIsEditing(false)
                  if (typeof window !== 'undefined' && window.innerWidth < 768) {
                    setMobileView('detail')
                  }
                }}>

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {fight.title || vsLabel || 'Untitled Fight'}
                    </div>
                    {vsLabel && fight.title && (
                      <div className="text-xs truncate mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                        {vsLabel}
                      </div>
                    )}
                    <div className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap"
                      style={{ color: 'var(--muted-foreground)' }}>
                      {fight.arc && <span>{fight.arc}</span>}
                      {fight.rating && <span>· ★ {fight.rating}</span>}
                    </div>
                    {fight.winner && (
                      <div className="text-[10px] mt-0.5 font-eyebrow" style={{ color: 'var(--primary)' }}>
                        Winner: {fight.winner}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────────── */}
      <div className={`overflow-y-auto flex-col ${mobileView === 'list' ? 'hidden md:flex flex-1' : 'flex flex-1'}`}>
        {/* Mobile back button */}
        {mobileView === 'detail' && (
          <button onClick={() => { setMobileView('list'); setSelected(null); setIsEditing(false) }}
            className="md:hidden flex items-center gap-2 px-4 py-3 border-b text-sm font-medium flex-shrink-0"
            style={{ borderColor: 'var(--border)', color: 'var(--primary)', background: 'var(--surface)' }}>
            ← Fights
          </button>
        )}
        {selected ? (
          <FightPanel
            fight={selected}
            characters={characters}
            caseFiles={caseFiles}
            episodes={episodes}
            isEditing={isEditing}
            onEdit={() => setIsEditing(true)}
            onCancel={() => {
              if (selected.id.startsWith('temp_')) {
                setSelected(null)
              }
              setIsEditing(false)
            }}
            onSave={saveFight}
            onDelete={() => deleteFight(selected.id)}
            navigateToCF={navigateToCF}
            navigateToEp={navigateToEp}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-center p-8">
            <div>
              <div className="text-5xl mb-4">⚔️</div>
              <p className="font-display font-bold text-xl mb-2" style={{ color: 'var(--foreground)' }}>
                Select a fight
              </p>
              <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                Choose from the list or press + to add a new one
              </p>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
