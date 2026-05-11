'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ─── Types ──────────────────────────────────────────────────────────────────── */

type TopCharacter = {
  cfId: string
  cfName: string
  cfImage: string | null
  notes: string
}

type BestMoment = {
  id: string
  moment: string
  epGlobal: number | null
  epName: string | null
  epSeries: string | null
  epNum: number | null
  cfId: string | null
  cfName: string | null
  cfImage: string | null
  notes: string
}

type Quote = {
  id: string
  quote: string
  cfId: string | null
  cfName: string | null
  cfImage: string | null
  epGlobal: number | null
  epName: string | null
  epSeries: string | null
  epNum: number | null
  notes: string
}

type Theory = {
  id: string
  theory: string
  why: string
  epGlobal: number | null
  epName: string | null
  epSeries: string | null
  epNum: number | null
  status: 'ongoing' | 'correct' | 'wrong'
}

type BestFight = {
  fightId: string
  fightTitle: string
  fightImage: string | null
  teamA: string[]
  teamB: string[]
  teamC: string[]
  epGlobal: number | null
  epName: string | null
  epSeries: string | null
  epNum: number | null
  arc: string | null
  notes: string
}

type Rankings = {
  top_characters: TopCharacter[]
  best_moments: BestMoment[]
  quotes_vault: Quote[]
  theory_log: Theory[]
  best_fights: BestFight[]
}

/* ─── Constants ──────────────────────────────────────────────────────────────── */

const EMPTY: Rankings = {
  top_characters: [],
  best_moments: [],
  quotes_vault: [],
  theory_log: [],
  best_fights: [],
}

const SECTIONS = [
  { key: 'top-characters', label: '★ Top Characters' },
  { key: 'best-moments',   label: '✦ Best Moments' },
  { key: 'quotes-vault',   label: '" Quotes Vault' },
  { key: 'theory-log',     label: '? Theory Log' },
  { key: 'best-fights',    label: '⚔ Best Fights' },
]

/* ─── Page ───────────────────────────────────────────────────────────────────── */

export default function RankingsPage() {
  const supabase = createClient()
  const router   = useRouter()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rankings,      setRankings]      = useState<Rankings>(EMPTY)
  const [caseFiles,     setCaseFiles]     = useState<any[]>([])  // eslint-disable-line @typescript-eslint/no-explicit-any
  const [episodes,      setEpisodes]      = useState<any[]>([])  // eslint-disable-line @typescript-eslint/no-explicit-any
  const [fights,        setFights]        = useState<any[]>([])  // eslint-disable-line @typescript-eslint/no-explicit-any
  const [loading,       setLoading]       = useState(true)
  const [addingSection, setAddingSection] = useState<string | null>(null)
  const [editingEntry,  setEditingEntry]  = useState<string | null>(null)

  useEffect(() => { loadData() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    const [{ data: r }, { data: cf }, { data: ep }, { data: f }] = await Promise.all([
      supabase.from('rankings').select('*').single(),
      supabase.from('case_files').select('id, name, tag, image').order('name'),
      supabase.from('episodes').select('id, global_episode, episode, series, name, arc').order('global_episode'),
      supabase.from('fights').select('id, title, image, team_a, team_b, team_c, episode_global, episode_name, episode_series, episode_num, arc').order('created_at', { ascending: false }),
    ])
    if (r) setRankings({ ...EMPTY, ...r })
    setCaseFiles(cf || [])
    setEpisodes(ep || [])
    setFights(f || [])
    setLoading(false)
  }

  async function save(updated: Rankings) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: existing } = await supabase.from('rankings').select('id').eq('user_id', user.id).single()
    if (existing) {
      const { error } = await supabase.from('rankings').update({
        top_characters: updated.top_characters,
        best_moments:   updated.best_moments,
        quotes_vault:   updated.quotes_vault,
        theory_log:     updated.theory_log,
        best_fights:    updated.best_fights,
        updated_at:     new Date().toISOString(),
      }).eq('user_id', user.id)
      if (error) console.error('Rankings update failed:', JSON.stringify(error))
    } else {
      const { error } = await supabase.from('rankings').insert({
        user_id: user.id, ...updated,
      })
      if (error) console.error('Rankings insert failed:', JSON.stringify(error))
    }
    setRankings(updated)
  }

  function goToEpisode(globalEp: number, series: string) {
    router.push(`/episodes?series=${series}&ep=${globalEp}`)
  }

  function goToCF(cfId: string, tag: string) {
    router.push(`/casefiles/${tag}?selected=${cfId}`)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const characters = caseFiles.filter((cf: any) => cf.tag === 'characters')

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 57px)' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  const shared = {
    rankings, caseFiles, characters, episodes, fights,
    save, goToEpisode, goToCF,
    addingSection, setAddingSection,
    editingEntry,  setEditingEntry,
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>

      {/* Sticky section nav */}
      <div className="flex-shrink-0 overflow-x-auto scrollbar-hide border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="flex gap-1 min-w-max px-4 py-2">
          {SECTIONS.map(s => (
            <button key={s.key}
              onClick={() => document.getElementById(s.key)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors hover:opacity-80"
              style={{ color: 'var(--foreground)', background: 'var(--muted)', border: 'none', cursor: 'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-12">
        <div id="top-characters"><TopCharacters {...shared} /></div>
        <div id="best-moments"><BestMoments {...shared} /></div>
        <div id="quotes-vault"><QuotesVault {...shared} /></div>
        <div id="theory-log"><TheoryLog {...shared} /></div>
        <div id="best-fights"><BestFights {...shared} /></div>
        <div style={{ height: '4rem' }} />
      </div>

    </div>
  )
}

/* ─── Top Characters ─────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TopCharacters({ rankings, characters, save, goToCF, addingSection, setAddingSection, editingEntry, setEditingEntry }: any) {
  const dragIdx = useRef<number | null>(null)
  const data: TopCharacter[] = rankings.top_characters || []

  function handleDragStart(idx: number) { dragIdx.current = idx }
  function handleDrop(idx: number) {
    if (dragIdx.current === null || dragIdx.current === idx) return
    const next = [...data]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(idx, 0, moved)
    save({ ...rankings, top_characters: next })
    dragIdx.current = null
  }

  const isAdding = addingSection === 'top-characters'

  return (
    <Section
      title="Top Characters"
      subtitle="Your personal top 3 — drag to reorder"
      count={`${data.length}/3`}
      onAdd={() => { setAddingSection('top-characters'); setEditingEntry(null) }}
      canAdd={data.length < 3 && !isAdding}>

      <div className="space-y-3">
        {data.map((char, idx) => (
          <div key={char.cfId}
            draggable={editingEntry !== char.cfId}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className="rounded-xl border p-4 group"
            style={{
              borderColor: editingEntry === char.cfId ? 'var(--primary)' : 'var(--border)',
              background: 'var(--muted)',
              cursor: editingEntry === char.cfId ? 'default' : 'grab',
            }}>

            {editingEntry === char.cfId ? (
              <EditCharacterEntry
                char={char}
                onSave={(updated: any) => {  // eslint-disable-line @typescript-eslint/no-explicit-any
                  save({ ...rankings, top_characters: data.map(c => c.cfId === char.cfId ? updated : c) })
                  setEditingEntry(null)
                }}
                onDelete={() => {
                  save({ ...rankings, top_characters: data.filter(c => c.cfId !== char.cfId) })
                  setEditingEntry(null)
                }}
                onCancel={() => setEditingEntry(null)}
              />
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-2xl w-8 text-center flex-shrink-0"
                    style={{ color: 'var(--primary)' }}>#{idx + 1}</span>
                  <Avatar image={char.cfImage} name={char.cfName} size={48} />
                  <button onClick={() => goToCF(char.cfId, 'characters')}
                    className="flex-1 text-left font-display font-bold text-lg hover:opacity-80"
                    style={{ color: 'var(--foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    {char.cfName}
                  </button>
                  <button
                    onClick={() => { setEditingEntry(char.cfId); setAddingSection(null) }}
                    className="text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ color: 'var(--muted-foreground)', background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    ✎
                  </button>
                </div>
                {char.notes && (
                  <p className="text-xs mt-2 ml-11" style={{ color: 'var(--muted-foreground)' }}>{char.notes}</p>
                )}
              </>
            )}
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: Math.max(0, 3 - data.length) }).map((_, i) => (
          <div key={i} className="rounded-xl border border-dashed p-4 flex items-center gap-3"
            style={{ borderColor: 'var(--border)' }}>
            <span className="font-display font-bold text-2xl w-8 text-center flex-shrink-0"
              style={{ color: 'var(--muted-foreground)' }}>#{data.length + i + 1}</span>
            <div className="w-12 h-12 rounded-xl flex-shrink-0" style={{ background: 'var(--muted)' }} />
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Empty slot</span>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="mt-4">
          <AddCharacterForm
            characters={characters}
            existing={data}
            onAdd={(entry: any) => { save({ ...rankings, top_characters: [...data, entry] }); setAddingSection(null) }}
            onCancel={() => setAddingSection(null)}
          />
        </div>
      )}
    </Section>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditCharacterEntry({ char, onSave, onDelete, onCancel }: any) {
  const [notes, setNotes] = useState(char.notes || '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 opacity-60">
        <Avatar image={char.cfImage} name={char.cfName} size={36} />
        <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>{char.cfName}</span>
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Notes about this character…" rows={3} autoFocus
        className="w-full rounded-xl border px-3 py-2 text-xs resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
      <EntryActions
        confirmDelete={confirmDelete}
        onSave={() => onSave({ ...char, notes })}
        onDelete={onDelete}
        onCancel={onCancel}
        onConfirmDelete={() => setConfirmDelete(true)}
        onCancelDelete={() => setConfirmDelete(false)}
      />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AddCharacterForm({ characters, existing, onAdd, onCancel }: any) {
  const [search, setSearch] = useState('')
  const [selChar, setSelChar] = useState<any>(null)  // eslint-disable-line @typescript-eslint/no-explicit-any
  const [notes, setNotes] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = search.trim() && !selChar
    ? characters.filter((c: any) =>  // eslint-disable-line @typescript-eslint/no-explicit-any
        c.name.toLowerCase().includes(search.toLowerCase()) &&
        !existing.find((e: any) => e.cfId === c.id)  // eslint-disable-line @typescript-eslint/no-explicit-any
      ).slice(0, 8)
    : []

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--primary)', background: 'var(--muted)' }}>
      <div className="relative">
        <input type="text"
          value={selChar ? selChar.name : search}
          onChange={e => { if (selChar) { setSelChar(null); setSearch('') } else { setSearch(e.target.value) } }}
          placeholder="Search character case files…"
          autoFocus
          className="w-full rounded-xl border px-3 py-2 text-sm"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {selChar && (
          <button onClick={() => { setSelChar(null); setSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
        {results.length > 0 && (
          <ResultsDropdown>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {results.map((c: any) => (
              <ResultItem key={c.id} onClick={() => { setSelChar(c); setSearch('') }}>
                <Avatar image={c.image} name={c.name} size={20} />
                {c.name}
              </ResultItem>
            ))}
          </ResultsDropdown>
        )}
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Notes (optional)…" rows={2}
        className="w-full rounded-xl border px-3 py-2 text-xs resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-xs border"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer' }}>
          Cancel
        </button>
        <button
          onClick={() => selChar && onAdd({ cfId: selChar.id, cfName: selChar.name, cfImage: selChar.image, notes })}
          disabled={!selChar}
          className="flex-1 py-2 rounded-xl text-xs font-medium"
          style={{ background: 'var(--primary)', color: 'white', border: 'none', opacity: selChar ? 1 : 0.5, cursor: selChar ? 'pointer' : 'default' }}>
          Add Character
        </button>
      </div>
    </div>
  )
}

/* ─── Best Moments ───────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BestMoments({ rankings, characters, episodes, save, goToEpisode, goToCF, addingSection, setAddingSection, editingEntry, setEditingEntry }: any) {
  const dragIdx = useRef<number | null>(null)
  const data: BestMoment[] = rankings.best_moments || []

  function handleDragStart(idx: number) { dragIdx.current = idx }
  function handleDrop(idx: number) {
    if (dragIdx.current === null || dragIdx.current === idx) return
    const next = [...data]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(idx, 0, moved)
    save({ ...rankings, best_moments: next })
    dragIdx.current = null
  }

  const isAdding = addingSection === 'best-moments'

  return (
    <Section
      title="Best Moments"
      subtitle="Your top 3 most memorable moments — drag to reorder"
      count={`${data.length}/3`}
      onAdd={() => { setAddingSection('best-moments'); setEditingEntry(null) }}
      canAdd={data.length < 3 && !isAdding}>

      <div className="space-y-3">
        {data.map((m, idx) => (
          <div key={m.id}
            draggable={editingEntry !== m.id}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className="rounded-xl border p-4 group"
            style={{
              borderColor: editingEntry === m.id ? 'var(--primary)' : 'var(--border)',
              background: 'var(--muted)',
              cursor: editingEntry === m.id ? 'default' : 'grab',
            }}>

            {editingEntry === m.id ? (
              <EditMomentEntry
                moment={m}
                characters={characters}
                episodes={episodes}
                onSave={(updated: any) => {  // eslint-disable-line @typescript-eslint/no-explicit-any
                  save({ ...rankings, best_moments: data.map(x => x.id === m.id ? updated : x) })
                  setEditingEntry(null)
                }}
                onDelete={() => {
                  save({ ...rankings, best_moments: data.filter(x => x.id !== m.id) })
                  setEditingEntry(null)
                }}
                onCancel={() => setEditingEntry(null)}
              />
            ) : (
              <div className="flex items-start gap-3">
                <span className="font-display font-bold text-2xl w-8 text-center flex-shrink-0 mt-0.5"
                  style={{ color: 'var(--primary)' }}>#{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm mb-2" style={{ color: 'var(--foreground)' }}>{m.moment}</div>
                  <div className="flex flex-wrap gap-2 mb-1">
                    {m.cfName && (
                      <button onClick={() => m.cfId && goToCF(m.cfId, 'characters')}
                        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border hover:opacity-80"
                        style={{ borderColor: '#b45000', background: 'color-mix(in oklab, #b45000 12%, var(--surface))', color: '#b45000', cursor: 'pointer' }}>
                        <Avatar image={m.cfImage} name={m.cfName} size={16} />
                        {m.cfName}
                      </button>
                    )}
                    {m.epName && (
                      <button onClick={() => m.epGlobal && goToEpisode(m.epGlobal, m.epSeries)}
                        className="text-xs px-2 py-1 rounded-lg border hover:opacity-80"
                        style={{ borderColor: 'var(--primary)', background: 'color-mix(in oklab, var(--primary) 12%, var(--surface))', color: 'var(--primary)', cursor: 'pointer' }}>
                        📺 {m.epSeries === 'naruto' ? 'N' : 'S'} · Ep {m.epNum} · {m.epName}
                      </button>
                    )}
                  </div>
                  {m.notes && <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{m.notes}</p>}
                </div>
                <button onClick={() => { setEditingEntry(m.id); setAddingSection(null) }}
                  className="text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  style={{ color: 'var(--muted-foreground)', background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                  ✎
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="mt-4">
          <MomentAddForm
            characters={characters}
            episodes={episodes}
            onAdd={(entry: any) => { save({ ...rankings, best_moments: [...data, { ...entry, id: `m_${Date.now()}` }] }); setAddingSection(null) }}
            onCancel={() => setAddingSection(null)}
          />
        </div>
      )}
    </Section>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditMomentEntry({ moment, characters, episodes, onSave, onDelete, onCancel }: any) {
  const [text, setText] = useState(moment.moment || '')
  const [notes, setNotes] = useState(moment.notes || '')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selEp, setSelEp] = useState<any>(
    moment.epName ? { global_episode: moment.epGlobal, name: moment.epName, series: moment.epSeries, episode: moment.epNum } : null
  )
  const [epSearch, setEpSearch] = useState(moment.epName || '')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selChar, setSelChar] = useState<any>(
    moment.cfName ? { id: moment.cfId, name: moment.cfName, image: moment.cfImage } : null
  )
  const [charSearch, setCharSearch] = useState(moment.cfName || '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const epResults = epSearch.trim() && !selEp
    ? episodes.filter((e: any) => e.name.toLowerCase().includes(epSearch.toLowerCase())).slice(0, 8)  // eslint-disable-line @typescript-eslint/no-explicit-any
    : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const charResults = charSearch.trim() && !selChar
    ? characters.filter((c: any) => c.name.toLowerCase().includes(charSearch.toLowerCase())).slice(0, 8)  // eslint-disable-line @typescript-eslint/no-explicit-any
    : []

  function handleSave() {
    onSave({
      ...moment,
      moment:   text.trim(),
      notes:    notes.trim(),
      epGlobal: selEp?.global_episode ?? null,
      epName:   selEp?.name ?? null,
      epSeries: selEp?.series ?? null,
      epNum:    selEp?.episode ?? null,
      cfId:     selChar?.id ?? null,
      cfName:   selChar?.name ?? null,
      cfImage:  selChar?.image ?? null,
    })
  }

  return (
    <div className="space-y-3">
      <input type="text" value={text} onChange={e => setText(e.target.value)}
        placeholder="Describe the moment…" autoFocus
        className="w-full rounded-xl border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />

      <div className="relative">
        <input type="text"
          value={selEp ? `${selEp.series === 'naruto' ? 'N' : 'S'} · Ep ${selEp.episode} · ${selEp.name}` : epSearch}
          onChange={e => { if (selEp) { setSelEp(null); setEpSearch('') } else { setEpSearch(e.target.value) } }}
          placeholder="Episode (optional)…"
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {selEp && (
          <button onClick={() => { setSelEp(null); setEpSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
        {epResults.length > 0 && (
          <ResultsDropdown>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {epResults.map((e: any) => (
              <ResultItem key={e.id} onClick={() => { setSelEp(e); setEpSearch('') }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{e.series === 'naruto' ? 'N' : 'S'} · Ep {e.episode}</span>
                {e.name}
              </ResultItem>
            ))}
          </ResultsDropdown>
        )}
      </div>

      <div className="relative">
        <input type="text"
          value={selChar ? selChar.name : charSearch}
          onChange={e => { if (selChar) { setSelChar(null); setCharSearch('') } else { setCharSearch(e.target.value) } }}
          placeholder="Associated character (optional)…"
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {selChar && (
          <button onClick={() => { setSelChar(null); setCharSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
        {charResults.length > 0 && (
          <ResultsDropdown>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {charResults.map((c: any) => (
              <ResultItem key={c.id} onClick={() => { setSelChar(c); setCharSearch('') }}>
                <Avatar image={c.image} name={c.name} size={20} />
                {c.name}
              </ResultItem>
            ))}
          </ResultsDropdown>
        )}
      </div>

      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)…" rows={2}
        className="w-full rounded-xl border px-3 py-2 text-xs resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
      <EntryActions confirmDelete={confirmDelete} onSave={handleSave} onDelete={onDelete} onCancel={onCancel}
        onConfirmDelete={() => setConfirmDelete(true)} onCancelDelete={() => setConfirmDelete(false)} />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MomentAddForm({ characters, episodes, onAdd, onCancel }: any) {
  const [text, setText] = useState('')
  const [notes, setNotes] = useState('')
  const [selEp, setSelEp] = useState<any>(null)  // eslint-disable-line @typescript-eslint/no-explicit-any
  const [epSearch, setEpSearch] = useState('')
  const [selChar, setSelChar] = useState<any>(null)  // eslint-disable-line @typescript-eslint/no-explicit-any
  const [charSearch, setCharSearch] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const epResults = epSearch.trim() && !selEp
    ? episodes.filter((e: any) => e.name.toLowerCase().includes(epSearch.toLowerCase())).slice(0, 8)  // eslint-disable-line @typescript-eslint/no-explicit-any
    : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const charResults = charSearch.trim() && !selChar
    ? characters.filter((c: any) => c.name.toLowerCase().includes(charSearch.toLowerCase())).slice(0, 8)  // eslint-disable-line @typescript-eslint/no-explicit-any
    : []

  function handleAdd() {
    if (!text.trim()) return
    onAdd({
      moment:   text.trim(),
      notes:    notes.trim(),
      epGlobal: selEp?.global_episode ?? null,
      epName:   selEp?.name ?? null,
      epSeries: selEp?.series ?? null,
      epNum:    selEp?.episode ?? null,
      cfId:     selChar?.id ?? null,
      cfName:   selChar?.name ?? null,
      cfImage:  selChar?.image ?? null,
    })
  }

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--primary)', background: 'var(--muted)' }}>
      <input type="text" value={text} onChange={e => setText(e.target.value)}
        placeholder="Describe the moment…" autoFocus
        className="w-full rounded-xl border px-3 py-2 text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />

      <div className="relative">
        <input type="text"
          value={selEp ? `${selEp.series === 'naruto' ? 'N' : 'S'} · Ep ${selEp.episode} · ${selEp.name}` : epSearch}
          onChange={e => { if (selEp) { setSelEp(null); setEpSearch('') } else { setEpSearch(e.target.value) } }}
          placeholder="Episode (optional)…"
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {selEp && (
          <button onClick={() => { setSelEp(null); setEpSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
        {epResults.length > 0 && (
          <ResultsDropdown>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {epResults.map((e: any) => (
              <ResultItem key={e.id} onClick={() => { setSelEp(e); setEpSearch('') }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{e.series === 'naruto' ? 'N' : 'S'} · Ep {e.episode}</span>
                {e.name}
              </ResultItem>
            ))}
          </ResultsDropdown>
        )}
      </div>

      <div className="relative">
        <input type="text"
          value={selChar ? selChar.name : charSearch}
          onChange={e => { if (selChar) { setSelChar(null); setCharSearch('') } else { setCharSearch(e.target.value) } }}
          placeholder="Associated character (optional)…"
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {selChar && (
          <button onClick={() => { setSelChar(null); setCharSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
        {charResults.length > 0 && (
          <ResultsDropdown>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {charResults.map((c: any) => (
              <ResultItem key={c.id} onClick={() => { setSelChar(c); setCharSearch('') }}>
                <Avatar image={c.image} name={c.name} size={20} />
                {c.name}
              </ResultItem>
            ))}
          </ResultsDropdown>
        )}
      </div>

      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)…" rows={2}
        className="w-full rounded-xl border px-3 py-2 text-xs resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-xs border"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={handleAdd} disabled={!text.trim()} className="flex-1 py-2 rounded-xl text-xs font-medium"
          style={{ background: 'var(--primary)', color: 'white', border: 'none', opacity: text.trim() ? 1 : 0.5, cursor: text.trim() ? 'pointer' : 'default' }}>
          Add Moment
        </button>
      </div>
    </div>
  )
}

/* ─── Quotes Vault ───────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QuotesVault({ rankings, characters, episodes, save, goToEpisode, goToCF, addingSection, setAddingSection, editingEntry, setEditingEntry }: any) {
  const data: Quote[] = rankings.quotes_vault || []
  const isAdding = addingSection === 'quotes-vault'

  return (
    <Section
      title="Quotes Vault"
      subtitle="Memorable quotes from the series"
      onAdd={() => { setAddingSection('quotes-vault'); setEditingEntry(null) }}
      canAdd={!isAdding}>

      {data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {data.map(q => (
            <div key={q.id} className="rounded-xl border p-4 space-y-2 group relative"
              style={{
                borderColor: editingEntry === q.id ? 'var(--primary)' : 'var(--border)',
                background: 'var(--muted)',
              }}>
              {editingEntry === q.id ? (
                <EditQuoteEntry
                  quote={q}
                  characters={characters}
                  episodes={episodes}
                  onSave={(updated: any) => {  // eslint-disable-line @typescript-eslint/no-explicit-any
                    save({ ...rankings, quotes_vault: data.map(x => x.id === q.id ? updated : x) })
                    setEditingEntry(null)
                  }}
                  onDelete={() => {
                    save({ ...rankings, quotes_vault: data.filter(x => x.id !== q.id) })
                    setEditingEntry(null)
                  }}
                  onCancel={() => setEditingEntry(null)}
                />
              ) : (
                <>
                  <button
                    onClick={() => { setEditingEntry(q.id); setAddingSection(null) }}
                    className="absolute top-3 right-3 text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--muted-foreground)', background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    ✎
                  </button>
                  <p className="text-sm italic font-medium leading-relaxed pr-8" style={{ color: 'var(--foreground)' }}>
                    &ldquo;{q.quote}&rdquo;
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.cfName && (
                      <button onClick={() => q.cfId && goToCF(q.cfId, 'characters')}
                        className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border hover:opacity-80"
                        style={{ borderColor: '#b45000', background: 'color-mix(in oklab, #b45000 12%, var(--surface))', color: '#b45000', cursor: 'pointer' }}>
                        <Avatar image={q.cfImage} name={q.cfName} size={14} />
                        {q.cfName}
                      </button>
                    )}
                    {q.epName && (
                      <button onClick={() => q.epGlobal && goToEpisode(q.epGlobal, q.epSeries)}
                        className="text-xs px-2 py-1 rounded-lg border hover:opacity-80"
                        style={{ borderColor: 'var(--primary)', background: 'color-mix(in oklab, var(--primary) 12%, var(--surface))', color: 'var(--primary)', cursor: 'pointer' }}>
                        {q.epSeries === 'naruto' ? 'N' : 'S'} · Ep {q.epNum} · {q.epName}
                      </button>
                    )}
                  </div>
                  {q.notes && <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{q.notes}</p>}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdding && (
        <QuoteAddForm
          characters={characters}
          episodes={episodes}
          onAdd={(entry: any) => { save({ ...rankings, quotes_vault: [...data, { ...entry, id: `q_${Date.now()}` }] }); setAddingSection(null) }}
          onCancel={() => setAddingSection(null)}
        />
      )}
    </Section>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditQuoteEntry({ quote, characters, episodes, onSave, onDelete, onCancel }: any) {
  const [text, setText] = useState(quote.quote || '')
  const [notes, setNotes] = useState(quote.notes || '')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selChar, setSelChar] = useState<any>(
    quote.cfName ? { id: quote.cfId, name: quote.cfName, image: quote.cfImage } : null
  )
  const [charSearch, setCharSearch] = useState(quote.cfName || '')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selEp, setSelEp] = useState<any>(
    quote.epName ? { global_episode: quote.epGlobal, name: quote.epName, series: quote.epSeries, episode: quote.epNum } : null
  )
  const [epSearch, setEpSearch] = useState(quote.epName || '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const charResults = charSearch.trim() && !selChar
    ? characters.filter((c: any) => c.name.toLowerCase().includes(charSearch.toLowerCase())).slice(0, 8)  // eslint-disable-line @typescript-eslint/no-explicit-any
    : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const epResults = epSearch.trim() && !selEp
    ? episodes.filter((e: any) => e.name.toLowerCase().includes(epSearch.toLowerCase())).slice(0, 8)  // eslint-disable-line @typescript-eslint/no-explicit-any
    : []

  function handleSave() {
    onSave({
      ...quote,
      quote:    text.trim(),
      notes:    notes.trim(),
      cfId:     selChar?.id ?? null,
      cfName:   selChar?.name ?? null,
      cfImage:  selChar?.image ?? null,
      epGlobal: selEp?.global_episode ?? null,
      epName:   selEp?.name ?? null,
      epSeries: selEp?.series ?? null,
      epNum:    selEp?.episode ?? null,
    })
  }

  return (
    <div className="space-y-3">
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder='Enter the quote…' rows={3} autoFocus
        className="w-full rounded-xl border px-3 py-2 text-sm resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />

      <div className="relative">
        <input type="text"
          value={selChar ? selChar.name : charSearch}
          onChange={e => { if (selChar) { setSelChar(null); setCharSearch('') } else { setCharSearch(e.target.value) } }}
          placeholder="Who said it? (optional)…"
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {selChar && (
          <button onClick={() => { setSelChar(null); setCharSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
        {charResults.length > 0 && (
          <ResultsDropdown>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {charResults.map((c: any) => (
              <ResultItem key={c.id} onClick={() => { setSelChar(c); setCharSearch('') }}>
                <Avatar image={c.image} name={c.name} size={20} />
                {c.name}
              </ResultItem>
            ))}
          </ResultsDropdown>
        )}
      </div>

      <div className="relative">
        <input type="text"
          value={selEp ? `${selEp.series === 'naruto' ? 'N' : 'S'} · Ep ${selEp.episode} · ${selEp.name}` : epSearch}
          onChange={e => { if (selEp) { setSelEp(null); setEpSearch('') } else { setEpSearch(e.target.value) } }}
          placeholder="From which episode? (optional)…"
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {selEp && (
          <button onClick={() => { setSelEp(null); setEpSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
        {epResults.length > 0 && (
          <ResultsDropdown>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {epResults.map((e: any) => (
              <ResultItem key={e.id} onClick={() => { setSelEp(e); setEpSearch('') }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{e.series === 'naruto' ? 'N' : 'S'} · Ep {e.episode}</span>
                {e.name}
              </ResultItem>
            ))}
          </ResultsDropdown>
        )}
      </div>

      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)…" rows={2}
        className="w-full rounded-xl border px-3 py-2 text-xs resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
      <EntryActions confirmDelete={confirmDelete} onSave={handleSave} onDelete={onDelete} onCancel={onCancel}
        onConfirmDelete={() => setConfirmDelete(true)} onCancelDelete={() => setConfirmDelete(false)} />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function QuoteAddForm({ characters, episodes, onAdd, onCancel }: any) {
  const [quote, setQuote] = useState('')
  const [notes, setNotes] = useState('')
  const [selChar, setSelChar] = useState<any>(null)  // eslint-disable-line @typescript-eslint/no-explicit-any
  const [charSearch, setCharSearch] = useState('')
  const [selEp, setSelEp] = useState<any>(null)  // eslint-disable-line @typescript-eslint/no-explicit-any
  const [epSearch, setEpSearch] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const charResults = charSearch.trim() && !selChar
    ? characters.filter((c: any) => c.name.toLowerCase().includes(charSearch.toLowerCase())).slice(0, 8)  // eslint-disable-line @typescript-eslint/no-explicit-any
    : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const epResults = epSearch.trim() && !selEp
    ? episodes.filter((e: any) => e.name.toLowerCase().includes(epSearch.toLowerCase())).slice(0, 8)  // eslint-disable-line @typescript-eslint/no-explicit-any
    : []

  function handleAdd() {
    if (!quote.trim()) return
    onAdd({
      quote:    quote.trim(),
      notes:    notes.trim(),
      cfId:     selChar?.id ?? null,
      cfName:   selChar?.name ?? null,
      cfImage:  selChar?.image ?? null,
      epGlobal: selEp?.global_episode ?? null,
      epName:   selEp?.name ?? null,
      epSeries: selEp?.series ?? null,
      epNum:    selEp?.episode ?? null,
    })
  }

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--primary)', background: 'var(--muted)' }}>
      <textarea value={quote} onChange={e => setQuote(e.target.value)}
        placeholder='Enter the quote… (" " will be added automatically)' rows={3} autoFocus
        className="w-full rounded-xl border px-3 py-2 text-sm resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />

      <div className="relative">
        <input type="text"
          value={selChar ? selChar.name : charSearch}
          onChange={e => { if (selChar) { setSelChar(null); setCharSearch('') } else { setCharSearch(e.target.value) } }}
          placeholder="Who said it? (optional)…"
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {selChar && (
          <button onClick={() => { setSelChar(null); setCharSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
        {charResults.length > 0 && (
          <ResultsDropdown>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {charResults.map((c: any) => (
              <ResultItem key={c.id} onClick={() => { setSelChar(c); setCharSearch('') }}>
                <Avatar image={c.image} name={c.name} size={20} />
                {c.name}
              </ResultItem>
            ))}
          </ResultsDropdown>
        )}
      </div>

      <div className="relative">
        <input type="text"
          value={selEp ? `${selEp.series === 'naruto' ? 'N' : 'S'} · Ep ${selEp.episode} · ${selEp.name}` : epSearch}
          onChange={e => { if (selEp) { setSelEp(null); setEpSearch('') } else { setEpSearch(e.target.value) } }}
          placeholder="From which episode? (optional)…"
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {selEp && (
          <button onClick={() => { setSelEp(null); setEpSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
        {epResults.length > 0 && (
          <ResultsDropdown>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {epResults.map((e: any) => (
              <ResultItem key={e.id} onClick={() => { setSelEp(e); setEpSearch('') }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{e.series === 'naruto' ? 'N' : 'S'} · Ep {e.episode}</span>
                {e.name}
              </ResultItem>
            ))}
          </ResultsDropdown>
        )}
      </div>

      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)…" rows={2}
        className="w-full rounded-xl border px-3 py-2 text-xs resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-xs border"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={handleAdd} disabled={!quote.trim()} className="flex-1 py-2 rounded-xl text-xs font-medium"
          style={{ background: 'var(--primary)', color: 'white', border: 'none', opacity: quote.trim() ? 1 : 0.5, cursor: quote.trim() ? 'pointer' : 'default' }}>
          Add Quote
        </button>
      </div>
    </div>
  )
}

/* ─── Theory Log ─────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TheoryLog({ rankings, episodes, save, goToEpisode, addingSection, setAddingSection, editingEntry, setEditingEntry }: any) {
  const data: Theory[] = rankings.theory_log || []
  const isAdding = addingSection === 'theory-log'

  const STATUS_CYCLE: Theory['status'][] = ['ongoing', 'correct', 'wrong']
  const STATUS_STYLE = {
    ongoing: { bg: 'color-mix(in oklab, #f59e0b 20%, var(--surface))', color: '#f59e0b', label: 'ONGOING' },
    correct: { bg: 'color-mix(in oklab, #10b981 20%, var(--surface))', color: '#10b981', label: 'CORRECT ✓' },
    wrong:   { bg: 'color-mix(in oklab, #ef4444 20%, var(--surface))', color: '#ef4444', label: 'WRONG ✗' },
  }

  function cycleStatus(id: string) {
    save({
      ...rankings,
      theory_log: data.map(t => {
        if (t.id !== id) return t
        const idx = STATUS_CYCLE.indexOf(t.status)
        return { ...t, status: STATUS_CYCLE[(idx + 1) % 3] }
      }),
    })
  }

  return (
    <Section
      title="Theory Log"
      subtitle="Track your theories — tap the status badge to cycle it"
      onAdd={() => { setAddingSection('theory-log'); setEditingEntry(null) }}
      canAdd={!isAdding}>

      <div className="space-y-3 mb-4">
        {data.map(t => {
          const style = STATUS_STYLE[t.status]
          return (
            <div key={t.id} className="rounded-xl border p-4 group"
              style={{
                borderColor: editingEntry === t.id ? 'var(--primary)' : 'var(--border)',
                background: 'var(--muted)',
              }}>
              {editingEntry === t.id ? (
                <EditTheoryEntry
                  theory={t}
                  episodes={episodes}
                  onSave={(updated: any) => {  // eslint-disable-line @typescript-eslint/no-explicit-any
                    save({ ...rankings, theory_log: data.map(x => x.id === t.id ? updated : x) })
                    setEditingEntry(null)
                  }}
                  onDelete={() => {
                    save({ ...rankings, theory_log: data.filter(x => x.id !== t.id) })
                    setEditingEntry(null)
                  }}
                  onCancel={() => setEditingEntry(null)}
                />
              ) : (
                <div className="flex items-start gap-3">
                  {/* Status badge — cycles on click in view mode */}
                  <button onClick={() => cycleStatus(t.id)}
                    className="font-eyebrow text-[9px] px-2 py-1 rounded-lg flex-shrink-0 transition-colors hover:opacity-80"
                    style={{ background: style.bg, color: style.color, border: `1px solid ${style.color}`, cursor: 'pointer' }}>
                    {style.label}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>{t.theory}</div>
                    {t.why && (
                      <div className="text-xs mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Why: {t.why}</div>
                    )}
                    {t.epName && (
                      <button onClick={() => t.epGlobal && goToEpisode(t.epGlobal, t.epSeries)}
                        className="text-xs px-2 py-0.5 rounded-lg border hover:opacity-80"
                        style={{ borderColor: 'var(--primary)', background: 'color-mix(in oklab, var(--primary) 12%, var(--surface))', color: 'var(--primary)', cursor: 'pointer' }}>
                        After {t.epSeries === 'naruto' ? 'N' : 'S'} · Ep {t.epNum} · {t.epName}
                      </button>
                    )}
                  </div>
                  <button onClick={() => { setEditingEntry(t.id); setAddingSection(null) }}
                    className="text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    style={{ color: 'var(--muted-foreground)', background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                    ✎
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isAdding && (
        <TheoryAddForm
          episodes={episodes}
          onAdd={(entry: any) => { save({ ...rankings, theory_log: [...data, { ...entry, id: `t_${Date.now()}`, status: 'ongoing' as const }] }); setAddingSection(null) }}
          onCancel={() => setAddingSection(null)}
        />
      )}
    </Section>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditTheoryEntry({ theory, episodes, onSave, onDelete, onCancel }: any) {
  const [text, setText] = useState(theory.theory || '')
  const [why, setWhy] = useState(theory.why || '')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selEp, setSelEp] = useState<any>(
    theory.epName ? { global_episode: theory.epGlobal, name: theory.epName, series: theory.epSeries, episode: theory.epNum } : null
  )
  const [epSearch, setEpSearch] = useState(theory.epName || '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const epResults = epSearch.trim() && !selEp
    ? episodes.filter((e: any) => e.name.toLowerCase().includes(epSearch.toLowerCase())).slice(0, 8)  // eslint-disable-line @typescript-eslint/no-explicit-any
    : []

  function handleSave() {
    onSave({
      ...theory,
      theory:   text.trim(),
      why:      why.trim(),
      epGlobal: selEp?.global_episode ?? null,
      epName:   selEp?.name ?? null,
      epSeries: selEp?.series ?? null,
      epNum:    selEp?.episode ?? null,
    })
  }

  return (
    <div className="space-y-3">
      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder="Your theory…" rows={3} autoFocus
        className="w-full rounded-xl border px-3 py-2 text-sm resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
      <textarea value={why} onChange={e => setWhy(e.target.value)}
        placeholder="Why do you think this? (optional)…" rows={2}
        className="w-full rounded-xl border px-3 py-2 text-xs resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />

      <div className="relative">
        <input type="text"
          value={selEp ? `${selEp.series === 'naruto' ? 'N' : 'S'} · Ep ${selEp.episode} · ${selEp.name}` : epSearch}
          onChange={e => { if (selEp) { setSelEp(null); setEpSearch('') } else { setEpSearch(e.target.value) } }}
          placeholder="After which episode? (optional)…"
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {selEp && (
          <button onClick={() => { setSelEp(null); setEpSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
        {epResults.length > 0 && (
          <ResultsDropdown>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {epResults.map((e: any) => (
              <ResultItem key={e.id} onClick={() => { setSelEp(e); setEpSearch('') }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{e.series === 'naruto' ? 'N' : 'S'} · Ep {e.episode}</span>
                {e.name}
              </ResultItem>
            ))}
          </ResultsDropdown>
        )}
      </div>

      <EntryActions confirmDelete={confirmDelete} onSave={handleSave} onDelete={onDelete} onCancel={onCancel}
        onConfirmDelete={() => setConfirmDelete(true)} onCancelDelete={() => setConfirmDelete(false)} />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TheoryAddForm({ episodes, onAdd, onCancel }: any) {
  const [theory, setTheory] = useState('')
  const [why, setWhy] = useState('')
  const [selEp, setSelEp] = useState<any>(null)  // eslint-disable-line @typescript-eslint/no-explicit-any
  const [epSearch, setEpSearch] = useState('')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const epResults = epSearch.trim() && !selEp
    ? episodes.filter((e: any) => e.name.toLowerCase().includes(epSearch.toLowerCase())).slice(0, 8)  // eslint-disable-line @typescript-eslint/no-explicit-any
    : []

  function handleAdd() {
    if (!theory.trim()) return
    onAdd({
      theory:   theory.trim(),
      why:      why.trim(),
      epGlobal: selEp?.global_episode ?? null,
      epName:   selEp?.name ?? null,
      epSeries: selEp?.series ?? null,
      epNum:    selEp?.episode ?? null,
    })
  }

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--primary)', background: 'var(--muted)' }}>
      <textarea value={theory} onChange={e => setTheory(e.target.value)}
        placeholder="Your theory…" rows={3} autoFocus
        className="w-full rounded-xl border px-3 py-2 text-sm resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
      <textarea value={why} onChange={e => setWhy(e.target.value)}
        placeholder="Why do you think this? (optional)…" rows={2}
        className="w-full rounded-xl border px-3 py-2 text-xs resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />

      <div className="relative">
        <input type="text"
          value={selEp ? `${selEp.series === 'naruto' ? 'N' : 'S'} · Ep ${selEp.episode} · ${selEp.name}` : epSearch}
          onChange={e => { if (selEp) { setSelEp(null); setEpSearch('') } else { setEpSearch(e.target.value) } }}
          placeholder="After which episode? (optional)…"
          className="w-full rounded-xl border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
        {selEp && (
          <button onClick={() => { setSelEp(null); setEpSearch('') }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        )}
        {epResults.length > 0 && (
          <ResultsDropdown>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {epResults.map((e: any) => (
              <ResultItem key={e.id} onClick={() => { setSelEp(e); setEpSearch('') }}>
                <span style={{ color: 'var(--muted-foreground)' }}>{e.series === 'naruto' ? 'N' : 'S'} · Ep {e.episode}</span>
                {e.name}
              </ResultItem>
            ))}
          </ResultsDropdown>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-xs border"
          style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={handleAdd} disabled={!theory.trim()} className="flex-1 py-2 rounded-xl text-xs font-medium"
          style={{ background: 'var(--primary)', color: 'white', border: 'none', opacity: theory.trim() ? 1 : 0.5, cursor: theory.trim() ? 'pointer' : 'default' }}>
          Add Theory
        </button>
      </div>
    </div>
  )
}

/* ─── Best Fights ────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BestFights({ rankings, fights, caseFiles, save, goToEpisode, addingSection, setAddingSection, editingEntry, setEditingEntry }: any) {
  const [search, setSearch] = useState('')
  const dragIdx = useRef<number | null>(null)
  const data: BestFight[] = rankings.best_fights || []

  function handleDragStart(idx: number) { dragIdx.current = idx }
  function handleDrop(idx: number) {
    if (dragIdx.current === null || dragIdx.current === idx) return
    const next = [...data]
    const [moved] = next.splice(dragIdx.current, 1)
    next.splice(idx, 0, moved)
    save({ ...rankings, best_fights: next })
    dragIdx.current = null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = search.trim()
    ? fights.filter((f: any) =>  // eslint-disable-line @typescript-eslint/no-explicit-any
        f.title?.toLowerCase().includes(search.toLowerCase()) && !data.find(d => d.fightId === f.id)
      ).slice(0, 8)
    : []

  const isAdding = addingSection === 'best-fights'

  return (
    <Section
      title="Best Fights"
      subtitle="Your top 3 fights from the tracker — drag to reorder"
      count={`${data.length}/3`}
      onAdd={() => { setAddingSection('best-fights'); setEditingEntry(null) }}
      canAdd={data.length < 3 && !isAdding}>

      <div className="space-y-4 mb-4">
        {data.map((f, idx) => (
          <div key={f.fightId}
            draggable={editingEntry !== f.fightId}
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            className="rounded-xl border overflow-hidden group"
            style={{
              borderColor: editingEntry === f.fightId ? 'var(--primary)' : 'var(--border)',
              cursor: editingEntry === f.fightId ? 'default' : 'grab',
            }}>

            <div className="p-4" style={{ background: 'var(--muted)' }}>
              {editingEntry === f.fightId ? (
                <EditFightEntry
                  fight={f}
                  onSave={(updated: any) => {  // eslint-disable-line @typescript-eslint/no-explicit-any
                    save({ ...rankings, best_fights: data.map(x => x.fightId === f.fightId ? updated : x) })
                    setEditingEntry(null)
                  }}
                  onDelete={() => {
                    save({ ...rankings, best_fights: data.filter(x => x.fightId !== f.fightId) })
                    setEditingEntry(null)
                  }}
                  onCancel={() => setEditingEntry(null)}
                />
              ) : (
                <>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="font-display font-bold text-2xl w-8 text-center flex-shrink-0"
                      style={{ color: 'var(--primary)' }}>#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-base mb-1" style={{ color: 'var(--foreground)' }}>
                        {f.fightTitle}
                      </div>
                      {f.arc && (
                        <div className="text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>{f.arc}</div>
                      )}
                      {f.epName && (
                        <button onClick={() => f.epGlobal && goToEpisode(f.epGlobal, f.epSeries)}
                          className="text-xs px-2 py-0.5 rounded-lg border hover:opacity-80"
                          style={{ borderColor: 'var(--primary)', background: 'color-mix(in oklab, var(--primary) 12%, var(--surface))', color: 'var(--primary)', cursor: 'pointer' }}>
                          {f.epSeries === 'naruto' ? 'N' : 'S'} · Ep {f.epNum} · {f.epName}
                        </button>
                      )}
                    </div>
                    <button onClick={() => { setEditingEntry(f.fightId); setAddingSection(null) }}
                      className="text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      style={{ color: 'var(--muted-foreground)', background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                      ✎
                    </button>
                  </div>

                  {/* Teams with character avatars */}
                  <div className={`grid gap-3 mb-3 ${f.teamC?.length ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {[
                      { label: 'Team A', members: f.teamA },
                      { label: 'Team B', members: f.teamB },
                      ...(f.teamC?.length ? [{ label: 'Team C', members: f.teamC }] : []),
                    ].map(team => (
                      <div key={team.label} className="rounded-lg p-2" style={{ background: 'var(--surface)' }}>
                        <div className="font-eyebrow text-[8px] mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
                          {team.label}
                        </div>
                        <div className="space-y-1">
                          {team.members?.map((m: string) => {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const cf = caseFiles.find((c: any) => c.name === m && c.tag === 'characters')
                            return (
                              <div key={m} className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded overflow-hidden flex-shrink-0 flex items-center justify-center text-[9px] font-bold"
                                  style={{ background: '#b45000', color: 'white' }}>
                                  {cf?.image
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={cf.image} alt={m} className="w-full h-full object-cover" />
                                    : m[0]?.toUpperCase()}
                                </div>
                                <span className="text-xs" style={{ color: 'var(--foreground)' }}>{m}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>

                  {f.notes && (
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{f.notes}</p>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="relative">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search fights from your Fight Tracker…"
            autoFocus
            className="w-full rounded-xl border px-3 py-2 pl-8 text-sm"
            style={{ borderColor: 'var(--primary)', background: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }} />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
            style={{ color: 'var(--muted-foreground)' }}>🔍</span>
          <button onClick={() => setAddingSection(null)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          {results.length > 0 && (
            <ResultsDropdown>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {results.map((f: any) => (
                <ResultItem key={f.id} onClick={() => {
                  save({ ...rankings, best_fights: [...data, {
                    fightId:    f.id,
                    fightTitle: f.title,
                    fightImage: f.image ?? null,
                    teamA:      f.team_a || [],
                    teamB:      f.team_b || [],
                    teamC:      f.team_c || [],
                    epGlobal:   f.episode_global ?? null,
                    epName:     f.episode_name ?? null,
                    epSeries:   f.episode_series ?? null,
                    epNum:      f.episode_num ?? null,
                    arc:        f.arc ?? null,
                    notes:      '',
                  }] })
                  setAddingSection(null)
                  setSearch('')
                }}>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{f.title}</div>
                    {f.arc && <div className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>{f.arc}</div>}
                  </div>
                </ResultItem>
              ))}
            </ResultsDropdown>
          )}
        </div>
      )}
    </Section>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function EditFightEntry({ fight, onSave, onDelete, onCancel }: any) {
  const [notes, setNotes] = useState(fight.notes || '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
        Editing notes for: <span style={{ color: 'var(--foreground)' }}>{fight.fightTitle}</span>
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Why is this one of your best? (optional)…" rows={3} autoFocus
        className="w-full rounded-xl border px-3 py-2 text-xs resize-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--foreground)', outline: 'none' }} />
      <EntryActions confirmDelete={confirmDelete} onSave={() => onSave({ ...fight, notes })} onDelete={onDelete} onCancel={onCancel}
        onConfirmDelete={() => setConfirmDelete(true)} onCancelDelete={() => setConfirmDelete(false)} />
    </div>
  )
}

/* ─── Shared components ──────────────────────────────────────────────────────── */

function Section({ title, subtitle, count, onAdd, canAdd, children }: {
  title: string
  subtitle?: string
  count?: string
  onAdd: () => void
  canAdd: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-end justify-between mb-4">
        <div>
          <div className="font-eyebrow text-[9px] mb-0.5" style={{ color: 'var(--muted-foreground)' }}>RANKINGS</div>
          <h2 className="font-display font-bold text-2xl" style={{ color: 'var(--foreground)' }}>{title}</h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {count && (
            <span className="text-sm font-medium" style={{ color: 'var(--muted-foreground)' }}>{count}</span>
          )}
          {canAdd && (
            <button onClick={onAdd}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-colors hover:opacity-80"
              style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
              + Add
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

function Avatar({ image, name, size }: { image: string | null; name: string; size: number }) {
  return (
    <div
      className="rounded overflow-hidden flex-shrink-0 flex items-center justify-center font-bold"
      style={{ width: size, height: size, background: '#b45000', color: 'white', fontSize: Math.floor(size * 0.45) }}>
      {image
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={image} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : name[0]?.toUpperCase()}
    </div>
  )
}

function ResultsDropdown({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute z-20 w-full rounded-xl border mt-1 overflow-y-auto shadow-lg"
      style={{ maxHeight: '200px', borderColor: 'var(--border)', background: 'var(--surface)' }}>
      {children}
    </div>
  )
}

function ResultItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className="w-full px-3 py-2 text-xs text-left hover:bg-muted/50 transition-colors flex items-center gap-2"
      style={{ color: 'var(--foreground)', border: 'none', cursor: 'pointer', background: 'transparent' }}
      onClick={onClick}>
      {children}
    </button>
  )
}

function EntryActions({ confirmDelete, onSave, onDelete, onCancel, onConfirmDelete, onCancelDelete }: {
  confirmDelete: boolean
  onSave: () => void
  onDelete: () => void
  onCancel: () => void
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  return (
    <div className="flex gap-2 items-center">
      {!confirmDelete ? (
        <>
          <button onClick={onConfirmDelete}
            className="px-3 py-1.5 rounded-xl text-xs border transition-colors"
            style={{ borderColor: '#ef4444', color: '#ef4444', background: 'transparent', cursor: 'pointer' }}>
            Delete
          </button>
          <div className="flex-1" />
          <button onClick={onCancel}
            className="px-3 py-1.5 rounded-xl text-xs border"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={onSave}
            className="px-4 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
            Save
          </button>
        </>
      ) : (
        <>
          <span className="text-xs" style={{ color: '#ef4444' }}>Delete this entry?</span>
          <div className="flex-1" />
          <button onClick={onCancelDelete}
            className="px-3 py-1.5 rounded-xl text-xs border"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer' }}>
            No
          </button>
          <button onClick={onDelete}
            className="px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer' }}>
            Yes, Delete
          </button>
        </>
      )}
    </div>
  )
}
