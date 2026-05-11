'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import RichTextEditor from '@/components/RichTextEditor'
import type { CaseFile, Relationship, EpisodeBrief } from '@/app/(app)/casefiles/[tag]/page'
import { callGemini, parseAIResponse, buildCaseFilePrompt, getNoteSectionsAI } from '@/lib/gemini'
import type { CaseFileForPrompt, EpisodeForPrompt } from '@/lib/gemini'

// ── Constants ─────────────────────────────────────────────────────────────────

const CHARACTER_RANKS = [
  'Academy Student', 'Genin', 'Chunin', 'Jonin', 'Tokubetsu Jonin',
  'Kage', 'Sannin', 'Anbu Black Ops', 'Rogue Ninja', 'Unknown',
]
const CHARACTER_STATUSES = ['Alive', 'Deceased', 'Unknown']
const JUTSU_TYPES = [
  'Ninjutsu', 'Genjutsu', 'Taijutsu', 'Fūinjutsu', 'Juinjutsu',
  'Senjutsu', 'Shinjutsu', 'Bukijutsu', 'Kinjutsu', 'Kenjutsu',
]
const CHAKRA_NATURES = ['Fire', 'Wind', 'Lightning', 'Earth', 'Water', 'None']
const JUTSU_STATUSES = ['Active', 'Lost', 'Forbidden', 'Unknown']
const CLAN_STATUSES  = ['Active', 'Disbanded', 'Destroyed', 'Unknown']
const GROUP_TYPES    = ['Ninja Team', 'Criminal Organisation', 'Military Unit', 'Political Body', 'Other']
const GROUP_STATUSES = ['Active', 'Disbanded', 'Destroyed', 'Unknown']
const NATIONS = [
  'Land of Fire', 'Land of Wind', 'Land of Lightning', 'Land of Earth', 'Land of Water',
  'Land of Sound', 'Land of Iron', 'Land of Rain', 'Land of Whirlpools', 'Land of Hot Springs',
  'Land of Rivers', 'Land of Sky', 'Land of Snow', 'Land of Demons', 'Land of Swamps', 'Land of Silence',
]
const KAGE_TITLES = ['Hokage', 'Kazekage', 'Mizukage', 'Raikage', 'Tsuchikage', 'Hoshikage']
const ALLIANCE_STATUSES = ['Allied', 'Neutral', 'Enemy', 'Unknown']
const LOCATION_TYPES = ['Forest', 'Mountain', 'City', 'Ruins', 'Training Ground', 'Other']
const EVENT_TYPES = ['Invasion', 'Battle', 'Political', 'Revelation', 'Death', 'Tournament']
const EVENT_OUTCOMES = ['Victory', 'Defeat', 'Draw', 'Ongoing', 'Unknown', 'Other']

const RELATIONSHIP_TYPES = [
  'Ally', 'Rival', 'Sensei', 'Student', 'Teammate', 'Family',
  'Love Interest', 'Lover', 'Enemy', 'Former Ally', 'Summoning Contract',
  'Jinchuriki', 'Bijuu',
]
const RELATIONSHIP_INVERSES: Record<string, string> = {
  'Sensei':     'Student',
  'Student':    'Sensei',
  'Jinchuriki': 'Bijuu',
  'Bijuu':      'Jinchuriki',
}

const NOTE_SECTIONS: Record<string, { key: string; label: string }[]> = {
  characters: [
    { key: 'background',  label: 'BACKGROUND' },
    { key: 'personality', label: 'PERSONALITY' },
    { key: 'appearance',  label: 'APPEARANCE' },
    { key: 'abilities',   label: 'ABILITIES & POWERS' },
  ],
  jutsu: [
    { key: 'howItWorks',  label: 'HOW IT WORKS' },
    { key: 'notableUses', label: 'NOTABLE USES' },
  ],
  clans: [
    { key: 'historyOrigin',   label: 'HISTORY & ORIGIN' },
    { key: 'abilitiesKekkei', label: 'ABILITIES & KEKKEI GENKAI' },
    { key: 'notableMembers',  label: 'NOTABLE MEMBERS' },
  ],
  groups: [
    { key: 'overviewPurpose',   label: 'OVERVIEW & PURPOSE' },
    { key: 'history',           label: 'HISTORY' },
    { key: 'notableActivities', label: 'NOTABLE ACTIVITIES' },
  ],
  villages: [
    { key: 'historyBackground', label: 'HISTORY & BACKGROUND' },
    { key: 'cultureReputation', label: 'CULTURE & REPUTATION' },
    { key: 'roleInStory',       label: 'ROLE IN STORY' },
  ],
  locations: [
    { key: 'description',       label: 'DESCRIPTION' },
    { key: 'significantEvents', label: 'SIGNIFICANCE & NOTABLE EVENTS' },
  ],
  events: [
    { key: 'whatHappened',  label: 'WHAT HAPPENED' },
    { key: 'outcomeImpact', label: 'OUTCOME & IMPACT' },
  ],
  other: [
    { key: 'notes', label: 'NOTES' },
  ],
}

// ── AI helpers ────────────────────────────────────────────────────────────────

const AI_OVERVIEW_KEY_MAP: Record<string, keyof CaseFile> = {
  summary: 'summary',
  village: 'village',
  clan: 'clan',
  group: 'group',
  rank: 'rank',
  status: 'status',
  kekkeiGenkai: 'kekkei_genkai',
  voiceActor: 'voice_actor',
  jutsuType: 'jutsu_type',
  chakraNature: 'chakra_nature',
  groupType: 'group_type',
  affiliation: 'affiliation',
  nation: 'nation',
  kageTitle: 'kage_title',
  allianceStatus: 'alliance_status',
  regionNation: 'region_nation',
  locationType: 'location_type',
  eventType: 'event_type',
  outcome: 'outcome',
  arc: 'arc',
}

const AI_LINKED_FIELDS: Record<string, string> = {
  village: 'villages',
  clan: 'clans',
  group: 'groups',
  affiliation: 'villages',
}

function aiResolveLinks(html: string, allCFs: CaseFile[]): string {
  if (!html) return html
  const nameToId: Record<string, string> = {}
  allCFs.forEach(c => { nameToId[c.name.toLowerCase()] = c.id })
  return html.replace(/\[LINK:([^\]]+)\]/g, (_m, linkName) => {
    const id = nameToId[linkName.trim().toLowerCase()]
    if (!id) return linkName.trim()
    return `<span data-cf-id="${id}" style="color:var(--primary);text-decoration:underline;text-decoration-style:dotted;cursor:pointer;font-weight:600">${linkName.trim()}</span>`
  })
}

function aiResolveLinkedFields(
  overview: Record<string, string>,
  allCFs: CaseFile[]
): Record<string, string> {
  const result = { ...overview }
  Object.entries(AI_LINKED_FIELDS).forEach(([field, targetTag]) => {
    const val = result[field]
    if (!val) return
    // Already a UUID → skip
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) return
    const match = allCFs.find(c =>
      c.tag === targetTag && c.name.toLowerCase() === val.toLowerCase()
    )
    if (match) result[field] = match.id
  })
  return result
}

function cfToCFForPrompt(cf: CaseFile): CaseFileForPrompt {
  return {
    id: cf.id, name: cf.name, tag: cf.tag,
    summary: cf.summary, village: cf.village, clan: cf.clan, group: cf.group,
    rank: cf.rank, status: cf.status, kekkei_genkai: cf.kekkei_genkai, voice_actor: cf.voice_actor,
    jutsu_type: cf.jutsu_type, chakra_nature: cf.chakra_nature,
    group_type: cf.group_type, group_type_other: cf.group_type_other, affiliation: cf.affiliation,
    nation: cf.nation, kage_title: cf.kage_title, alliance_status: cf.alliance_status,
    region_nation: cf.region_nation, location_type: cf.location_type, location_type_other: cf.location_type_other,
    event_type: cf.event_type, outcome: cf.outcome, arc: cf.arc,
    notes: cf.notes,
  }
}

// ── Appearance helpers ────────────────────────────────────────────────────────

function getAppearances(cfId: string, episodes: EpisodeBrief[]) {
  return episodes
    .filter(ep => Array.isArray(ep.in_this_episode) && ep.in_this_episode.includes(cfId))
    .sort((a, b) => a.global_episode - b.global_episode)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ text }: { text: string }) {
  return <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>{text}</div>
}

function SimpleSelect({ label, value, options, onChange }: {
  label: string
  value: string | null
  options: string[]
  onChange: (v: string | null) => void
}) {
  return (
    <div>
      <FieldLabel text={label} />
      <select value={value || ''} onChange={e => onChange(e.target.value || null)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none"
        style={{ color: 'var(--foreground)' }}>
        <option value="">— None —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function SelectWithOther({ label, value, otherValue, options, onChange, onOtherChange }: {
  label: string
  value: string | null
  otherValue: string | null
  options: string[]
  onChange: (v: string | null) => void
  onOtherChange: (v: string | null) => void
}) {
  return (
    <div className="space-y-2">
      <SimpleSelect label={label} value={value} options={options} onChange={onChange} />
      {value === 'Other' && (
        <input type="text" value={otherValue || ''} onChange={e => onOtherChange(e.target.value || null)}
          placeholder="Specify…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
          style={{ color: 'var(--foreground)' }} />
      )}
    </div>
  )
}

function LinkedDropdown({ label, value, targetTag, allCFs, onChange, onNavigate, isEditing }: {
  label: string
  value: string | null
  targetTag: string
  allCFs: CaseFile[]
  onChange: (v: string | null) => void
  onNavigate: (id: string) => void
  isEditing: boolean
}) {
  const [search, setSearch] = useState('')
  const [showDd, setShowDd] = useState(false)
  const selectedCf = value ? allCFs.find(cf => cf.id === value) : null

  const results = search.trim()
    ? allCFs.filter(cf =>
        cf.tag === targetTag &&
        cf.name.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : []

  if (!isEditing) {
    return (
      <div>
        <FieldLabel text={label} />
        {selectedCf ? (
          <button onClick={() => onNavigate(selectedCf.id)}
            className="text-sm hover:underline"
            style={{ color: 'var(--primary)' }}>
            {selectedCf.name} →
          </button>
        ) : (
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</span>
        )}
      </div>
    )
  }

  return (
    <div>
      <FieldLabel text={label} />
      <div className="relative">
        <input type="text"
          value={selectedCf ? selectedCf.name : search}
          onChange={e => { setSearch(e.target.value); onChange(null); setShowDd(true) }}
          onFocus={() => setShowDd(true)}
          onBlur={() => setTimeout(() => setShowDd(false), 150)}
          placeholder={`Search ${targetTag}…`}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
          style={{ color: 'var(--foreground)' }} />
        {selectedCf && (
          <button onClick={() => { onChange(null); setSearch('') }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs hover:opacity-60"
            style={{ color: 'var(--muted-foreground)' }}>✕</button>
        )}
        {showDd && results.length > 0 && !selectedCf && (
          <div className="absolute z-20 w-full rounded-xl border mt-1 overflow-y-auto shadow-lg"
            style={{ maxHeight: '160px', borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {results.map(cf => (
              <button key={cf.id}
                className="w-full px-3 py-2 text-xs text-left hover:bg-muted/50"
                style={{ color: 'var(--foreground)' }}
                onMouseDown={() => { onChange(cf.id); setSearch(''); setShowDd(false) }}>
                {cf.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MultiLinkedField({ label, value, targetTag, allCFs, onChange, onNavigate, isEditing }: {
  label: string
  value: string[]
  targetTag: string
  allCFs: CaseFile[]
  onChange: (ids: string[]) => void
  onNavigate: (id: string) => void
  isEditing: boolean
}) {
  const [search, setSearch] = useState('')
  const selected = (value || []).map(id => allCFs.find(cf => cf.id === id)).filter(Boolean) as CaseFile[]
  const results = search.trim()
    ? allCFs.filter(cf =>
        cf.tag === targetTag &&
        cf.name.toLowerCase().includes(search.toLowerCase()) &&
        !(value || []).includes(cf.id)
      ).slice(0, 8)
    : []

  if (!isEditing) {
    return (
      <div>
        <FieldLabel text={label} />
        {selected.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {selected.map(cf => (
              <button key={cf.id} onClick={() => onNavigate(cf.id)}
                className="text-xs px-2 py-1 rounded-lg border hover:border-primary transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}>
                {cf.name} →
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</span>
        )}
      </div>
    )
  }

  return (
    <div>
      <FieldLabel text={label} />
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.map(cf => (
          <span key={cf.id} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border"
            style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
            <button onClick={() => onNavigate(cf.id)} className="hover:underline" style={{ color: 'var(--primary)' }}>
              {cf.name}
            </button>
            <button onClick={() => onChange((value || []).filter(id => id !== cf.id))}
              style={{ color: 'var(--muted-foreground)' }}>×</button>
          </span>
        ))}
      </div>
      <div className="relative">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Add ${targetTag.slice(0, -1) || targetTag}…`}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
          style={{ color: 'var(--foreground)' }} />
        {results.length > 0 && (
          <div className="absolute z-20 w-full rounded-xl border mt-1 overflow-y-auto shadow-lg"
            style={{ maxHeight: '160px', borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {results.map(cf => (
              <button key={cf.id}
                className="w-full px-3 py-2 text-xs text-left hover:bg-muted/50"
                style={{ color: 'var(--foreground)' }}
                onClick={() => { onChange([...(value || []), cf.id]); setSearch('') }}>
                {cf.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MultiChipSelect({ label, value, options, onChange }: {
  label: string
  value: string[]
  options: string[]
  onChange: (v: string[]) => void
}) {
  const selected = value || []
  const available = options.filter(o => !selected.includes(o))
  return (
    <div>
      <FieldLabel text={label} />
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selected.map(item => (
          <span key={item} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border"
            style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
            {item}
            <button onClick={() => onChange(selected.filter(s => s !== item))}
              style={{ color: 'var(--muted-foreground)' }}>×</button>
          </span>
        ))}
      </div>
      {available.length > 0 && (
        <select onChange={e => { if (e.target.value) { onChange([...selected, e.target.value]); e.target.value = '' } }}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none"
          style={{ color: 'var(--foreground)' }}>
          <option value="">+ Add {label.toLowerCase()}…</option>
          {available.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  )
}

function AddRelationship({ allCFs, currentCfId, onAdd }: {
  allCFs: CaseFile[]
  currentCfId: string
  onAdd: (rel: Relationship) => void
}) {
  const [search,       setSearch]       = useState('')
  const [selectedCf,   setSelectedCf]   = useState<CaseFile | null>(null)
  const [relType,      setRelType]      = useState('')
  const [familyDetail, setFamilyDetail] = useState('')
  const [showResults,  setShowResults]  = useState(false)

  const results = search.trim()
    ? allCFs.filter(cf => cf.id !== currentCfId && cf.name.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : []

  function confirm() {
    if (!selectedCf || !relType) return
    onAdd({
      cfId: selectedCf.id,
      cfName: selectedCf.name,
      type: relType,
      familyDetail: relType === 'Family' ? familyDetail : undefined,
    })
    setSearch(''); setSelectedCf(null); setRelType(''); setFamilyDetail('')
  }

  return (
    <div className="space-y-2 p-3 rounded-xl border border-dashed" style={{ borderColor: 'var(--border)' }}>
      <div className="font-eyebrow text-[9px]" style={{ color: 'var(--muted-foreground)' }}>ADD RELATIONSHIP</div>
      <div className="relative">
        <input type="text"
          value={selectedCf ? selectedCf.name : search}
          onChange={e => { setSearch(e.target.value); setSelectedCf(null); setShowResults(true) }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 150)}
          placeholder="Search case files…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
          style={{ color: 'var(--foreground)' }} />
        {selectedCf && (
          <button onClick={() => { setSelectedCf(null); setSearch('') }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: 'var(--muted-foreground)' }}>✕</button>
        )}
        {showResults && results.length > 0 && !selectedCf && (
          <div className="absolute z-20 w-full rounded-xl border mt-1 overflow-y-auto shadow-lg"
            style={{ maxHeight: '160px', borderColor: 'var(--border)', background: 'var(--surface)' }}>
            {results.map(cf => (
              <button key={cf.id}
                className="w-full px-3 py-2 text-xs text-left hover:bg-muted/50 flex items-center gap-2"
                style={{ color: 'var(--foreground)' }}
                onMouseDown={() => { setSelectedCf(cf); setSearch(''); setShowResults(false) }}>
                <span className="font-eyebrow text-[8px]" style={{ color: 'var(--muted-foreground)' }}>{cf.tag}</span>
                {cf.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedCf && (
        <select value={relType} onChange={e => setRelType(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none"
          style={{ color: 'var(--foreground)' }}>
          <option value="">Select relationship type…</option>
          {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
      {relType === 'Family' && (
        <input type="text" value={familyDetail} onChange={e => setFamilyDetail(e.target.value)}
          placeholder="Specify: Father, Son, Mother…"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
          style={{ color: 'var(--foreground)' }} />
      )}
      {selectedCf && relType && (
        <button onClick={confirm}
          className="w-full py-1.5 rounded-xl text-xs font-medium"
          style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
          Link &ldquo;{selectedCf.name}&rdquo; as {relType}
        </button>
      )}
    </div>
  )
}

// ── Episode picker for Events ─────────────────────────────────────────────────

function EpisodePicker({ value, episodes, onPick }: {
  value: { global: number | null; name: string | null; series: string | null; num: number | null }
  episodes: EpisodeBrief[]
  onPick: (ep: EpisodeBrief) => void
}) {
  const [epSearch, setEpSearch] = useState('')
  const [showDd,   setShowDd]   = useState(false)

  const displayVal = value.name
    ? `${value.series === 'naruto' ? 'N' : 'S'} · Ep ${value.num}: ${value.name}`
    : ''

  const epResults = epSearch.trim()
    ? episodes.filter(ep => ep.name.toLowerCase().includes(epSearch.toLowerCase())).slice(0, 8)
    : []

  return (
    <div className="relative">
      <input type="text"
        value={displayVal || epSearch}
        onChange={e => { setEpSearch(e.target.value); setShowDd(true) }}
        onFocus={() => setShowDd(true)}
        onBlur={() => setTimeout(() => setShowDd(false), 150)}
        placeholder="Search episode…"
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
        style={{ color: 'var(--foreground)' }} />
      {showDd && epResults.length > 0 && (
        <div className="absolute z-20 w-full rounded-xl border mt-1 overflow-y-auto shadow-lg"
          style={{ maxHeight: '180px', borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {epResults.map(ep => (
            <button key={ep.id}
              className="w-full px-3 py-2 text-xs text-left hover:bg-muted/50 flex items-center gap-2"
              style={{ color: 'var(--foreground)' }}
              onMouseDown={() => { onPick(ep); setEpSearch(''); setShowDd(false) }}>
              <span className="font-eyebrow text-[8px]" style={{ color: 'var(--muted-foreground)' }}>
                {ep.series === 'naruto' ? 'N' : 'S'}
              </span>
              Ep {ep.episode}: {ep.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Note view section — event-delegation for CF link clicks ───────────────────

function NoteViewSection({ html, onNavigate }: { html: string; onNavigate: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('[data-cf-id]')
      if (target) {
        e.preventDefault()
        const cfId = target.getAttribute('data-cf-id')
        if (cfId) onNavigate(cfId)
      }
    }
    el.addEventListener('click', handleClick)
    return () => el.removeEventListener('click', handleClick)
  }, [onNavigate])

  return (
    <div ref={ref} className="text-sm leading-relaxed"
      style={{ color: 'var(--foreground)' }}
      dangerouslySetInnerHTML={{ __html: html }} />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CaseFileDetail({
  cf,
  allCaseFiles,
  episodes,
  tagColor,
  onUpdate,
  onDelete,
  onNavigateCF,
  onGoToEpisode,
  loadCaseFiles,
}: {
  cf: CaseFile
  allCaseFiles: CaseFile[]
  episodes: EpisodeBrief[]
  tagColor: string
  onUpdate: (updated: CaseFile) => void
  onDelete: () => void
  onNavigateCF: (cfId: string) => void
  onGoToEpisode: (globalEp: number, series: string) => void
  loadCaseFiles: () => Promise<void>
}) {
  const supabase = createClient()

  const [isEditing,      setIsEditing]      = useState(false)
  const [draft,          setDraft]          = useState<Partial<CaseFile>>({})
  const [notesDraft,     setNotesDraft]     = useState<Record<string, string>>({})
  const [saveStatus,     setSaveStatus]     = useState<'idle' | 'saving' | 'saved'>('idle')
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [showAddRel,     setShowAddRel]     = useState(false)

  // ── AI state ────────────────────────────────────────────────────────────────
  type AIData = {
    overview?: Record<string, string>
    notes?: Record<string, string>
    newCaseFiles?: Array<{ name: string; tag: string; overview?: Record<string, string>; notes?: Record<string, string> }>
  }
  const [aiStage,          setAiStage]          = useState<'closed' | 'nokey' | 'configure' | 'loading' | 'preview' | 'done'>('closed')
  const [aiKey,            setAiKey]            = useState('')
  const [aiEpFrom,         setAiEpFrom]         = useState<number | null>(null)
  const [aiEpTo,           setAiEpTo]           = useState<number | null>(null)
  const [aiData,           setAiData]           = useState<AIData | null>(null)
  const [aiCheckedSections,setAiCheckedSections]= useState<Set<string>>(new Set())
  const [aiCheckedNewFiles,setAiCheckedNewFiles]= useState<Set<number>>(new Set())
  const [aiError,          setAiError]          = useState('')
  const [aiImporting,      setAiImporting]      = useState(false)
  const [aiChanges,        setAiChanges]        = useState(0)
  const [aiCreated,        setAiCreated]        = useState(0)
  const [aiFullEpisodes,   setAiFullEpisodes]   = useState<EpisodeForPrompt[]>([])
  const [aiCurrentGlobal,  setAiCurrentGlobal]  = useState(1)
  const [aiPrompt,         setAiPrompt]         = useState('')
  const [aiCopied,         setAiCopied]         = useState(false)
  const [aiManualResponse, setAiManualResponse] = useState('')

  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Register global CF navigation handler for note link onclick attributes
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__cfNavigate = onNavigateCF
    return () => {
      delete (window as unknown as Record<string, unknown>).__cfNavigate
    }
  }, [onNavigateCF])

  // Reset state when cf changes
  useEffect(() => {
    setIsEditing(false)
    setConfirmDelete(false)
    setSaveStatus('idle')
    const n = cf.notes && typeof cf.notes === 'object' ? cf.notes : {}
    setNotesDraft(n as Record<string, string>)
  }, [cf.id])

  function startEdit() {
    setDraft({ ...cf })
    setIsEditing(true)
  }

  function updateDraft(key: string, value: unknown) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  async function saveEdit() {
    const { id, relationships, notes, created_at, updated_at, ...rest } = draft as CaseFile
    void id; void relationships; void notes; void created_at; void updated_at
    const payload = { ...rest, updated_at: new Date().toISOString() }
    const { data, error } = await supabase
      .from('case_files')
      .update(payload)
      .eq('id', cf.id)
      .select()
      .single()
    if (!error && data) {
      onUpdate(data)
      setIsEditing(false)
    }
  }

  function handleNoteChange(key: string, html: string) {
    const updated = { ...notesDraft, [key]: html }
    setNotesDraft(updated)
    setSaveStatus('saving')
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('case_files')
        .update({ notes: updated })
        .eq('id', cf.id)
        .select()
        .single()
      if (data) onUpdate(data)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 1500)
    }, 1000)
  }

  async function addRelationship(newRel: Relationship) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const currentRels = [...(cf.relationships || []), newRel]
    await supabase.from('case_files').update({ relationships: currentRels }).eq('id', cf.id)

    const { data: linkedCf } = await supabase.from('case_files').select('*').eq('id', newRel.cfId).single()
    if (linkedCf) {
      const inverseType = RELATIONSHIP_INVERSES[newRel.type] || newRel.type
      const inverseRel: Relationship = {
        cfId:         cf.id,
        cfName:       cf.name,
        type:         inverseType,
        familyDetail: newRel.familyDetail,
      }
      const linkedRels = Array.isArray(linkedCf.relationships) ? linkedCf.relationships : []
      if (!linkedRels.find((r: Relationship) => r.cfId === cf.id)) {
        await supabase.from('case_files').update({ relationships: [...linkedRels, inverseRel] }).eq('id', newRel.cfId)
      }
    }

    setShowAddRel(false)
    await loadCaseFiles()
  }

  async function removeRelationship(linkedCfId: string) {
    const updatedRels = (cf.relationships || []).filter(r => r.cfId !== linkedCfId)
    await supabase.from('case_files').update({ relationships: updatedRels }).eq('id', cf.id)

    const { data: linkedCf } = await supabase.from('case_files').select('*').eq('id', linkedCfId).single()
    if (linkedCf) {
      const linkedRels = Array.isArray(linkedCf.relationships) ? linkedCf.relationships : []
      await supabase.from('case_files').update({
        relationships: linkedRels.filter((r: Relationship) => r.cfId !== cf.id),
      }).eq('id', linkedCfId)
    }

    await loadCaseFiles()
  }

  // ── AI functions ─────────────────────────────────────────────────────────────

  async function openAIModal() {
    // Fetch Gemini key and watched episodes
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('gemini_key').eq('id', user.id).single()
    const key = profile?.gemini_key || ''
    if (!key) {
      setAiStage('nokey')
      return
    }
    setAiKey(key)

    // Fetch episodes for prompt (need personal_notes)
    const { data: eps } = await supabase
      .from('episodes')
      .select('id, global_episode, series, episode, name, type, watched, personal_notes')
      .eq('user_id', user.id)
      .order('global_episode', { ascending: true })

    const fullEps: EpisodeForPrompt[] = (eps || []).map((e: Record<string, unknown>) => ({
      id: String(e.id), global_episode: Number(e.global_episode), series: String(e.series),
      episode: Number(e.episode), name: String(e.name), type: String(e.type),
      watched: Boolean(e.watched), personal_notes: e.personal_notes as string | null,
    }))

    // Determine current episode (last watched)
    const watchedEps = fullEps.filter(e => e.watched)
    const currentGlobal = watchedEps.length > 0
      ? Math.max(...watchedEps.map(e => e.global_episode))
      : 1

    setAiFullEpisodes(fullEps)
    setAiCurrentGlobal(currentGlobal)
    setAiEpFrom(null)
    setAiEpTo(null)
    setAiData(null)
    setAiError('')
    setAiManualResponse('')

    // Build prompt immediately so Copy Prompt works right away
    const cfForPrompt = cfToCFForPrompt(cf)
    const allCFsForPrompt: CaseFileForPrompt[] = allCaseFiles.map(cfToCFForPrompt)
    const builtPrompt = buildCaseFilePrompt(cfForPrompt, allCFsForPrompt, fullEps, currentGlobal, null, null)
    setAiPrompt(builtPrompt)

    setAiStage('configure')
  }

  function processAIResponse(raw: string) {
    try {
      const parsed = parseAIResponse(raw) as AIData
      setAiData(parsed)
      const sections = getNoteSectionsAI(cf.tag)
      setAiCheckedSections(new Set(sections.map(s => s.key)))
      setAiCheckedNewFiles(new Set((parsed.newCaseFiles || []).map((_: unknown, i: number) => i)))
      setAiStage('preview')
    } catch (err) {
      console.error('AI parse error:', err)
      setAiError(err instanceof Error ? err.message : 'Unknown error')
      setAiStage('configure') // Always exit loading on error
    }
  }

  async function runAIGenerate() {
    setAiStage('loading')
    setAiError('')
    try {
      const cfForPrompt = cfToCFForPrompt(cf)
      const allCFsForPrompt: CaseFileForPrompt[] = allCaseFiles.map(cfToCFForPrompt)
      const prompt = buildCaseFilePrompt(cfForPrompt, allCFsForPrompt, aiFullEpisodes, aiCurrentGlobal, aiEpFrom, aiEpTo)
      setAiPrompt(prompt)
      const raw = await callGemini(prompt, aiKey)
      processAIResponse(raw)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unknown error')
      setAiStage('configure')
    }
  }

  async function runAIImport() {
    if (!aiData) return
    setAiImporting(true)
    setAiError('')

    const timeout = setTimeout(() => {
      setAiImporting(false)
      setAiError('Import timed out. Try again.')
      setAiStage('preview')
    }, 30000)

    try {
      const sections = getNoteSectionsAI(cf.tag)
      let changes = 0

      // ── 1. Update main CF overview + notes ─────────────────────────────────
      let overviewPatch: Record<string, unknown> = {}
      if (aiData.overview) {
        let resolved = { ...aiData.overview }
        resolved = aiResolveLinkedFields(resolved, allCaseFiles)
        Object.entries(resolved).forEach(([k, v]) => {
          const dbKey = AI_OVERVIEW_KEY_MAP[k]
          if (!dbKey || !v || !String(v).trim()) return
          const currentVal = cf[dbKey]
          if (!currentVal || (Array.isArray(currentVal) && currentVal.length === 0)) {
            overviewPatch[dbKey] = String(v).trim()
            changes++
          }
        })
      }

      let notesPatch = { ...(cf.notes || {}) }
      if (aiData.notes) {
        sections.forEach(s => {
          if (!aiCheckedSections.has(s.key)) return
          const aiContent = aiData.notes![s.key]
          if (!aiContent || !aiContent.trim()) return
          const resolved = aiResolveLinks(aiContent, allCaseFiles)
          if (notesPatch[s.key] && notesPatch[s.key].trim()) {
            notesPatch[s.key] += resolved
          } else {
            notesPatch[s.key] = resolved
          }
          changes++
        })
      }

      const cfPatch: Record<string, unknown> = { ...overviewPatch, notes: notesPatch, updated_at: new Date().toISOString() }
      const { error: updateError } = await supabase.from('case_files').update(cfPatch).eq('id', cf.id)
      if (updateError) {
        console.error('Supabase update error:', updateError)
        throw new Error(updateError.message)
      }

      // ── 2. Create new case files ────────────────────────────────────────────
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw new Error(userError.message)

      const newFiles = aiData.newCaseFiles || []
      let created = 0

      const filesToCreate = newFiles.filter((_: unknown, i: number) => aiCheckedNewFiles.has(i))
      for (const nf of filesToCreate) {
        if (!nf.name) continue
        const exists = allCaseFiles.find(c => c.name.toLowerCase() === nf.name.toLowerCase())
        if (exists) continue

        const newCFData: Record<string, unknown> = { id: crypto.randomUUID(), name: nf.name, tag: nf.tag || 'other', user_id: user?.id, created_at: new Date().toISOString() }
        if (nf.overview) {
          let resolved = { ...nf.overview }
          resolved = aiResolveLinkedFields(resolved, allCaseFiles)
          Object.entries(resolved).forEach(([k, v]) => {
            const dbKey = AI_OVERVIEW_KEY_MAP[k]
            if (dbKey && v && String(v).trim()) newCFData[dbKey] = String(v).trim()
          })
        }
        if (nf.notes) {
          const newSecs = getNoteSectionsAI(nf.tag || 'other')
          const notesObj: Record<string, string> = {}
          newSecs.forEach(s => {
            if (nf.notes![s.key]) notesObj[s.key] = aiResolveLinks(nf.notes![s.key], allCaseFiles)
          })
          newCFData.notes = notesObj
        }
        const { error: insertError } = await supabase.from('case_files').insert(newCFData)
        if (insertError) {
          console.error('Supabase insert error:', insertError)
          throw new Error(insertError.message)
        }
        created++
      }

      // ── 3. Re-resolve links in main CF now that new files exist ────────────
      if (created > 0) {
        await loadCaseFiles()
        const { data: freshCFs } = await supabase
          .from('case_files')
          .select('id, name, tag')
          .eq('user_id', user?.id)
        if (freshCFs) {
          const rePatch: Record<string, string> = {}
          Object.entries(notesPatch).forEach(([k, v]) => {
            rePatch[k] = aiResolveLinks(v, freshCFs as CaseFile[])
          })
          await supabase.from('case_files').update({ notes: rePatch }).eq('id', cf.id)
          notesPatch = rePatch
        }
      }

      setNotesDraft(notesPatch)
      await loadCaseFiles()
      setAiChanges(changes)
      setAiCreated(created)
      setAiStage('done')
    } catch (err) {
      console.error('AI import failed:', err)
      setAiError('Import failed: ' + (err instanceof Error ? err.message : String(err)))
      setAiStage('preview') // Return to preview so user can retry
    } finally {
      clearTimeout(timeout)
      setAiImporting(false)
    }
  }

  // ── Computed appearances ──────────────────────────────────────────────────────

  const appearances   = getAppearances(cf.id, episodes)
  const firstEp       = appearances[0] || null
  const recentEp      = appearances[appearances.length - 1] || null
  const sameEp        = firstEp && recentEp && firstEp.global_episode === recentEp.global_episode
  const showAppearances = cf.tag !== 'events'

  // ── Edit mode field helpers ───────────────────────────────────────────────────

  function textField(key: string, label: string, value: string | null, multiline = false) {
    if (!isEditing) {
      return value ? (
        <div>
          <FieldLabel text={label} />
          <p className="text-sm" style={{ color: 'var(--foreground)' }}>{value}</p>
        </div>
      ) : null
    }
    if (multiline) {
      return (
        <div>
          <FieldLabel text={label} />
          <textarea rows={2} value={(draft as Record<string, unknown>)[key] as string || ''}
            onChange={e => updateDraft(key, e.target.value || null)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary"
            style={{ color: 'var(--foreground)' }} />
        </div>
      )
    }
    return (
      <div>
        <FieldLabel text={label} />
        <input type="text" value={(draft as Record<string, unknown>)[key] as string || ''}
          onChange={e => updateDraft(key, e.target.value || null)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
          style={{ color: 'var(--foreground)' }} />
      </div>
    )
  }

  // ── Edit mode tag fields (vertical form) ──────────────────────────────────────

  function renderTagFields() {
    const d = draft as CaseFile
    const v = cf

    switch (cf.tag) {
      case 'characters': return (
        <>
          {textField('name',         'NAME',          isEditing ? d.name        : v.name)}
          {textField('summary',      'SUMMARY',       isEditing ? d.summary     : v.summary, true)}
          <LinkedDropdown label="VILLAGE"    value={isEditing ? d.village : v.village}    targetTag="villages"   allCFs={allCaseFiles} onChange={val => updateDraft('village', val)}    onNavigate={onNavigateCF} isEditing={isEditing} />
          <LinkedDropdown label="CLAN"       value={isEditing ? d.clan    : v.clan}       targetTag="clans"      allCFs={allCaseFiles} onChange={val => updateDraft('clan', val)}       onNavigate={onNavigateCF} isEditing={isEditing} />
          <LinkedDropdown label="GROUP / TEAM" value={isEditing ? d.group  : v.group}    targetTag="groups"     allCFs={allCaseFiles} onChange={val => updateDraft('group', val)}      onNavigate={onNavigateCF} isEditing={isEditing} />
          {isEditing
            ? <SimpleSelect label="RANK"   value={d.rank}   options={CHARACTER_RANKS}    onChange={val => updateDraft('rank', val)} />
            : v.rank && <div><FieldLabel text="RANK" /><p className="text-sm" style={{ color: 'var(--foreground)' }}>{v.rank}</p></div>}
          {isEditing
            ? <SimpleSelect label="STATUS" value={d.status} options={CHARACTER_STATUSES} onChange={val => updateDraft('status', val)} />
            : v.status && <div><FieldLabel text="STATUS" /><p className="text-sm" style={{ color: 'var(--foreground)' }}>{v.status}</p></div>}
          {textField('kekkei_genkai', 'KEKKEI GENKAI', isEditing ? d.kekkei_genkai : v.kekkei_genkai)}
          {textField('voice_actor',   'VOICE ACTOR (JP)', isEditing ? d.voice_actor  : v.voice_actor)}
        </>
      )

      case 'jutsu': return (
        <>
          {textField('name',    'NAME',    isEditing ? d.name    : v.name)}
          {textField('summary', 'SUMMARY', isEditing ? d.summary : v.summary, true)}
          {isEditing
            ? <SimpleSelect label="TYPE" value={d.jutsu_type} options={JUTSU_TYPES} onChange={val => updateDraft('jutsu_type', val)} />
            : v.jutsu_type && <div><FieldLabel text="TYPE" /><p className="text-sm">{v.jutsu_type}</p></div>}
          {isEditing
            ? <MultiChipSelect label="CHAKRA NATURE" value={d.chakra_nature || []} options={CHAKRA_NATURES} onChange={val => updateDraft('chakra_nature', val)} />
            : (v.chakra_nature?.length > 0) && (
                <div><FieldLabel text="CHAKRA NATURE" />
                  <div className="flex flex-wrap gap-1.5">
                    {v.chakra_nature.map(n => (
                      <span key={n} className="text-xs px-2 py-0.5 rounded-lg border" style={{ borderColor: 'var(--border)' }}>{n}</span>
                    ))}
                  </div>
                </div>
              )}
          <MultiLinkedField label="USED BY" value={isEditing ? d.used_by || [] : v.used_by || []} targetTag="characters" allCFs={allCaseFiles} onChange={val => updateDraft('used_by', val)} onNavigate={onNavigateCF} isEditing={isEditing} />
          {isEditing
            ? <SimpleSelect label="STATUS" value={d.status} options={JUTSU_STATUSES} onChange={val => updateDraft('status', val)} />
            : v.status && <div><FieldLabel text="STATUS" /><p className="text-sm">{v.status}</p></div>}
        </>
      )

      case 'clans': return (
        <>
          {textField('name',         'NAME',          isEditing ? d.name         : v.name)}
          {textField('summary',      'SUMMARY',       isEditing ? d.summary      : v.summary, true)}
          <LinkedDropdown label="VILLAGE" value={isEditing ? d.village : v.village} targetTag="villages" allCFs={allCaseFiles} onChange={val => updateDraft('village', val)} onNavigate={onNavigateCF} isEditing={isEditing} />
          {textField('kekkei_genkai', 'KEKKEI GENKAI', isEditing ? d.kekkei_genkai : v.kekkei_genkai)}
          {isEditing
            ? <SimpleSelect label="STATUS" value={d.status} options={CLAN_STATUSES} onChange={val => updateDraft('status', val)} />
            : v.status && <div><FieldLabel text="STATUS" /><p className="text-sm">{v.status}</p></div>}
          <MultiLinkedField label="NOTABLE MEMBERS" value={isEditing ? d.notable_members || [] : v.notable_members || []} targetTag="characters" allCFs={allCaseFiles} onChange={val => updateDraft('notable_members', val)} onNavigate={onNavigateCF} isEditing={isEditing} />
        </>
      )

      case 'groups': return (
        <>
          {textField('name',    'NAME',    isEditing ? d.name    : v.name)}
          {textField('summary', 'SUMMARY', isEditing ? d.summary : v.summary, true)}
          {isEditing
            ? <SelectWithOther label="TYPE" value={d.group_type} otherValue={d.group_type_other || null} options={GROUP_TYPES}
                onChange={val => updateDraft('group_type', val)}
                onOtherChange={val => updateDraft('group_type_other', val)} />
            : v.group_type && <div><FieldLabel text="TYPE" /><p className="text-sm">{v.group_type === 'Other' ? (v.group_type_other || 'Other') : v.group_type}</p></div>}
          <LinkedDropdown label="LEADER"             value={isEditing ? d.leader      : v.leader}      targetTag="characters" allCFs={allCaseFiles} onChange={val => updateDraft('leader', val)}      onNavigate={onNavigateCF} isEditing={isEditing} />
          <MultiLinkedField label="MEMBERS"          value={isEditing ? d.members || [] : v.members || []}  targetTag="characters" allCFs={allCaseFiles} onChange={val => updateDraft('members', val)}  onNavigate={onNavigateCF} isEditing={isEditing} />
          <LinkedDropdown label="VILLAGE / AFFILIATION" value={isEditing ? d.affiliation : v.affiliation} targetTag="villages"   allCFs={allCaseFiles} onChange={val => updateDraft('affiliation', val)} onNavigate={onNavigateCF} isEditing={isEditing} />
          {isEditing
            ? <SimpleSelect label="STATUS" value={d.status} options={GROUP_STATUSES} onChange={val => updateDraft('status', val)} />
            : v.status && <div><FieldLabel text="STATUS" /><p className="text-sm">{v.status}</p></div>}
        </>
      )

      case 'villages': return (
        <>
          {textField('name',    'NAME',    isEditing ? d.name    : v.name)}
          {textField('summary', 'SUMMARY', isEditing ? d.summary : v.summary, true)}
          {isEditing
            ? <SimpleSelect label="NATION" value={d.nation} options={NATIONS} onChange={val => updateDraft('nation', val)} />
            : v.nation && <div><FieldLabel text="NATION" /><p className="text-sm">{v.nation}</p></div>}
          {isEditing
            ? <SimpleSelect label="KAGE TITLE" value={d.kage_title} options={KAGE_TITLES} onChange={val => updateDraft('kage_title', val)} />
            : v.kage_title && <div><FieldLabel text="KAGE TITLE" /><p className="text-sm">{v.kage_title}</p></div>}
          <LinkedDropdown label="CURRENT KAGE" value={isEditing ? d.current_kage : v.current_kage} targetTag="characters" allCFs={allCaseFiles} onChange={val => updateDraft('current_kage', val)} onNavigate={onNavigateCF} isEditing={isEditing} />
          {isEditing
            ? <SimpleSelect label="ALLIANCE STATUS" value={d.alliance_status} options={ALLIANCE_STATUSES} onChange={val => updateDraft('alliance_status', val)} />
            : v.alliance_status && <div><FieldLabel text="ALLIANCE STATUS" /><p className="text-sm">{v.alliance_status}</p></div>}
          <MultiLinkedField label="MEMBERS" value={isEditing ? d.village_members || [] : v.village_members || []} targetTag="characters" allCFs={allCaseFiles} onChange={val => updateDraft('village_members', val)} onNavigate={onNavigateCF} isEditing={isEditing} />
        </>
      )

      case 'locations': return (
        <>
          {textField('name',    'NAME',    isEditing ? d.name    : v.name)}
          {textField('summary', 'SUMMARY', isEditing ? d.summary : v.summary, true)}
          {isEditing
            ? <SelectWithOther label="NATION / REGION" value={d.region_nation} otherValue={d.region_nation_other || null}
                options={[...NATIONS, 'Other']}
                onChange={val => updateDraft('region_nation', val)}
                onOtherChange={val => updateDraft('region_nation_other', val)} />
            : v.region_nation && <div><FieldLabel text="NATION / REGION" /><p className="text-sm">{v.region_nation === 'Other' ? (v.region_nation_other || 'Other') : v.region_nation}</p></div>}
          {isEditing
            ? <SelectWithOther label="TYPE" value={d.location_type} otherValue={d.location_type_other || null}
                options={LOCATION_TYPES}
                onChange={val => updateDraft('location_type', val)}
                onOtherChange={val => updateDraft('location_type_other', val)} />
            : v.location_type && <div><FieldLabel text="TYPE" /><p className="text-sm">{v.location_type === 'Other' ? (v.location_type_other || 'Other') : v.location_type}</p></div>}
        </>
      )

      case 'events': return (
        <>
          {textField('name',    'NAME',    isEditing ? d.name    : v.name)}
          {textField('summary', 'SUMMARY', isEditing ? d.summary : v.summary, true)}
          {isEditing
            ? <SimpleSelect label="TYPE" value={d.event_type} options={EVENT_TYPES} onChange={val => updateDraft('event_type', val)} />
            : v.event_type && <div><FieldLabel text="TYPE" /><p className="text-sm">{v.event_type}</p></div>}

          <div>
            <FieldLabel text="EPISODE" />
            {isEditing ? (
              <>
                <EpisodePicker
                  value={{ global: d.event_episode_global, name: d.event_episode_name, series: d.event_episode_series, num: d.event_episode_num }}
                  episodes={episodes}
                  onPick={ep => {
                    updateDraft('event_episode_global', ep.global_episode)
                    updateDraft('event_episode_name',   ep.name)
                    updateDraft('event_episode_series', ep.series)
                    updateDraft('event_episode_num',    ep.episode)
                    if (ep.arc) updateDraft('arc', ep.arc)
                  }}
                />
                {d.arc && (
                  <div className="mt-1.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                    Arc: <span style={{ color: 'var(--foreground)' }}>{d.arc}</span>
                  </div>
                )}
              </>
            ) : (
              v.event_episode_name ? (
                <button onClick={() => onGoToEpisode(v.event_episode_global!, v.event_episode_series!)}
                  className="text-sm hover:underline"
                  style={{ color: 'var(--primary)' }}>
                  {v.event_episode_series === 'naruto' ? 'Naruto' : 'Shippuden'} · Ep {v.event_episode_num}: {v.event_episode_name}
                </button>
              ) : (
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</span>
              )
            )}
          </div>

          <MultiLinkedField label="KEY PARTICIPANTS" value={isEditing ? d.key_participants || [] : v.key_participants || []} targetTag="characters" allCFs={allCaseFiles} onChange={val => updateDraft('key_participants', val)} onNavigate={onNavigateCF} isEditing={isEditing} />

          {isEditing
            ? <SelectWithOther label="OUTCOME" value={d.outcome} otherValue={d.outcome_other || null}
                options={EVENT_OUTCOMES}
                onChange={val => updateDraft('outcome', val)}
                onOtherChange={val => updateDraft('outcome_other', val)} />
            : v.outcome && <div><FieldLabel text="OUTCOME" /><p className="text-sm">{v.outcome === 'Other' ? (v.outcome_other || 'Other') : v.outcome}</p></div>}

          {(!isEditing && v.arc) && <div><FieldLabel text="ARC" /><p className="text-sm">{v.arc}</p></div>}
        </>
      )

      default:
        return (
          <>
            {textField('name',    'NAME',    isEditing ? d.name    : v.name)}
            {textField('summary', 'SUMMARY', isEditing ? d.summary : v.summary, true)}
          </>
        )
    }
  }

  // ── View mode: horizontal grid of field cells ─────────────────────────────────

  function renderViewGrid() {
    const v = cf

    function textCell(label: string, value: string | null | undefined) {
      return (
        <div key={label}>
          <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
          <div className="text-sm font-medium" style={{ color: value ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
            {value || '—'}
          </div>
        </div>
      )
    }

    function linkedCell(label: string, cfId: string | null | undefined) {
      const found = cfId ? allCaseFiles.find(c => c.id === cfId) : null
      return (
        <div key={label}>
          <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
          {found ? (
            <button onClick={() => onNavigateCF(found.id)}
              className="text-sm font-medium hover:opacity-80 transition-opacity text-left"
              style={{ color: 'var(--primary)' }}>
              {found.name} →
            </button>
          ) : (
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</div>
          )}
        </div>
      )
    }

    function multiLinkedCell(label: string, cfIds: string[] | null | undefined) {
      const items = (cfIds || []).map(id => allCaseFiles.find(c => c.id === id)).filter(Boolean) as CaseFile[]
      return (
        <div key={label}>
          <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
          {items.length > 0 ? (
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              {items.map(item => (
                <button key={item.id} onClick={() => onNavigateCF(item.id)}
                  className="text-sm font-medium hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--primary)' }}>
                  {item.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</div>
          )}
        </div>
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function chipsCell(label: string, values: any) {
      // Normalise — AI sometimes returns a string instead of an array
      let items: string[]
      if (!values) items = []
      else if (typeof values === 'string') items = [values]
      else if (!Array.isArray(values)) items = [String(values)]
      else items = values as string[]

      return (
        <div key={label}>
          <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>{label}</div>
          {items.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {items.map(val => (
                <span key={val} className="text-xs px-1.5 py-0.5 rounded border"
                  style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}>{val}</span>
              ))}
            </div>
          ) : (
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</div>
          )}
        </div>
      )
    }

    // First Appeared / Most Recent cells (appended for all non-event tags)
    const appearanceCells = showAppearances ? [
      <div key="first-appeared">
        <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>FIRST APPEARED</div>
        {firstEp ? (
          <button onClick={() => onGoToEpisode(firstEp.global_episode, firstEp.series)}
            className="text-sm font-medium hover:opacity-80 transition-opacity text-left"
            style={{ color: 'var(--primary)' }}>
            {firstEp.series === 'naruto' ? 'N' : 'S'} Ep {firstEp.episode} · {firstEp.name}
          </button>
        ) : (
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</div>
        )}
      </div>,
      <div key="most-recent">
        <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>MOST RECENT</div>
        {recentEp ? (
          sameEp ? (
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Same episode</div>
          ) : (
            <button onClick={() => onGoToEpisode(recentEp.global_episode, recentEp.series)}
              className="text-sm font-medium hover:opacity-80 transition-opacity text-left"
              style={{ color: 'var(--primary)' }}>
              {recentEp.series === 'naruto' ? 'N' : 'S'} Ep {recentEp.episode} · {recentEp.name}
            </button>
          )
        ) : (
          <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</div>
        )}
      </div>,
    ] : []

    let cells: React.ReactNode[] = []
    switch (v.tag) {
      case 'characters':
        cells = [
          textCell('RANK', v.rank),
          textCell('STATUS', v.status),
          linkedCell('VILLAGE', v.village),
          linkedCell('CLAN', v.clan),
          linkedCell('GROUP', v.group),
          textCell('KEKKEI GENKAI', v.kekkei_genkai),
          textCell('VOICE ACTOR', v.voice_actor),
        ]
        break
      case 'jutsu':
        cells = [
          textCell('TYPE', v.jutsu_type),
          chipsCell('CHAKRA NATURE', v.chakra_nature),
          multiLinkedCell('USED BY', v.used_by),
          textCell('STATUS', v.status),
        ]
        break
      case 'clans':
        cells = [
          linkedCell('VILLAGE', v.village),
          textCell('KEKKEI GENKAI', v.kekkei_genkai),
          textCell('STATUS', v.status),
          multiLinkedCell('NOTABLE MEMBERS', v.notable_members),
        ]
        break
      case 'groups':
        cells = [
          textCell('TYPE', v.group_type === 'Other' ? (v.group_type_other || 'Other') : v.group_type),
          linkedCell('LEADER', v.leader),
          linkedCell('AFFILIATION', v.affiliation),
          textCell('STATUS', v.status),
          multiLinkedCell('MEMBERS', v.members),
        ]
        break
      case 'villages':
        cells = [
          textCell('NATION', v.nation),
          textCell('KAGE TITLE', v.kage_title),
          linkedCell('CURRENT KAGE', v.current_kage),
          textCell('ALLIANCE STATUS', v.alliance_status),
        ]
        break
      case 'locations':
        cells = [
          textCell('NATION / REGION', v.region_nation === 'Other' ? (v.region_nation_other || 'Other') : v.region_nation),
          textCell('TYPE', v.location_type === 'Other' ? (v.location_type_other || 'Other') : v.location_type),
        ]
        break
      case 'events':
        cells = [
          textCell('TYPE', v.event_type),
          <div key="episode">
            <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>EPISODE</div>
            {v.event_episode_name ? (
              <button onClick={() => onGoToEpisode(v.event_episode_global!, v.event_episode_series!)}
                className="text-sm font-medium hover:opacity-80 transition-opacity text-left"
                style={{ color: 'var(--primary)' }}>
                {v.event_episode_series === 'naruto' ? 'Naruto' : 'Shippuden'} · Ep {v.event_episode_num}
              </button>
            ) : (
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>—</div>
            )}
          </div>,
          multiLinkedCell('KEY PARTICIPANTS', v.key_participants),
          textCell('OUTCOME', v.outcome === 'Other' ? (v.outcome_other || 'Other') : v.outcome),
          textCell('ARC', v.arc),
        ]
        break
      default:
        cells = []
    }

    return [...cells, ...appearanceCells]
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const rels = Array.isArray(cf.relationships)
    ? cf.relationships.filter(r => typeof r === 'object' && r !== null && r.cfId)
    : []

  const sections = NOTE_SECTIONS[cf.tag] || NOTE_SECTIONS.other

  return (
    <div className="p-6">

      {/* Image banner — full width, rounded, 16/9 */}
      {cf.image && (
        <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: '0.875rem', overflow: 'hidden', background: 'var(--muted)', marginBottom: '1.75rem' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cf.image} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tagColor }} />
            <span className="font-eyebrow text-[10px] text-muted-foreground">{cf.tag.toUpperCase()}</span>
            {cf.status && (
              <span className="font-eyebrow text-[9px] px-2 py-0.5 rounded"
                style={{ background: cf.status === 'Deceased' ? '#8c000020' : '#00503220', color: cf.status === 'Deceased' ? '#8c0000' : '#005032' }}>
                {cf.status.toUpperCase()}
              </span>
            )}
          </div>
          <h2 className="font-display text-3xl font-bold leading-tight">{cf.name}</h2>
          {cf.summary && !isEditing && <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed italic">{cf.summary}</p>}
        </div>
        <div className="flex gap-2 flex-shrink-0 items-center">
          {!isEditing ? (
            <>
              <button
                onClick={openAIModal}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--primary)', background: 'transparent' }}
                onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onMouseOut={e => (e.currentTarget.style.borderColor = '')}>
                ✦ AI
              </button>
              <button onClick={startEdit}
                className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground transition-colors"
                onMouseOver={e => (e.currentTarget.style.borderColor = tagColor)}
                onMouseOut={e => (e.currentTarget.style.borderColor = '')}>
                Edit
              </button>
              {!confirmDelete ? (
                <button onClick={() => setConfirmDelete(true)}
                  className="px-3 py-1.5 rounded-xl border text-xs transition-colors"
                  style={{ color: '#8c0000', borderColor: 'var(--border)' }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = '#8c0000')}
                  onMouseOut={e => (e.currentTarget.style.borderColor = '')}>
                  Delete
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setDeleting(true); onDelete() }} disabled={deleting}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium"
                    style={{ background: '#8c0000', color: '#fff', border: 'none', cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.65 : 1 }}>
                    {deleting ? 'Deleting…' : 'Confirm'}
                  </button>
                  <button onClick={() => setConfirmDelete(false)} className="text-xs text-muted-foreground hover:opacity-80">
                    Cancel
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <button onClick={saveEdit}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-white"
                style={{ background: tagColor, border: 'none', cursor: 'pointer' }}>
                Save
              </button>
              <button onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs text-muted-foreground">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Image URL field (edit mode only) */}
      {isEditing && (
        <div className="mb-4">
          <FieldLabel text="IMAGE URL" />
          <input type="text" value={(draft as CaseFile).image || ''}
            onChange={e => updateDraft('image', e.target.value || null)}
            placeholder="https://…"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:border-primary"
            style={{ color: 'var(--foreground)' }} />
        </div>
      )}

      {/* Tag-specific fields — grid in view mode, stacked form in edit mode */}
      {isEditing ? (
        <div className="space-y-5">
          {renderTagFields()}
        </div>
      ) : (
        <div className="grid gap-x-6 gap-y-5"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {renderViewGrid()}
        </div>
      )}

      {/* Relationships */}
      {cf.tag !== 'jutsu' && (
        <div className="mt-8">
          <div className="flex items-center justify-between border-t border-border pt-5 mb-4">
            <div className="font-eyebrow text-[10px] text-muted-foreground">RELATIONSHIPS</div>
            {isEditing && (
              <button onClick={() => setShowAddRel(s => !s)}
                className="text-xs"
                style={{ color: 'var(--primary)' }}>
                {showAddRel ? 'Cancel' : '+ Add'}
              </button>
            )}
          </div>

          {/* View mode: 2-column clickable tile grid */}
          {rels.length > 0 && !isEditing && (
            <div className="grid grid-cols-2 gap-2">
              {rels.map(rel => (
                <button key={rel.cfId}
                  onClick={() => onNavigateCF(rel.cfId)}
                  className="p-3 rounded-xl border text-left hover:border-primary transition-colors"
                  style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                  <span className="font-eyebrow text-[8px] px-1.5 py-0.5 rounded text-white inline-block mb-1.5"
                    style={{ background: tagColor }}>
                    {rel.type.toUpperCase()}
                  </span>
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{rel.cfName}</div>
                  {rel.familyDetail && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{rel.familyDetail}</div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Edit mode: list with delete buttons */}
          {rels.length > 0 && isEditing && (
            <div className="space-y-1.5">
              {rels.map(rel => (
                <div key={rel.cfId}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border"
                  style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-eyebrow text-[8px] px-1.5 py-0.5 rounded flex-shrink-0 text-white"
                      style={{ background: tagColor }}>
                      {rel.type.toUpperCase()}
                    </span>
                    <button onClick={() => onNavigateCF(rel.cfId)}
                      className="text-sm font-medium truncate hover:underline"
                      style={{ color: 'var(--foreground)' }}>
                      {rel.cfName}
                    </button>
                    {rel.familyDetail && (
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                        ({rel.familyDetail})
                      </span>
                    )}
                  </div>
                  <button onClick={() => removeRelationship(rel.cfId)}
                    className="text-sm flex-shrink-0 hover:opacity-60"
                    style={{ color: 'var(--muted-foreground)' }}>×</button>
                </div>
              ))}
            </div>
          )}

          {rels.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {isEditing ? 'No relationships yet. Add one below.' : 'None added yet.'}
            </p>
          )}

          {isEditing && showAddRel && (
            <div className="mt-3">
              <AddRelationship
                allCFs={allCaseFiles}
                currentCfId={cf.id}
                onAdd={addRelationship}
              />
            </div>
          )}
        </div>
      )}

      {/* Case Notes */}
      <div className="mt-8">
        <div className="flex items-center justify-between border-t border-border pt-5 mb-6"
          style={{ borderTopColor: tagColor + '60', borderTopWidth: '2px' }}>
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 rounded-full" style={{ background: tagColor }} />
            <div className="font-eyebrow text-[10px]" style={{ color: tagColor }}>CASE NOTES</div>
          </div>
          {!isEditing && (
            <button onClick={startEdit}
              className="text-xs"
              style={{ color: tagColor }}>
              + Edit Notes
            </button>
          )}
          {saveStatus === 'saving' && <span className="text-[9px] text-muted-foreground">Saving…</span>}
          {saveStatus === 'saved'  && <span className="text-[9px]" style={{ color: tagColor }}>Saved ✓</span>}
        </div>
        <div className="space-y-6">
          {sections.map(section => (
            <div key={section.key}>
              <div className="font-eyebrow text-[9px] mb-2" style={{ color: 'var(--primary)' }}>{section.label}</div>
              {isEditing ? (
                <RichTextEditor
                  key={cf.id + section.key}
                  initialValue={notesDraft[section.key] || ''}
                  onChange={html => handleNoteChange(section.key, html)}
                  placeholder={`${section.label.charAt(0) + section.label.slice(1).toLowerCase()} notes…`}
                  allCFs={allCaseFiles}
                />
              ) : notesDraft[section.key] ? (
                <NoteViewSection
                  html={notesDraft[section.key]}
                  onNavigate={onNavigateCF}
                />
              ) : (
                <p className="text-sm italic" style={{ color: 'var(--muted-foreground)' }}>No notes yet.</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Modal ──────────────────────────────────────────────────────────── */}
      {aiStage !== 'closed' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
          }}
          onClick={e => { if (e.target === e.currentTarget) setAiStage('closed') }}
        >
          <div style={{
            background: 'var(--surface)', borderRadius: '1.25rem', border: '1px solid var(--border)',
            width: '100%', maxWidth: '520px', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--shadow-soft)',
          }}>
            {/* Header */}
            <div style={{
              padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div className="font-eyebrow text-[9px]" style={{ color: 'var(--primary)', marginBottom: '0.15rem' }}>AI ASSISTANT</div>
                <h3 className="font-display font-bold text-base" style={{ color: 'var(--foreground)' }}>{cf.name}</h3>
              </div>
              <button onClick={() => setAiStage('closed')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>

              {/* No key stage */}
              {aiStage === 'nokey' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ textAlign: 'center', fontSize: '2rem' }}>✦</div>
                  <p className="text-sm" style={{ color: 'var(--foreground)', textAlign: 'center' }}>
                    No Gemini API key configured.
                  </p>
                  <p className="text-xs" style={{ color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.6 }}>
                    Add your free key in Settings to use AI generation. It only takes a minute.
                  </p>
                </div>
              )}

              {/* Configure stage */}
              {aiStage === 'configure' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Spoiler info */}
                  <div style={{
                    borderRadius: '0.75rem', padding: '0.75rem 1rem',
                    background: 'color-mix(in oklab, var(--primary) 10%, var(--surface))',
                    border: '1px solid color-mix(in oklab, var(--primary) 30%, transparent)',
                    fontSize: '0.8rem', color: 'var(--foreground)', display: 'flex', gap: '0.5rem',
                  }}>
                    <span style={{ color: 'var(--primary)' }}>🛡</span>
                    <span>Spoiler protection: AI will only use info up to episode {aiCurrentGlobal}.</span>
                  </div>

                  {aiError && (
                    <div style={{
                      borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.8rem',
                      background: 'color-mix(in oklab, #ef4444 10%, var(--surface))',
                      border: '1px solid color-mix(in oklab, #ef4444 30%, transparent)',
                      color: 'var(--foreground)',
                    }}>
                      <strong>Error:</strong> {aiError}
                    </div>
                  )}

                  {/* Episode range */}
                  <div>
                    <div className="font-eyebrow text-[9px] mb-2" style={{ color: 'var(--muted-foreground)' }}>EPISODE RANGE (optional)</div>
                    <p className="text-xs mb-3" style={{ color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                      Feed your personal notes from a range of episodes. Leave blank to generate from knowledge only.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>FROM EP#</div>
                        <input
                          type="number" min={1} max={720}
                          value={aiEpFrom ?? ''}
                          onChange={e => setAiEpFrom(e.target.value ? parseInt(e.target.value) : null)}
                          placeholder="e.g. 1"
                          style={{ width: '100%', borderRadius: '0.625rem', border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', outline: 'none', padding: '0.5rem 0.625rem', fontSize: '0.875rem' }}
                        />
                      </div>
                      <div style={{ paddingTop: '1.2rem', color: 'var(--muted-foreground)', fontSize: '0.75rem' }}>—</div>
                      <div style={{ flex: 1 }}>
                        <div className="font-eyebrow text-[9px] mb-1" style={{ color: 'var(--muted-foreground)' }}>TO EP#</div>
                        <input
                          type="number" min={1} max={720}
                          value={aiEpTo ?? ''}
                          onChange={e => setAiEpTo(e.target.value ? parseInt(e.target.value) : null)}
                          placeholder={aiEpFrom ? String(aiEpFrom) : 'e.g. 10'}
                          style={{ width: '100%', borderRadius: '0.625rem', border: '1px solid var(--border)', background: 'var(--muted)', color: 'var(--foreground)', outline: 'none', padding: '0.5rem 0.625rem', fontSize: '0.875rem' }}
                        />
                      </div>
                    </div>
                  </div>

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
                        onClick={() => processAIResponse(aiManualResponse)}
                        disabled={!aiManualResponse.trim()}
                        className="w-full mt-2 py-2 rounded-xl text-sm font-medium"
                        style={{ background: 'var(--primary)', color: 'var(--primary-foreground)', border: 'none', cursor: aiManualResponse.trim() ? 'pointer' : 'default', opacity: aiManualResponse.trim() ? 1 : 0.5 }}>
                        Import Pasted Response
                      </button>
                    </details>
                  </div>
                </div>
              )}

              {/* Loading stage */}
              {aiStage === 'loading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '1rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--primary)', borderTopColor: 'transparent' }} className="animate-spin" />
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Generating…</div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Analysing and building case file data</div>
                </div>
              )}

              {/* Preview stage */}
              {aiStage === 'preview' && aiData && (() => {
                const sections = getNoteSectionsAI(cf.tag)
                const noteChanges = aiData.notes
                  ? sections.filter(s => aiData.notes![s.key] && aiData.notes![s.key].trim())
                  : []
                const hasOverview = aiData.overview && Object.keys(aiData.overview).some(k => aiData.overview![k] && aiData.overview![k].trim())
                const newFiles = aiData.newCaseFiles || []

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {aiError && (
                      <div style={{ borderRadius: '0.75rem', padding: '0.75rem 1rem', fontSize: '0.8rem', background: 'color-mix(in oklab, #ef4444 10%, var(--surface))', border: '1px solid color-mix(in oklab, #ef4444 30%, transparent)', color: 'var(--foreground)' }}>
                        <strong>Error:</strong> {aiError}
                      </div>
                    )}
                    {/* Main CF preview */}
                    <div style={{ borderRadius: '0.875rem', border: '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{
                        padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)',
                        background: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="font-display font-bold text-sm" style={{ color: 'var(--foreground)' }}>{cf.name}</span>
                          <span className="font-eyebrow text-[9px] px-2 py-0.5 rounded" style={{ background: 'var(--primary)', color: 'white' }}>UPDATE</span>
                        </div>
                      </div>
                      <div style={{ padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {hasOverview && (
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            <span className="font-eyebrow text-[9px]">OVERVIEW:</span>{' '}
                            {Object.keys(aiData.overview!).filter(k => aiData.overview![k]).join(', ')}
                          </div>
                        )}
                        {noteChanges.map(s => (
                          <label key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={aiCheckedSections.has(s.key)}
                              onChange={e => {
                                setAiCheckedSections(prev => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(s.key); else next.delete(s.key)
                                  return next
                                })
                              }}
                            />
                            <span className="text-xs" style={{ color: 'var(--foreground)' }}>{s.label}</span>
                            {cf.notes?.[s.key]?.trim() && (
                              <span className="font-eyebrow text-[8px]" style={{ color: 'var(--muted-foreground)' }}>will append</span>
                            )}
                          </label>
                        ))}
                        {!hasOverview && noteChanges.length === 0 && (
                          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Nothing new to add to this case file.</p>
                        )}
                      </div>
                    </div>

                    {/* New case files */}
                    {newFiles.length > 0 && (
                      <div>
                        <div className="font-eyebrow text-[9px] mb-2" style={{ color: 'var(--muted-foreground)' }}>NEW CASE FILES</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {newFiles.map((nf, i) => (
                            <label key={i} style={{
                              display: 'flex', alignItems: 'center', gap: '0.75rem',
                              borderRadius: '0.75rem', border: '1px solid var(--border)',
                              padding: '0.625rem 0.875rem', cursor: 'pointer',
                            }}>
                              <input
                                type="checkbox"
                                checked={aiCheckedNewFiles.has(i)}
                                onChange={e => {
                                  setAiCheckedNewFiles(prev => {
                                    const next = new Set(prev)
                                    if (e.target.checked) next.add(i); else next.delete(i)
                                    return next
                                  })
                                }}
                              />
                              <div>
                                <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{nf.name}</span>
                                <span className="font-eyebrow text-[9px] ml-2" style={{ color: 'var(--muted-foreground)' }}>{nf.tag}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Done stage */}
              {aiStage === 'done' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 0', gap: '0.75rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem' }}>✦</div>
                  <h3 className="font-display font-bold text-lg" style={{ color: 'var(--foreground)' }}>Import Complete</h3>
                  <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                    {aiChanges} section{aiChanges !== 1 ? 's' : ''} updated
                    {aiCreated > 0 ? ` · ${aiCreated} new case file${aiCreated !== 1 ? 's' : ''} created` : ''}
                  </p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div style={{
              padding: '1rem 1.25rem', borderTop: '1px solid var(--border)',
              display: 'flex', gap: '0.625rem',
            }}>
              {aiStage === 'nokey' && (
                <>
                  <button onClick={() => setAiStage('closed')} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>
                    Close
                  </button>
                  <a href="/settings" style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'none', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    Go to Settings
                  </a>
                </>
              )}
              {aiStage === 'configure' && (
                <>
                  <button onClick={() => setAiStage('closed')} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={runAIGenerate} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                    ✦ Generate
                  </button>
                </>
              )}
              {aiStage === 'preview' && (
                <>
                  <button onClick={() => setAiStage('configure')} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontSize: '0.875rem', cursor: 'pointer' }}>
                    ← Back
                  </button>
                  <button onClick={runAIImport} disabled={aiImporting} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.875rem', fontWeight: 600, cursor: aiImporting ? 'default' : 'pointer', opacity: aiImporting ? 0.7 : 1 }}>
                    {aiImporting ? 'Importing…' : '✦ Import Selected'}
                  </button>
                </>
              )}
              {aiStage === 'done' && (
                <button onClick={() => setAiStage('closed')} style={{ flex: 1, padding: '0.625rem', borderRadius: '0.75rem', border: 'none', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Appeared In */}
      {showAppearances && appearances.length > 0 && (
        <div className="mt-8">
          <div className="border-t border-border pt-5 mb-4">
            <div className="font-eyebrow text-[10px] text-muted-foreground">
              APPEARED IN <span className="font-normal">({appearances.length} episode{appearances.length !== 1 ? 's' : ''})</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {appearances.map(ep => (
              <button key={ep.id}
                onClick={() => onGoToEpisode(ep.global_episode, ep.series)}
                className="text-xs px-3 py-1.5 rounded-xl border hover:border-primary transition-colors text-left"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)', background: 'var(--muted)' }}>
                <span className="font-eyebrow text-[8px] block mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
                  {ep.series === 'naruto' ? 'NARUTO' : 'SHIPPUDEN'} EP {ep.episode}
                </span>
                <span className="block" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ep.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
