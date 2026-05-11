// ── Gemini AI utility ─────────────────────────────────────────────────────────
// Copied directly from the single-file reference implementation.

export type CaseFileForPrompt = {
  id: string
  name: string
  tag: string
  summary?: string | null
  village?: string | null
  clan?: string | null
  group?: string | null
  rank?: string | null
  status?: string | null
  kekkei_genkai?: string | null
  voice_actor?: string | null
  jutsu_type?: string | null
  chakra_nature?: string[] | null
  group_type?: string | null
  group_type_other?: string | null
  affiliation?: string | null
  nation?: string | null
  kage_title?: string | null
  alliance_status?: string | null
  region_nation?: string | null
  location_type?: string | null
  location_type_other?: string | null
  event_type?: string | null
  event_type_other?: string | null
  outcome?: string | null
  arc?: string | null
  notes?: Record<string, string> | null
}

export type EpisodeForPrompt = {
  id: string
  global_episode: number
  series: string
  episode: number
  name: string
  type: string
  watched: boolean
  personal_notes?: string | null
}

// ── API call ──────────────────────────────────────────────────────────────────

export async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 16000,
          responseMimeType: 'application/json',
        },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Gemini API error ${res.status}`)
  }
  const json = await res.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Empty response from Gemini.')
  return text
}

// ── Response parsing — copied word-for-word from single-file ─────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseAIResponse(raw: string): any {
  // Step 1 — strip markdown fences
  let cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  // Step 2 — extract from first [ or {
  const arrStart = cleaned.indexOf('[')
  const objStart = cleaned.indexOf('{')
  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    cleaned = cleaned.substring(arrStart)
  } else if (objStart !== -1) {
    cleaned = cleaned.substring(objStart)
  }

  // Step 3 — fix trailing commas
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')

  // Step 4 — fix escaped HTML from Gemini
  cleaned = cleaned.replace(/\\</g, '<').replace(/\\>/g, '>').replace(/\\"/g, '\\"')

  // Step 5 — try JSON.parse on full cleaned string
  try { return normalise(JSON.parse(cleaned)) } catch {}

  // Step 6 — try closing truncated array/object
  const truncationFixes = [
    cleaned + '"}]}]',
    cleaned + '"}]',
    cleaned + '"]',
    cleaned + '}]',
    cleaned + ']',
  ]
  for (const attempt of truncationFixes) {
    try { return normalise(JSON.parse(attempt)) } catch {}
  }

  // Step 7 — SALVAGE: extract every complete {} object regardless
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const salvaged: any[] = []
  let depth = 0
  let start = -1
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (depth === 0) start = i
      depth++
    } else if (cleaned[i] === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        try {
          const obj = JSON.parse(cleaned.substring(start, i + 1))
          salvaged.push(obj)
        } catch {}
        start = -1
      }
    }
  }
  if (salvaged.length > 0) {
    console.log('Salvaged', salvaged.length, 'complete objects from truncated response')
    return normalise(salvaged)
  }

  // Nothing worked
  throw new Error('Could not parse JSON. Check the response format and try again.')
}

// Normalise overview fields that the AI occasionally returns as a string instead of array
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseOverview(cf: any): any {
  const ARRAY_FIELDS = ['abilities', 'groups', 'relationships']
  if (!cf || !cf.overview) return cf
  for (const field of ARRAY_FIELDS) {
    if (cf.overview[field] && typeof cf.overview[field] === 'string') {
      cf.overview[field] = [cf.overview[field]]
    }
  }
  return cf
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalise(parsed: any): any {
  if (Array.isArray(parsed)) return parsed.map(item => sanitiseSummaryInItem(normaliseOverview(item)))
  if (parsed && typeof parsed === 'object') return sanitiseSummaryInItem(normaliseOverview(parsed))
  return parsed
}

/** Strip HTML tags from the summary field — summaries must be plain text */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitiseSummaryInItem(item: any): any {
  if (!item || typeof item !== 'object') return item
  if (item.overview?.summary && typeof item.overview.summary === 'string') {
    item.overview.summary = item.overview.summary.replace(/<[^>]*>/g, '').trim()
  }
  return item
}

export function sanitiseSummary(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

function fixRogueQuotes(text: string): string {
  let result = '', inString = false, i = 0
  while (i < text.length) {
    const ch = text[i]
    if (!inString) {
      result += ch
      if (ch === '"') inString = true
      i++
    } else {
      if (ch === '\\') {
        result += ch; i++
        if (i < text.length) { result += text[i]; i++ }
        continue
      }
      if (ch === '"') {
        const rest = text.substring(i + 1).trimStart()
        const next = rest[0] || ''
        if (next === ':' || next === ',' || next === '}' || next === ']' || next === '') {
          result += ch; inString = false
        } else { result += '\\"' }
        i++; continue
      }
      result += ch; i++
    }
  }
  return result
}

// ── Overview block builder ────────────────────────────────────────────────────

function buildOverviewBlock(cf: CaseFileForPrompt): string {
  const fieldMap: Record<string, string[]> = {
    characters: ['summary', 'village', 'clan', 'group', 'rank', 'status', 'kekkeiGenkai', 'voiceActor'],
    jutsu:      ['summary', 'jutsuType', 'chakraNature', 'status'],
    clans:      ['summary', 'village', 'kekkeiGenkai', 'status'],
    groups:     ['summary', 'groupType', 'affiliation', 'status'],
    villages:   ['summary', 'nation', 'kageTitle', 'allianceStatus'],
    locations:  ['summary', 'regionNation', 'locationType'],
    events:     ['summary', 'eventType', 'outcome', 'arc'],
    other:      ['summary'],
  }
  const dbKeyMap: Record<string, keyof CaseFileForPrompt> = {
    summary: 'summary', village: 'village', clan: 'clan', group: 'group',
    rank: 'rank', status: 'status', kekkeiGenkai: 'kekkei_genkai', voiceActor: 'voice_actor',
    jutsuType: 'jutsu_type', chakraNature: 'chakra_nature',
    groupType: 'group_type', affiliation: 'affiliation',
    nation: 'nation', kageTitle: 'kage_title', allianceStatus: 'alliance_status',
    regionNation: 'region_nation', locationType: 'location_type',
    eventType: 'event_type', outcome: 'outcome', arc: 'arc',
  }
  const keys = fieldMap[cf.tag] || ['summary']
  return keys.map(k => {
    const dbKey = dbKeyMap[k] || k as keyof CaseFileForPrompt
    const raw = cf[dbKey]
    const val = Array.isArray(raw) ? raw.join(', ') : (raw || '')
    return `  ${k}: ${val ? `"${val}"` : '(empty)'}`
  }).join('\n')
}

// ── Tag schema ────────────────────────────────────────────────────────────────

function buildTagSchema(tag: string): string {
  const schemas: Record<string, string> = {
    characters: `Overview fields:
  summary (text) — one compelling sentence
  village (linked dropdown — must match an existing Villages case file name, or leave empty)
  clan (linked dropdown — must match an existing Clans case file name, or leave empty)
  group (linked dropdown — must match an existing Groups case file name, or leave empty)
  rank (dropdown) → "Academy Student" | "Genin" | "Chunin" | "Jonin" | "ANBU" | "Sannin" | "Kage" | "Missing-nin" | "Unknown"
  status (dropdown) → "Alive" | "Deceased" | "Unknown"
  kekkeiGenkai (text) — e.g. "Sharingan"
  voiceActor (text) — e.g. "Junko Takeuchi"

Note sections (keys you may populate):
  background   — history, upbringing, backstory
  personality  — character traits, mannerisms, values
  appearance   — physical description (EXCEPTION: may use training knowledge)
  abilities    — jutsu, powers, fighting style
  roleInStory  — their role in the narrative`,

    jutsu: `Overview fields:
  summary (text) — one compelling sentence
  jutsuType (dropdown) → "Ninjutsu" | "Taijutsu" | "Genjutsu" | "Fuinjutsu" | "Senjutsu" | "Kenjutsu" | "Other"
  chakraNature (dropdown) → "Fire" | "Wind" | "Lightning" | "Earth" | "Water" | "None" | "Multiple"
  status (dropdown) → "Active" | "Forbidden" | "Lost" | "Unknown"

Note sections:
  howItWorks   — mechanics and explanation
  notableUses  — memorable moments this jutsu was used`,

    clans: `Overview fields:
  summary (text) — one compelling sentence
  village (text — village name)
  kekkeiGenkai (text)
  status (dropdown) → "Active" | "Disbanded" | "Destroyed" | "Unknown"

Note sections:
  historyOrigin      — clan history and origins
  abilitiesKekkei    — special abilities and kekkei genkai
  notableMembersNote — notable members`,

    groups: `Overview fields:
  summary (text) — one compelling sentence
  groupType (dropdown) → "Ninja Team" | "Criminal Organisation" | "Military Unit" | "Political Body" | "Other"
  affiliation (text — village or org name)
  status (dropdown) → "Active" | "Disbanded" | "Destroyed" | "Unknown"

Note sections:
  overviewPurpose    — what the group is and its purpose
  history            — group history
  notableActivities  — key operations and events`,

    villages: `Overview fields:
  summary (text) — one compelling sentence
  nation (text — e.g. "Land of Fire")
  kageTitle (dropdown) → "Hokage" | "Kazekage" | "Mizukage" | "Raikage" | "Tsuchikage" | "Other"
  allianceStatus (dropdown) → "Allied" | "Neutral" | "Enemy" | "Unknown"

Note sections:
  historyBackground  — village history
  cultureReputation  — culture and reputation
  roleInStory        — role in the narrative`,

    locations: `Overview fields:
  summary (text) — one compelling sentence
  regionNation (text — region or country)
  locationType (dropdown) → "Forest" | "Mountain" | "City" | "Ruins" | "Training Ground" | "Other"

Note sections:
  description        — physical description
  significantEvents  — important events that happened here`,

    events: `Overview fields:
  summary (text) — one compelling sentence
  eventType (dropdown) → "Battle" | "Invasion" | "Political" | "Revelation" | "Death" | "Tournament" | "Other"
  outcome (dropdown) → "Victory" | "Defeat" | "Draw" | "Ongoing" | "Unknown"
  arc (text — arc name)

Note sections:
  whatHappened   — what took place
  outcomeImpact  — outcome and consequences`,

    other: `Overview fields:
  summary (text) — one compelling sentence

Note sections:
  notes — general notes`,
  }
  return schemas[tag] || schemas.other
}

// ── Note sections per tag ─────────────────────────────────────────────────────

const NOTE_SECTIONS_AI: Record<string, { key: string; label: string }[]> = {
  characters: [
    { key: 'background',  label: 'BACKGROUND' },
    { key: 'personality', label: 'PERSONALITY' },
    { key: 'appearance',  label: 'APPEARANCE' },
    { key: 'abilities',   label: 'ABILITIES & POWERS' },
    { key: 'roleInStory', label: 'ROLE IN STORY' },
  ],
  jutsu: [
    { key: 'howItWorks',  label: 'HOW IT WORKS' },
    { key: 'notableUses', label: 'NOTABLE USES' },
  ],
  clans: [
    { key: 'historyOrigin',      label: 'HISTORY & ORIGIN' },
    { key: 'abilitiesKekkei',    label: 'ABILITIES & KEKKEI GENKAI' },
    { key: 'notableMembersNote', label: 'NOTABLE MEMBERS' },
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

export function getNoteSectionsAI(tag: string) {
  return NOTE_SECTIONS_AI[tag] || NOTE_SECTIONS_AI.other
}

// ── Case file prompt builder ──────────────────────────────────────────────────

export function buildCaseFilePrompt(
  cf: CaseFileForPrompt,
  allCFs: CaseFileForPrompt[],
  episodes: EpisodeForPrompt[],
  currentGlobalEp: number,
  selectedEpFrom: number | null,
  selectedEpTo: number | null,
): string {
  const currentEp = episodes.find(e => e.global_episode === currentGlobalEp)
  const spoilerEp = currentEp
    ? `${currentEp.series === 'naruto' ? 'Naruto' : 'Shippuden'} Episode ${currentEp.episode}: "${currentEp.name}"`
    : `Episode ${currentGlobalEp}`

  const sections = getNoteSectionsAI(cf.tag)

  // Current notes block (strip HTML tags for readability)
  const currentNotes = sections.map(s => {
    const raw = cf.notes?.[s.key] || ''
    const text = raw.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim()
    return `  ${s.label}: ${text ? `"${text.slice(0, 300)}${text.length > 300 ? '…' : ''}"` : '(empty)'}`
  }).join('\n')

  const currentOverview = buildOverviewBlock(cf)

  // Episode notes block
  let episodeNotesBlock = '(No episode range selected — generate from knowledge only)'
  if (selectedEpFrom !== null) {
    const epTo = selectedEpTo ?? selectedEpFrom
    const selectedEps = episodes
      .filter(ep => ep.type !== 'movie' && ep.global_episode >= selectedEpFrom && ep.global_episode <= epTo)
      .sort((a, b) => a.global_episode - b.global_episode)

    const notesLines = selectedEps.map(ep => {
      const notes = ep.personal_notes || ''
      if (!notes.trim()) return null
      const s = ep.series === 'naruto' ? 'Naruto' : 'Shippuden'
      return `${s} Episode ${ep.episode}: "${ep.name}"\n${notes.trim()}`
    }).filter(Boolean)

    episodeNotesBlock = notesLines.length > 0
      ? notesLines.join('\n\n---\n\n')
      : '(Episodes selected but no personal notes recorded for this range)'
  }

  const schema = buildTagSchema(cf.tag)
  const sectionsList = sections.map(s => `  ${s.key}: "${s.label}"`).join('\n')

  const existingList = allCFs
    .filter(c => c.id !== cf.id)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => `  - "${c.name}" (${c.tag})`)
    .join('\n')

  return `You are a JSON generator for a Naruto watch companion app. You produce structured data that gets parsed directly by JSON.parse(). Any formatting mistake will silently break the import.

════════════════════════════════
THIS IS A CASE FILE — NOT AN EPISODE SUMMARY
════════════════════════════════
You are updating a structured profile for: "${cf.name}" (${cf.tag})

A case file is a living reference document about ONE subject — a character, jutsu,
location etc. You are NOT writing a summary of episodes. You are NOT retelling what happened.
You are writing structured profile information ABOUT THIS SUBJECT.

Only add information that is genuinely new and not already present in the current content.
If nothing new applies to a section — omit that section key entirely from your response.
If no sections need updating — return an empty object: {}

════════════════════════════════
KNOWLEDGE RESTRICTION — CRITICAL
════════════════════════════════
You MUST only use information from the EPISODE NOTES provided above.
Do NOT use your own training knowledge about Naruto, its characters, plot, or lore.
Do NOT add any information that is not explicitly present in the episode notes.
If the episode notes are empty or sparse, generate minimal content — do not fill
gaps with knowledge from your training data.

If no episode notes are provided, return an empty object: {}

EXCEPTION — APPEARANCE SECTION ONLY:
For character case files, the "appearance" note section is exempt from the above rule.
Appearance (hair colour, eye colour, clothing, build, distinguishing features) is
observable, factual, and non-spoiler information. You MAY use your training knowledge
to populate the appearance section even when episode notes are absent or sparse.
Always populate appearance if you recognise the character — do not leave it empty.

SPOILER PROTECTION: Additionally, only use information revealed ON or BEFORE:
${spoilerEp}

════════════════════════════════
EPISODE NOTES (your personal observations)
════════════════════════════════
${episodeNotesBlock}

Use these notes to understand what is significant. Let them guide what you write.
Do not reproduce them verbatim — use them as context.

════════════════════════════════
CURRENT STATE OF THIS CASE FILE
════════════════════════════════
Name: "${cf.name}"
Tag: ${cf.tag}

Current overview fields:
${currentOverview}

Current note sections:
${currentNotes}

════════════════════════════════
WHAT YOU MUST RETURN
════════════════════════════════
A single raw JSON object. Nothing else.
• First character: {
• Last character: }
• No markdown, no code fences, no preamble, no explanation.

Schema:
{
  "overview": {
    "summary": "plain text only — no HTML, no formatting, one sentence",
    ...other overview fields...
  },
  "notes": {
    "sectionKey": "<p>HTML content</p>",
    ...only sections with new content...
  },
  "newCaseFiles": [
    {
      "name": "Subject Name",
      "tag": "tag type",
      "overview": { "summary": "plain text", ...fields... },
      "notes": { "sectionKey": "<p>HTML</p>" }
    }
  ]
}

Rules:
• Only include keys for sections with genuinely new content
• "newCaseFiles" — include ONLY if linked subjects don't have a case file yet
  (e.g. a character's clan or village that isn't in the existing files list)
• Overview fields already filled — still include them, app only writes to empty fields
• Dropdown values must exactly match schema options — case-sensitive
• If a field is not applicable or you are unsure — omit it entirely

════════════════════════════════
TAG SCHEMA — ${cf.tag.toUpperCase()}
════════════════════════════════
${schema}

NOTE SECTIONS FOR THIS TAG (use ONLY these section keys):
${sectionsList}

════════════════════════════════
COLOUR SPANS — CRITICAL RULE
════════════════════════════════
You may use colour spans in note sections. ONLY these hex codes:
  #ff0000 — red: danger, villains, threats, death
  #c8a96e — gold: important items, key moments, themes
  #5a9e5a — green: allies, positive traits, safe
  #4a9ef0 — blue: locations, authority, law
  #9b59b6 — purple: mysteries, unknown, theories
  #ff6600 — orange: warnings, conflict

⚠️ MANDATORY: Inside a JSON string, ALL double quotes MUST be escaped with \\
A colour span MUST look EXACTLY like this:
  <span style=\\"color:#ff0000\\">text here</span>

WRONG (breaks import):
  <span style="color:#ff0000">text here</span>

If unsure — do NOT use colour spans. Plain HTML is always safe.

════════════════════════════════
CASE FILE LINKS
════════════════════════════════
When mentioning a subject that has its own case file, write:
  [LINK:Exact Case File Name]

The name must EXACTLY match (case-sensitive) either:
• An existing case file from the list below, OR
• A new case file you are creating in "newCaseFiles"

Wrong names silently fail. Use links generously throughout note sections.

════════════════════════════════
EXISTING CASE FILES (for linking)
════════════════════════════════
${existingList || '  (none yet)'}

════════════════════════════════
ALLOWED HTML IN NOTE SECTIONS
════════════════════════════════
<p> <strong> <em> <u> <ul> <ol> <li> and colour spans as above.
No other inline styles. No class attributes. No script tags.
HTML must be RAW — write <p>, not \\<p\\> or &lt;p&gt;
Double quotes inside strings MUST be escaped: \\"
No trailing commas. No literal newlines inside strings.

════════════════════════════════
PARAGRAPH FORMATTING
════════════════════════════════
Use multiple <p> tags to break content into natural paragraphs.
Start a new <p> for each new topic, idea, or aspect of the subject.
Never put all content into one long paragraph.

Good structure example:
  <p>First idea or topic about the subject.</p>
  <p>Second distinct idea, new aspect, or related point.</p>
  <p>Third point if applicable — keep paragraphs concise.</p>

For lists of abilities, traits, or facts — use <ul><li> instead of paragraphs:
  <ul>
    <li><strong>Ability Name</strong> — brief description</li>
    <li><strong>Another Ability</strong> — brief description</li>
  </ul>

════════════════════════════════
EXAMPLE RESPONSE
════════════════════════════════
{
  "overview": {
    "summary": "The Nine-Tails Jinchuriki and future Hokage of the Hidden Leaf.",
    "rank": "Genin",
    "status": "Alive"
  },
  "notes": {
    "background": "<p><strong>Naruto Uzumaki</strong> was born on the night the <span style=\\"color:#ff0000\\">Nine-Tails</span> attacked [LINK:Hidden Leaf (Konoha)]. His father sealed the beast within him at the cost of his own life.</p>",
    "abilities": "<ul><li><strong>Shadow Clone Jutsu</strong> — his signature technique, learned from the Scroll of Seals</li></ul>"
  },
  "newCaseFiles": []
}`
}

// ── Episode-based case file generation prompt ─────────────────────────────────

export function buildEpisodeGenPrompt(
  ep: EpisodeForPrompt,
  allCFs: CaseFileForPrompt[],
  episodes: EpisodeForPrompt[],
  currentGlobalEp: number,
): string {
  const currentEp = episodes.find(e => e.global_episode === currentGlobalEp)
  const spoilerEp = currentEp
    ? `${currentEp.series === 'naruto' ? 'Naruto' : 'Shippuden'} Episode ${currentEp.episode}: "${currentEp.name}"`
    : `Episode ${currentGlobalEp}`

  const s = ep.series === 'naruto' ? 'Naruto' : 'Shippuden'
  const epLabel = `${s} Episode ${ep.episode}: "${ep.name}"`
  const notes = ep.personal_notes || ''

  const existingList = allCFs
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => `  - "${c.name}" (${c.tag})`)
    .join('\n')

  return `You are a JSON generator for a Naruto watch companion app. You produce structured case file data parsed directly by JSON.parse(). Any formatting mistake silently breaks the import.

════════════════════════════════
EPISODE
════════════════════════════════
${epLabel}

════════════════════════════════
YOUR PERSONAL NOTES FOR THIS EPISODE
════════════════════════════════
${notes.trim() || '(No personal notes recorded — use your knowledge of this episode)'}

════════════════════════════════
KNOWLEDGE RESTRICTION — CRITICAL
════════════════════════════════
You MUST only use information from the PERSONAL NOTES provided above.
Do NOT use your own training knowledge about Naruto, its characters, plot, or lore.
Do NOT invent or infer subjects that are not explicitly mentioned in the notes.
If the notes are empty, return an empty array: []

SPOILER PROTECTION: Additionally, only use information revealed ON or BEFORE:
${spoilerEp}

════════════════════════════════
YOUR TASK
════════════════════════════════
Look at the episode above and identify subjects that are worth tracking as case
files but do NOT yet exist in the app (see existing files list below).

Create new case files ONLY for subjects that:
• Appeared or were mentioned in this episode
• Are genuinely significant enough to track
• Do NOT already have a case file (check the existing list carefully)

DO NOT update or re-create existing case files.
DO NOT create a file for something trivial or barely mentioned.

For each new case file, populate it with what this episode revealed.
Do NOT include information from future episodes.

IMPORTANT: If no personal notes are provided for this episode, return [].
Do not create case files based on your knowledge of what happens in this episode.
Only create files for subjects explicitly mentioned in the personal notes above.

════════════════════════════════
WHAT YOU MUST RETURN
════════════════════════════════
A single raw JSON array of new case files. Nothing else.
• First character: [
• Last character: ]

Each entry:
{
  "name": "Subject Name",
  "tag": "characters|jutsu|clans|groups|villages|locations|events|other",
  "overview": {
    "summary": "plain text only — no HTML — one compelling sentence",
    ...other overview fields for this tag (see schema below)...
  },
  "notes": {
    "sectionKey": "<p>HTML content</p>",
    ...only the note sections relevant to this tag...
  }
}

════════════════════════════════
TAG SCHEMAS
════════════════════════════════

characters:
  overview: summary(text), village(text — name of village), clan(text — clan name),
    group(text — team/org name), rank(dropdown) → "Academy Student"|"Genin"|"Chunin"|"Jonin"|"ANBU"|"Sannin"|"Kage"|"Missing-nin"|"Unknown",
    status(dropdown) → "Alive"|"Deceased"|"Unknown",
    kekkeiGenkai(text), voiceActor(text)
  notes sections: background | personality | appearance | abilities | roleInStory

jutsu:
  overview: summary(text), jutsuType(dropdown) → "Ninjutsu"|"Taijutsu"|"Genjutsu"|"Fuinjutsu"|"Senjutsu"|"Kenjutsu"|"Other",
    chakraNature(dropdown) → "Fire"|"Wind"|"Lightning"|"Earth"|"Water"|"None"|"Multiple",
    status(dropdown) → "Active"|"Forbidden"|"Lost"|"Unknown"
  notes sections: howItWorks | notableUses

clans:
  overview: summary(text), village(text), kekkeiGenkai(text),
    status(dropdown) → "Active"|"Disbanded"|"Destroyed"|"Unknown"
  notes sections: historyOrigin | abilitiesKekkei | notableMembersNote

groups:
  overview: summary(text), groupType(dropdown) → "Ninja Team"|"Criminal Organisation"|"Military Unit"|"Political Body"|"Other",
    affiliation(linked), status(dropdown) → "Active"|"Disbanded"|"Destroyed"|"Unknown"
  notes sections: overviewPurpose | history | notableActivities

villages:
  overview: summary(text), nation(text), kageTitle(dropdown) → "Hokage"|"Kazekage"|"Mizukage"|"Raikage"|"Tsuchikage"|"Other",
    allianceStatus(dropdown) → "Allied"|"Neutral"|"Enemy"|"Unknown"
  notes sections: historyBackground | cultureReputation | roleInStory

locations:
  overview: summary(text), regionNation(text),
    locationType(dropdown) → "Forest"|"Mountain"|"City"|"Ruins"|"Training Ground"|"Other"
  notes sections: description | significantEvents

events:
  overview: summary(text), eventType(dropdown) → "Battle"|"Invasion"|"Political"|"Revelation"|"Death"|"Tournament"|"Other",
    outcome(dropdown) → "Victory"|"Defeat"|"Draw"|"Ongoing"|"Unknown"
  notes sections: whatHappened | outcomeImpact

other:
  overview: summary(text)
  notes sections: notes

════════════════════════════════
COLOUR SPANS — CRITICAL
════════════════════════════════
Use ONLY these hex codes for colour spans:
  #ff0000 red, #c8a96e gold, #5a9e5a green, #4a9ef0 blue, #9b59b6 purple, #ff6600 orange

⚠️ Inside JSON strings, ALL double quotes MUST be escaped with \\
CORRECT:  <span style=\\"color:#ff0000\\">text</span>
WRONG:    <span style="color:#ff0000">text</span>

If unsure — do not use colour spans.

════════════════════════════════
CASE FILE LINKS
════════════════════════════════
To link to an existing case file or one you are creating in this response:
  [LINK:Exact Case File Name]

Use links generously in note sections.

════════════════════════════════
EXISTING CASE FILES — DO NOT RECREATE THESE
════════════════════════════════
${existingList || '  (none yet — create freely)'}

════════════════════════════════
PARAGRAPH FORMATTING
════════════════════════════════
Use multiple <p> tags to break content into natural paragraphs.
Start a new <p> for each new topic, idea, or aspect of the subject.
Never put all content into one long paragraph.

Good structure example:
  <p>First idea or topic about the subject.</p>
  <p>Second distinct idea, new aspect, or related point.</p>
  <p>Third point if applicable — keep paragraphs concise.</p>

For lists of abilities, traits, or facts — use <ul><li> instead of paragraphs:
  <ul>
    <li><strong>Ability Name</strong> — brief description</li>
    <li><strong>Another Ability</strong> — brief description</li>
  </ul>

════════════════════════════════
JSON FORMAT REMINDERS
════════════════════════════════
• HTML must be RAW: write <p>, not \\<p\\> or &lt;p&gt;
• Double quotes inside strings MUST be escaped: \\"
• No trailing commas. No comments. No literal newlines inside strings.
• Dropdown values must exactly match options — case-sensitive.
• Return [] if nothing new is worth creating.
• Response: first character [ last character ] — nothing else.`
}
