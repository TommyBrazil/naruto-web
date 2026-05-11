'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ── Types ───────────────────────────────────────────────────────────────────── */

type Term = {
  id: string
  term: string
  category: string
  definition: string
  example: string
  built_in: boolean
  created_at: string
}

/* ── Constants ───────────────────────────────────────────────────────────────── */

const CATEGORIES = [
  { key: 'all',           label: 'All',           emoji: '📖' },
  { key: 'ranks',         label: 'Ranks',         emoji: '🎖️' },
  { key: 'jutsu-types',   label: 'Jutsu Types',   emoji: '⚡' },
  { key: 'organisations', label: 'Organisations', emoji: '🏛️' },
  { key: 'concepts',      label: 'Concepts',      emoji: '💭' },
  { key: 'lore',          label: 'Lore',          emoji: '📜' },
  { key: 'general',       label: 'General',       emoji: '📝' },
]

const BUILT_IN_TERMS = [
  // Ranks
  { term: 'Academy Student', category: 'ranks', definition: 'The entry level for aspiring ninja. Students attend the Ninja Academy where they learn basic jutsu and ninja theory before graduating to Genin.' },
  { term: 'Genin', category: 'ranks', definition: 'The lowest rank of active ninja, typically assigned to three-person teams led by a Jonin sensei. Most ninja stay at this rank for years.' },
  { term: 'Chunin', category: 'ranks', definition: 'Mid-level ninja who have passed the Chunin Exams. Chunin can lead missions and teams. Demonstrated leadership and judgement are key requirements.' },
  { term: 'Jonin', category: 'ranks', definition: 'Elite ninja who handle high-difficulty missions. They often serve as team leaders and sensei for Genin squads.' },
  { term: 'Tokubetsu Jonin', category: 'ranks', definition: 'Special Jonin — ninja with Jonin-level skill in one specific area (e.g. genjutsu or tracking) but not across the board.' },
  { term: 'ANBU', category: 'ranks', definition: 'Black Ops — elite covert operatives who carry out assassinations, protection of the Kage, and classified missions. Identities are secret.' },
  { term: 'Sannin', category: 'ranks', definition: 'A title given to three legendary ninja of exceptional power — Jiraiya, Tsunade, and Orochimaru. Not an official rank but a widely recognised distinction.' },
  { term: 'Kage', category: 'ranks', definition: 'The leader of a Hidden Village. Each of the five great nations has a Kage — Hokage (Leaf), Kazekage (Sand), Mizukage (Mist), Raikage (Cloud), Tsuchikage (Stone).' },
  { term: 'Missing-nin', category: 'ranks', definition: 'A ninja who has abandoned or betrayed their village. Considered rogue and often listed in the Bingo Book with a kill-on-sight order.' },
  // Jutsu Types
  { term: 'Ninjutsu', category: 'jutsu-types', definition: 'Ninja techniques that use chakra to create a wide variety of effects — the most common type of jutsu in the series.' },
  { term: 'Taijutsu', category: 'jutsu-types', definition: 'Physical combat techniques that rely on the body rather than chakra. Rock Lee specialises in this due to his inability to use ninjutsu.' },
  { term: 'Genjutsu', category: 'jutsu-types', definition: "Illusion techniques that affect the mind of the target, creating false sensory experiences. Broken by disrupting one's own chakra flow." },
  { term: 'Fūinjutsu', category: 'jutsu-types', definition: 'Sealing techniques that can trap objects, chakra, or living beings within scrolls or surfaces. Used to seal the Nine-Tails within Naruto.' },
  { term: 'Senjutsu', category: 'jutsu-types', definition: "Sage techniques that involve gathering natural energy from the environment to enhance the user's abilities. Requires entering Sage Mode." },
  { term: 'Kenjutsu', category: 'jutsu-types', definition: 'Sword techniques. Used by ninja who specialise in blade combat, such as the Seven Swordsmen of the Mist.' },
  // Concepts
  { term: 'Chakra', category: 'concepts', definition: 'The fundamental energy used to perform jutsu. Formed by combining physical energy (from the body) and spiritual energy (from the mind). Everyone has it but ninja train to control it.' },
  { term: 'Kekkei Genkai', category: 'concepts', definition: 'Bloodline traits — abilities passed down through specific clans that cannot be learned by outsiders. Examples: Sharingan (Uchiha), Byakugan (Hyuga).' },
  { term: 'Jinchuriki', category: 'concepts', definition: "A person who has had a Tailed Beast sealed inside them. They gain access to the beast's immense chakra but face social isolation. Naruto is the Jinchuriki of the Nine-Tails." },
  { term: 'Tailed Beast (Bijuu)', category: 'concepts', definition: 'Massive chakra creatures numbered by their tails (One-Tail to Nine-Tails). Immensely powerful and feared. The Nine-Tails attacked Konoha twelve years before the story begins.' },
  { term: 'Summoning Contract', category: 'concepts', definition: 'A blood contract that allows a ninja to summon animals (toads, snakes, slugs etc.) to fight alongside them. Requires signing the scroll in blood.' },
  { term: 'Shadow Clone Jutsu', category: 'concepts', definition: 'Creates physical copies of the user that can act independently and share memories when dispersed. Unlike regular clones, shadow clones have real substance.' },
  // Organisations
  { term: 'Akatsuki', category: 'organisations', definition: 'A criminal organisation of powerful missing-nin whose goal is to capture all nine Tailed Beasts. Members wear black cloaks with red clouds.' },
  { term: 'ANBU Black Ops', category: 'organisations', definition: 'The covert special forces of a Hidden Village. They operate under direct orders from the Kage and handle missions too sensitive for regular ninja.' },
  { term: 'Chunin Exams', category: 'organisations', definition: 'A major event held to promote Genin to Chunin rank. Teams from multiple villages compete. The exams test combat ability, intelligence, and composure under pressure.' },
  // Lore
  { term: 'Will of Fire', category: 'lore', definition: 'The core belief of Konoha — that love is the key to peace, and that the village is a family. Passed from generation to generation as a source of strength.' },
  { term: 'Ninja Way', category: 'lore', definition: "A personal code or creed a ninja lives by. Naruto's ninja way is \"I never go back on my word — that's my nindo.\"" },
  { term: 'Bingo Book', category: 'lore', definition: 'A book distributed to ninja listing dangerous missing-nin and criminals with bounties on their heads. S-rank criminals command the highest bounties.' },
  { term: 'Hidden Village', category: 'lore', definition: 'A ninja village concealed within a nation. Each of the five great nations has one. They train ninja and carry out missions for hire.' },
  { term: 'Five Great Nations', category: 'lore', definition: 'The five most powerful countries in the ninja world: Land of Fire, Land of Wind, Land of Lightning, Land of Earth, and Land of Water. Each has a corresponding Hidden Village.' },
]

/* ── Seeding ─────────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function seedBuiltInTerms(userId: string, supabase: any) {
  const { count } = await supabase
    .from('encyclopedia')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('built_in', true)

  if (count && count > 0) return

  const terms = BUILT_IN_TERMS.map((t, i) => ({
    id:         `enc_builtin_${i}_${t.term.toLowerCase().replace(/\s+/g, '_').slice(0, 20)}`,
    user_id:    userId,
    term:       t.term,
    category:   t.category,
    definition: t.definition,
    example:    '',
    built_in:   true,
  }))

  for (let i = 0; i < terms.length; i += 10) {
    const { error } = await supabase.from('encyclopedia').insert(terms.slice(i, i + 10))
    if (error) {
      console.error('SEED BATCH FAILED:', JSON.stringify(error))
      alert(`Seed failed: ${error.message} (code: ${error.code})`)
      return
    }
  }
}

/* ── Page ────────────────────────────────────────────────────────────────────── */

export default function EncyclopediaPage() {
  const [terms, setTerms]                   = useState<Term[]>([])
  const [loading, setLoading]               = useState(true)
  const [search, setSearch]                 = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [selected, setSelected]             = useState<Term | null>(null)
  const [isEditing, setIsEditing]           = useState(false)
  const [showAdd, setShowAdd]               = useState(false)
  const supabase = createClient()

  useEffect(() => { init() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await seedBuiltInTerms(user.id, supabase)
    await loadTerms()
    setLoading(false)
  }

  async function loadTerms() {
    const { data } = await supabase.from('encyclopedia').select('*').order('term')
    setTerms(data || [])
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function saveTerm(draft: any) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (draft.id) {
      await supabase.from('encyclopedia').update({
        term:       draft.term,
        category:   draft.category,
        definition: draft.definition,
        example:    draft.example ?? '',
        updated_at: new Date().toISOString(),
      }).eq('id', draft.id)
    } else {
      const id = `enc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const { error: insertError } = await supabase.from('encyclopedia').insert({
        id,
        user_id:    user.id,
        term:       draft.term,
        category:   draft.category || 'general',
        definition: draft.definition || '',
        example:    draft.example || '',
        built_in:   false,
      }).select().single()
      if (insertError) {
        console.error('SAVE FAILED:', JSON.stringify(insertError))
        alert(`Save failed: ${insertError.message} (code: ${insertError.code})`)
        return
      }
    }
    await loadTerms()
    setIsEditing(false)
    setShowAdd(false)
  }

  async function deleteTerm(id: string) {
    await supabase.from('encyclopedia').delete().eq('id', id)
    setTerms(prev => prev.filter(t => t.id !== id))
    setSelected(null)
  }

  const filtered = terms.filter(t => {
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      t.term.toLowerCase().includes(q) ||
      t.definition.toLowerCase().includes(q)
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const categoryCounts: Record<string, number> = { all: terms.length }
  terms.forEach(t => { categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1 })

  if (loading) return (
    <div className="flex items-center justify-center" style={{ height: 'calc(100vh - 57px)' }}>
      <div className="w-10 h-10 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div className="flex overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col border-r flex-shrink-0"
        style={{ width: '40%', maxWidth: '480px', minWidth: '280px', borderColor: 'var(--border)', background: 'var(--surface)' }}>

        {/* Header */}
        <div className="px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-eyebrow text-[9px]" style={{ color: 'var(--muted-foreground)' }}>
                NINJA GLOSSARY
              </div>
              <div className="font-display font-bold text-lg" style={{ color: 'var(--foreground)' }}>
                {terms.length} term{terms.length !== 1 ? 's' : ''}
              </div>
            </div>
            <button
              onClick={() => { setShowAdd(true); setSelected(null); setIsEditing(false) }}
              style={{
                width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '0.5rem', fontWeight: 700, fontSize: 18, lineHeight: 1,
                background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer',
              }}>
              +
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
            <input
              type="text" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search terms…"
              style={{
                width: '100%', boxSizing: 'border-box',
                borderRadius: '0.75rem', border: '1px solid var(--border)',
                background: 'var(--muted)', color: 'var(--foreground)',
                padding: '0.5rem 0.75rem 0.5rem 2rem',
                fontSize: 12, outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--muted-foreground)', pointerEvents: 'none' }}>
              🔍
            </span>
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {CATEGORIES.map(cat => {
              const count = categoryCounts[cat.key] ?? 0
              const active = activeCategory === cat.key
              return (
                <button key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  style={{
                    fontSize: 11, padding: '0.25rem 0.625rem',
                    borderRadius: '0.5rem',
                    background: active ? 'var(--primary)' : 'var(--muted)',
                    color: active ? 'white' : 'var(--muted-foreground)',
                    border: 'none', cursor: 'pointer',
                  }}>
                  {cat.label} <span style={{ opacity: 0.75, marginLeft: 2 }}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Term list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📖</div>
              <p className="font-display font-bold" style={{ fontSize: 15, color: 'var(--foreground)', marginBottom: 4 }}>
                {search ? 'No results' : 'No terms yet'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                {search ? 'Try a different search' : 'Press + to add your first term'}
              </p>
            </div>
          ) : filtered.map(term => {
            const isSelected = selected?.id === term.id
            return (
              <button
                key={term.id}
                onClick={() => { setSelected(term); setIsEditing(false); setShowAdd(false) }}
                style={{
                  width: '100%', textAlign: 'left', padding: '0.75rem 1rem',
                  borderBottom: '1px solid var(--border)',
                  borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                  background: isSelected ? 'color-mix(in oklab, var(--primary) 8%, var(--surface))' : 'transparent',
                  cursor: 'pointer', outline: 'none', display: 'block',
                }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {term.term}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {CATEGORIES.find(c => c.key === term.category)?.label || term.category}
                  {term.built_in && ' · Built-in'}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {showAdd ? (
          <AddTermForm onSave={saveTerm} onCancel={() => setShowAdd(false)} />
        ) : selected ? (
          <TermDetail
            key={selected.id}
            term={selected}
            termIndex={terms.indexOf(selected) + 1}
            totalTerms={terms.length}
            isEditing={isEditing}
            onEdit={() => setIsEditing(true)}
            onCancel={() => setIsEditing(false)}
            onSave={saveTerm}
            onDelete={() => deleteTerm(selected.id)}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '2rem' }}>
            <div>
              <div style={{ fontSize: 52, marginBottom: 16 }}>📖</div>
              <p className="font-display font-bold" style={{ fontSize: 20, color: 'var(--foreground)', marginBottom: 8 }}>
                Ninja Glossary
              </p>
              <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                Select a term to read its definition, or press + to add your own
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── TermDetail ──────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TermDetail({ term, termIndex, totalTerms, isEditing, onEdit, onCancel, onSave, onDelete }: any) {
  const [draft, setDraft]             = useState<Term>({ ...term })
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => { setDraft({ ...term }); setConfirmDelete(false) }, [term.id])

  function update(key: string, value: string) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  const cat      = CATEGORIES.find(c => c.key === term.category)
  const catLabel = cat?.label || term.category
  const catEmoji = cat?.emoji || '📝'

  const pillStyle: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 10, fontWeight: 600, letterSpacing: '0.08em',
    padding: '0.25rem 0.625rem', borderRadius: '0.5rem',
    background: 'var(--muted)', color: 'var(--muted-foreground)',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    borderRadius: '0.75rem', border: '1px solid var(--border)',
    background: 'var(--muted)', color: 'var(--foreground)',
    padding: '0.5rem 0.75rem', fontSize: 14, outline: 'none',
  }

  const textareaStyle: React.CSSProperties = {
    ...inputStyle, resize: 'none' as const, lineHeight: 1.6,
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '100%' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badges */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={pillStyle}>{catEmoji} {catLabel}</span>
            {term.built_in && <span style={pillStyle}>BUILT-IN</span>}
          </div>
          {/* Term name */}
          {isEditing ? (
            <input type="text" value={draft.term}
              onChange={e => update('term', e.target.value)}
              style={{ ...inputStyle, fontSize: 26, fontWeight: 700, fontFamily: 'inherit', padding: '0.375rem 0.75rem' }}
            />
          ) : (
            <h2 className="font-display font-bold" style={{ fontSize: '1.875rem', lineHeight: 1.1, color: 'var(--foreground)', margin: 0 }}>
              {term.term}
            </h2>
          )}
        </div>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {isEditing ? (
            <>
              <button onClick={onCancel}
                style={{ padding: '0.375rem 0.875rem', borderRadius: '0.75rem', fontSize: 13, border: '1px solid var(--border)', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => onSave(draft)}
                style={{ padding: '0.375rem 1rem', borderRadius: '0.75rem', fontSize: 13, fontWeight: 600, background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
                Save
              </button>
            </>
          ) : (
            <>
              <button onClick={onEdit}
                style={{ padding: '0.375rem 0.875rem', borderRadius: '0.75rem', fontSize: 13, border: '1px solid var(--border)', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer' }}>
                Edit
              </button>
              {!term.built_in && (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ padding: '0.375rem 0.875rem', borderRadius: '0.75rem', fontSize: 13, border: '1px solid var(--border)', color: '#ef4444', background: 'transparent', cursor: 'pointer' }}>
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Category selector (edit mode only) */}
      {isEditing && (
        <div style={{ marginBottom: 20 }}>
          <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 8 }}>
            CATEGORY
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.filter(c => c.key !== 'all').map(cat => (
              <button key={cat.key}
                onClick={() => update('category', cat.key)}
                style={{
                  fontSize: 12, padding: '0.375rem 0.75rem', borderRadius: '0.75rem', cursor: 'pointer',
                  background: draft.category === cat.key ? 'var(--primary)' : 'var(--muted)',
                  color: draft.category === cat.key ? 'white' : 'var(--muted-foreground)',
                  border: 'none',
                }}>
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Definition */}
      <div style={{ marginBottom: 20 }}>
        <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 8 }}>
          DEFINITION
        </div>
        {isEditing ? (
          <textarea value={draft.definition}
            onChange={e => update('definition', e.target.value)}
            rows={5} style={textareaStyle}
          />
        ) : (
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--foreground)', margin: 0 }}>
            {term.definition || <span style={{ color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No definition yet.</span>}
          </p>
        )}
      </div>

      {/* Example */}
      <div style={{ marginBottom: 20 }}>
        <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 8 }}>
          EXAMPLE IN THE SERIES
        </div>
        {isEditing ? (
          <textarea value={draft.example || ''}
            onChange={e => update('example', e.target.value)}
            rows={3} placeholder="An example from the show…"
            style={textareaStyle}
          />
        ) : term.example ? (
          <p style={{
            fontSize: 14, lineHeight: 1.7, color: 'var(--muted-foreground)',
            fontStyle: 'italic', margin: 0,
            borderLeft: '2px solid var(--border)', paddingLeft: 12,
          }}>
            {term.example}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', fontStyle: 'italic', margin: 0 }}>
            No example added yet.
          </p>
        )}
      </div>

      {/* Built-in note */}
      {term.built_in && !isEditing && (
        <div style={{ borderRadius: '0.75rem', background: 'var(--muted)', padding: '0.75rem 1rem', fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 12 }}>
          💡 This is a built-in term. You can edit the definition and example but cannot delete it.
        </div>
      )}

      {/* Encyclopedia vs Case Files note */}
      {!isEditing && (
        <div style={{ borderRadius: '0.75rem', background: 'var(--muted)', padding: '0.75rem 1rem', fontSize: 12, color: 'var(--muted-foreground)' }}>
          💡 The Glossary covers general concepts and terminology. For specific characters, jutsu, and locations you&apos;ve tracked, see{' '}
          <a href="/casefiles" style={{ color: 'var(--primary)' }}>Case Files</a>.
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{
          marginTop: 16, borderRadius: '0.75rem', border: '1px solid #ef4444',
          background: 'color-mix(in oklab, #ef4444 8%, var(--surface))',
          padding: '1rem',
        }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)', margin: '0 0 12px' }}>
            Delete &ldquo;{term.term}&rdquo;?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirmDelete(false)}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', fontSize: 12, border: '1px solid var(--border)', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={onDelete}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '0.75rem', fontSize: 12, fontWeight: 600, background: '#ef4444', color: 'white', border: 'none', cursor: 'pointer' }}>
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>
          Term {termIndex} of {totalTerms}
        </p>
      </div>
    </div>
  )
}

/* ── AddTermForm ─────────────────────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AddTermForm({ onSave, onCancel }: any) {
  const [term, setTerm]             = useState('')
  const [category, setCategory]     = useState('general')
  const [definition, setDefinition] = useState('')
  const [example, setExample]       = useState('')

  const canSave = term.trim().length > 0 && definition.trim().length > 0

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    borderRadius: '0.75rem', border: '1px solid var(--border)',
    background: 'var(--muted)', color: 'var(--foreground)',
    padding: '0.5rem 0.75rem', fontSize: 14, outline: 'none',
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 className="font-display font-bold" style={{ fontSize: '1.5rem', color: 'var(--foreground)', margin: 0 }}>
          New Term
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel}
            style={{ padding: '0.375rem 0.875rem', borderRadius: '0.75rem', fontSize: 13, border: '1px solid var(--border)', color: 'var(--muted-foreground)', background: 'transparent', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={() => onSave({ term, category, definition, example })}
            disabled={!canSave}
            style={{
              padding: '0.375rem 1rem', borderRadius: '0.75rem', fontSize: 13, fontWeight: 600,
              background: 'var(--primary)', color: 'white', border: 'none',
              cursor: canSave ? 'pointer' : 'not-allowed', opacity: canSave ? 1 : 0.5,
            }}>
            Save Term
          </button>
        </div>
      </div>

      {/* Term name */}
      <div style={{ marginBottom: 18 }}>
        <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 6 }}>
          TERM
        </div>
        <input type="text" value={term} onChange={e => setTerm(e.target.value)}
          placeholder="e.g. Rasengan, Hokage, Jinchuriki…"
          autoFocus style={inputStyle}
        />
      </div>

      {/* Category */}
      <div style={{ marginBottom: 18 }}>
        <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 8 }}>
          CATEGORY
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORIES.filter(c => c.key !== 'all').map(cat => (
            <button key={cat.key}
              onClick={() => setCategory(cat.key)}
              style={{
                fontSize: 12, padding: '0.375rem 0.75rem', borderRadius: '0.75rem', cursor: 'pointer',
                background: category === cat.key ? 'var(--primary)' : 'var(--muted)',
                color: category === cat.key ? 'white' : 'var(--muted-foreground)',
                border: 'none',
              }}>
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Definition */}
      <div style={{ marginBottom: 18 }}>
        <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 6 }}>
          DEFINITION
        </div>
        <textarea value={definition} onChange={e => setDefinition(e.target.value)}
          rows={4} placeholder="What does this term mean?"
          style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
        />
      </div>

      {/* Example */}
      <div>
        <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 6 }}>
          EXAMPLE IN THE SERIES <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
        </div>
        <textarea value={example} onChange={e => setExample(e.target.value)}
          rows={3} placeholder="An example from the show…"
          style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
        />
      </div>
    </div>
  )
}
