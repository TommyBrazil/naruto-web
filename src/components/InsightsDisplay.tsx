'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const TAG_COLOURS: Record<string, string> = {
  characters: '#b45000',
  jutsu:      '#0050b4',
  clans:      '#8c0000',
  groups:     '#005032',
  villages:   '#006e32',
  locations:  '#143c82',
  events:     '#827800',
  other:      '#5a0082',
}

const SERIES_ORDER = ['naruto', 'shippuden', 'boruto']

function seriesLabel(s: string): string {
  if (s === 'naruto')    return 'Naruto'
  if (s === 'shippuden') return 'Shippuden'
  if (s === 'boruto')    return 'Boruto'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

type Props = {
  watchedEps: number
  totalEps: number
  fillerEps: number
  seriesMap: Record<string, { total: number; watched: number }>
  totalHours: number
  arcsCompleted: number
  totalArcs: number
  streak: number
  ratingDist: Record<number, number>
  ratedEpsCount: number
  avgRating: string | null
  totalFights: number
  avgFightRating: string | null
  fightRatingDist: Record<number, number>
  decidedFights: number
  undecidedFights: number
  mostFoughtChar: { name: string; count: number } | null
  bestRatedFight: { title: string; rating: number } | null
  deadliestFight: { title: string; deathCount: number } | null
  bestFightArc: { name: string; avgRating: number } | null
  tagMap: Record<string, number>
  totalCaseFiles: number
  theoryBreakdown: { ongoing: number; correct: number; wrong: number }
  totalQuotes: number
  totalMoments: number
  totalChars: number
  totalBestFights: number
  progressData: { date: string; count: number }[]
}

/* ── Section header ────────────────────────────────────────────────────────── */

function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 20 }}>
      <span className="font-eyebrow" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted-foreground)' }}>
        SECTION {num}
      </span>
      <span className="font-display font-bold" style={{ fontSize: '1.5rem', color: 'var(--foreground)', lineHeight: 1 }}>
        {title}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)' }} />
}

/* ── Small stat card ────────────────────────────────────────────────────────── */

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      borderRadius: '0.875rem', border: '1px solid var(--border)', background: 'var(--surface)',
      padding: '1rem', display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted-foreground)' }}>
        {label}
      </div>
      <div className="font-display font-bold" style={{ fontSize: '1.75rem', color: 'var(--foreground)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

/* ── Text info card (for fight extras) ─────────────────────────────────────── */

function InfoCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      borderRadius: '0.875rem', border: '1px solid var(--border)', background: 'var(--surface)',
      padding: '1rem', display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted-foreground)' }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{sub}</div>}
    </div>
  )
}

/* ── Animated completion ring ──────────────────────────────────────────────── */

function CompletionRing({ pct, watched, total }: { pct: number; watched: number; total: number }) {
  const [animPct, setAnimPct] = useState(0)

  useEffect(() => {
    const id = setTimeout(() => setAnimPct(pct), 120)
    return () => clearTimeout(id)
  }, [pct])

  const r             = 80
  const cx            = 100
  const cy            = 100
  const circumference = 2 * Math.PI * r
  const dashoffset    = circumference - (animPct / 100) * circumference

  return (
    <div style={{ position: 'relative', width: 220, height: 220 }}>
      <svg width="220" height="220" viewBox="0 0 200 200">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={14} />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke="var(--primary)" strokeWidth={14} strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          transform={`rotate(-90, ${cx}, ${cy})`}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span className="font-display font-bold" style={{ fontSize: 44, lineHeight: 1, color: 'var(--foreground)' }}>
          {pct}%
        </span>
        <span className="font-eyebrow" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginTop: 4 }}>
          COMPLETE
        </span>
        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 6 }}>
          {watched.toLocaleString()} / {total.toLocaleString()} eps
        </span>
      </div>
    </div>
  )
}

/* ── Rating bar row ────────────────────────────────────────────────────────── */

function RatingBar({ rating, count, maxCount, color = 'var(--primary)' }: {
  rating: number; count: number; maxCount: number; color?: string
}) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="font-eyebrow" style={{ fontSize: 10, color: 'var(--muted-foreground)', width: 14, textAlign: 'right', flexShrink: 0 }}>
        {rating}
      </span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, background: color, transition: 'width 0.7s cubic-bezier(.4,0,.2,1)' }} />
      </div>
      <span style={{ width: 24, textAlign: 'right', fontSize: 11, color: count > 0 ? 'var(--foreground)' : 'transparent' }}>
        {count}
      </span>
    </div>
  )
}

/* ── Tag donut chart ───────────────────────────────────────────────────────── */

function TagDonut({ tagMap }: { tagMap: Record<string, number> }) {
  const entries       = Object.entries(tagMap).sort((a, b) => b[1] - a[1])
  const total         = entries.reduce((s, [, v]) => s + v, 0)
  const r             = 56
  const cx            = 80
  const cy            = 80
  const strokeWidth   = 24
  const circumference = 2 * Math.PI * r

  if (total === 0) return <p style={{ fontSize: 14, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No case files yet.</p>

  let cumOffset = 0
  const segments = entries.map(([tag, count]) => {
    const len = (count / total) * circumference
    const seg = { tag, count, len, offset: cumOffset }
    cumOffset += len
    return seg
  })

  return (
    <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <svg width="160" height="160" viewBox="0 0 160 160">
          <g transform={`rotate(-90, ${cx}, ${cy})`}>
            {segments.map(seg => (
              <circle
                key={seg.tag}
                cx={cx} cy={cy} r={r} fill="none"
                stroke={TAG_COLOURS[seg.tag] ?? '#888'}
                strokeWidth={strokeWidth}
                strokeDasharray={`${seg.len} ${circumference - seg.len}`}
                strokeDashoffset={-seg.offset}
              />
            ))}
          </g>
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span className="font-display font-bold" style={{ fontSize: 26, lineHeight: 1, color: 'var(--foreground)' }}>{total}</span>
          <span className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--muted-foreground)', marginTop: 2 }}>FILES</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {segments.map(seg => (
          <div key={seg.tag} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: TAG_COLOURS[seg.tag] ?? '#888', flexShrink: 0 }} />
            <span className="capitalize" style={{ fontSize: 13, color: 'var(--foreground)' }}>{seg.tag}</span>
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', marginLeft: 2 }}>{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Watch progress line graph ─────────────────────────────────────────────── */

function ProgressGraph({ data, total }: { data: { date: string; count: number }[]; total: number }) {
  if (data.length < 2) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 160, borderRadius: '1rem', border: '1px solid var(--border)', background: 'var(--surface)',
      }}>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Start watching to see your progress graph</p>
      </div>
    )
  }

  const W   = 800
  const H   = 180
  const PAD = { top: 16, right: 24, bottom: 32, left: 44 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top  - PAD.bottom

  const minDate   = new Date(data[0].date).getTime()
  const maxDate   = new Date(data[data.length - 1].date).getTime()
  const dateRange = maxDate - minDate || 1

  function xPos(dateStr: string) { return PAD.left + ((new Date(dateStr).getTime() - minDate) / dateRange) * innerW }
  function yPos(count: number)   { return PAD.top + innerH - (count / total) * innerH }

  const points  = data.map(d => `${xPos(d.date)},${yPos(d.count)}`).join(' L ')
  const pathD   = `M ${points}`
  const firstX  = xPos(data[0].date)
  const lastX   = xPos(data[data.length - 1].date)
  const bottomY = PAD.top + innerH
  const fillD   = `M ${firstX},${bottomY} L ${points} L ${lastX},${bottomY} Z`

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(pct => ({ value: Math.round(pct * total), y: yPos(pct * total) }))
  const xLabels = data.length >= 3
    ? [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]]
    : data

  return (
    <div style={{ borderRadius: '1rem', border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden' }}>
      <div style={{ padding: '1rem 1.25rem 0.25rem' }}>
        <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 2 }}>
          WATCH PROGRESS OVER TIME
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>Cumulative episodes watched</div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block' }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yLabels.map(l => (
          <g key={l.value}>
            <line x1={PAD.left} y1={l.y} x2={W - PAD.right} y2={l.y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
            <text x={PAD.left - 6} y={l.y + 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">{l.value}</text>
          </g>
        ))}
        <path d={fillD} fill="url(#lineGrad)" />
        <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle
          cx={xPos(data[data.length - 1].date)} cy={yPos(data[data.length - 1].count)}
          r="4" fill="var(--primary)" stroke="var(--surface)" strokeWidth="2"
        />
        {xLabels.map((d, i) => (
          <text
            key={d.date} x={xPos(d.date)} y={H - 6}
            textAnchor={i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
            fontSize="10" fill="var(--muted-foreground)"
          >
            {new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </text>
        ))}
      </svg>
    </div>
  )
}

/* ── Main component ────────────────────────────────────────────────────────── */

export default function InsightsDisplay({
  watchedEps, totalEps, fillerEps, seriesMap,
  totalHours, arcsCompleted, totalArcs, streak,
  ratingDist, ratedEpsCount, avgRating,
  totalFights, avgFightRating, fightRatingDist, decidedFights, undecidedFights,
  mostFoughtChar, bestRatedFight, deadliestFight, bestFightArc,
  tagMap, totalCaseFiles,
  theoryBreakdown, totalQuotes, totalMoments, totalChars, totalBestFights,
  progressData,
}: Props) {
  // One-time backfill: set watched_at for watched episodes that are missing it
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('episodes')
        .update({ watched_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('watched', true)
        .is('watched_at', null)
        .then(() => {}) // fire-and-forget
    })
  }, [])

  const pctWatched = totalEps > 0 ? Math.round((watchedEps / totalEps) * 100) : 0

  const orderedSeries = SERIES_ORDER.filter(s => seriesMap[s])
  const otherSeries   = Object.keys(seriesMap).filter(s => !SERIES_ORDER.includes(s))
  const allSeries     = [...orderedSeries, ...otherSeries]

  const maxRatingCount      = Math.max(...Object.values(ratingDist), 1)
  const maxFightRatingCount = Math.max(...Object.values(fightRatingDist), 1)
  const hasFightRatings     = Object.values(fightRatingDist).some(v => v > 0)
  const theoryTotal         = theoryBreakdown.ongoing + theoryBreakdown.correct + theoryBreakdown.wrong

  const card: React.CSSProperties = {
    borderRadius: '1rem',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    padding: '1.25rem',
  }

  return (
    <div style={{ height: 'calc(100vh - 57px)', overflowY: 'auto' }}>
      <div style={{ padding: '2rem 2rem 4rem', display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>

        {/* ── Page header ── */}
        <div>
          <div className="font-eyebrow" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 2 }}>
            NARUTO COMPANION
          </div>
          <h1 className="font-display font-bold" style={{ fontSize: '2.5rem', color: 'var(--foreground)', lineHeight: 1.05 }}>
            Insights
          </h1>
        </div>

        {/* ══ SECTION 01: YOUR PROGRESS ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionHeader num="01" title="Your Progress" />

          {/* FIX 1 — unified card: ring + series bars side by side */}
          <div style={{
            ...card,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
            alignItems: 'center',
            padding: '1.5rem',
          }}>
            {/* Completion ring */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <CompletionRing pct={pctWatched} watched={watchedEps} total={totalEps} />
            </div>

            {/* Series bars */}
            <div>
              <div className="font-eyebrow" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 14 }}>
                BY SERIES
              </div>
              {allSeries.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {allSeries.map(series => {
                    const { total, watched } = seriesMap[series]
                    const pct = total > 0 ? Math.round((watched / total) * 100) : 0
                    return (
                      <div key={series} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--foreground)' }}>
                            {seriesLabel(series)}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                            {watched} / {total} — {pct}%
                          </span>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: 'var(--border)' }}>
                          <div style={{
                            height: '100%', width: `${pct}%`, borderRadius: 4,
                            background: 'var(--primary)', transition: 'width 0.7s cubic-bezier(.4,0,.2,1)',
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p style={{ fontSize: 14, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No episode data yet.</p>
              )}
              {fillerEps > 0 && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--muted-foreground)' }}>
                  {fillerEps} filler episodes in total library
                </div>
              )}
            </div>
          </div>

          {/* FIX 2 — stat cards row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <StatCard label="HOURS WATCHED"  value={`${totalHours}h`} />
            <StatCard label="ARCS COMPLETED" value={`${arcsCompleted} / ${totalArcs}`} />
            <StatCard label="CURRENT STREAK" value={streak > 0 ? `${streak}d 🔥` : '0d'} sub={streak > 0 ? 'consecutive days' : 'start your streak!'} />
          </div>

          {/* Progress graph — full width */}
          <ProgressGraph data={progressData} total={totalEps} />
        </div>

        <Divider />

        {/* ══ SECTION 02: YOUR RATINGS ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionHeader num="02" title="Your Ratings" />

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: ratedEpsCount > 0 ? 20 : 0 }}>
              <span className="font-display font-bold" style={{ fontSize: 52, lineHeight: 1, color: 'var(--primary)' }}>
                {avgRating ?? '—'}
              </span>
              {avgRating && (
                <span className="font-eyebrow" style={{ fontSize: 11, letterSpacing: '0.1em', color: 'var(--muted-foreground)' }}>
                  / 10
                </span>
              )}
              <span style={{ fontSize: 13, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>
                {ratedEpsCount > 0 ? `${ratedEpsCount} episodes rated` : 'No ratings yet'}
              </span>
            </div>

            {ratedEpsCount > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(r => (
                  <RatingBar key={r} rating={r} count={ratingDist[r] ?? 0} maxCount={maxRatingCount} />
                ))}
              </div>
            )}
          </div>
        </div>

        <Divider />

        {/* ══ SECTION 03: THE FIGHT TRACKER ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionHeader num="03" title="The Fight Tracker" />

          {/* Top 3 stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            <StatCard label="FIGHTS LOGGED" value={totalFights} />
            <StatCard label="AVG RATING"    value={avgFightRating ? `${avgFightRating}/10` : '—'} />
            <StatCard label="FIGHTS RANKED" value={totalBestFights} />
          </div>

          {/* FIX 3 — extra fight insight cards */}
          {totalFights > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
              {mostFoughtChar && (
                <InfoCard
                  label="MOST FOUGHT CHARACTER"
                  value={mostFoughtChar.name}
                  sub={`appears in ${mostFoughtChar.count} fight${mostFoughtChar.count !== 1 ? 's' : ''}`}
                />
              )}
              {bestRatedFight && (
                <InfoCard
                  label="BEST RATED FIGHT"
                  value={bestRatedFight.title}
                  sub={`rated ${bestRatedFight.rating}/10`}
                />
              )}
              {deadliestFight && (
                <InfoCard
                  label="DEADLIEST FIGHT"
                  value={deadliestFight.title}
                  sub={`${deadliestFight.deathCount} death${deadliestFight.deathCount !== 1 ? 's' : ''}`}
                />
              )}
              {bestFightArc && (
                <InfoCard
                  label="BEST ARC FOR FIGHTS"
                  value={bestFightArc.name}
                  sub={`avg rating ${bestFightArc.avgRating}/10`}
                />
              )}
            </div>
          )}

          {/* Outcomes */}
          {totalFights > 0 && (decidedFights + undecidedFights) > 0 && (
            <div style={card}>
              <div className="font-eyebrow" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 14 }}>
                OUTCOMES
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {[
                  { label: 'DECIDED',   count: decidedFights,   color: '#005032', bg: '#00503218' },
                  { label: 'UNDECIDED', count: undecidedFights, color: '#827800', bg: '#82780018' },
                ].map(({ label, count, color, bg }) => (
                  <div key={label} style={{ flex: 1, borderRadius: '0.75rem', padding: '0.875rem', textAlign: 'center', background: bg }}>
                    <div className="font-display font-bold" style={{ fontSize: '2rem', lineHeight: 1, color }}>{count}</div>
                    <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.1em', marginTop: 4, color }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rating distribution */}
          {hasFightRatings && (
            <div style={card}>
              <div className="font-eyebrow" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 14 }}>
                RATING DISTRIBUTION
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(r => (
                  <RatingBar key={r} rating={r} count={fightRatingDist[r] ?? 0} maxCount={maxFightRatingCount} color="#143c82" />
                ))}
              </div>
            </div>
          )}
        </div>

        <Divider />

        {/* ══ SECTION 04: CHARACTERS & CASE FILES ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionHeader num="04" title="Characters & Case Files" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            {/* FIX 4 — "CHARACTER FILES" not "TOP CHARACTERS" */}
            <StatCard label="CASE FILES"       value={totalCaseFiles} />
            <StatCard label="CHARACTER FILES"  value={totalChars} />
          </div>

          {Object.keys(tagMap).length > 0 && (
            <div style={card}>
              <div className="font-eyebrow" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--muted-foreground)', marginBottom: 16 }}>
                BY CATEGORY
              </div>
              <TagDonut tagMap={tagMap} />
            </div>
          )}
        </div>

        <Divider />

        {/* ══ SECTION 05: THEORY LOG ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SectionHeader num="05" title="Theory Log" />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'ONGOING', count: theoryBreakdown.ongoing, color: '#827800', bg: '#82780018' },
              { label: 'CORRECT', count: theoryBreakdown.correct, color: '#005032', bg: '#00503218' },
              { label: 'WRONG',   count: theoryBreakdown.wrong,   color: '#8c0000', bg: '#8c000018' },
            ].map(({ label, count, color, bg }) => (
              <div key={label} style={{ borderRadius: '0.875rem', padding: '1.25rem', textAlign: 'center', background: bg }}>
                <div className="font-display font-bold" style={{ fontSize: '2.5rem', lineHeight: 1, color }}>{count}</div>
                <div className="font-eyebrow" style={{ fontSize: 9, letterSpacing: '0.12em', marginTop: 6, color }}>{label}</div>
              </div>
            ))}
          </div>

          {theoryTotal === 0 && (
            <p style={{ fontSize: 14, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No theories logged yet.</p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
            <StatCard label="QUOTES SAVED" value={totalQuotes} />
            <StatCard label="BEST MOMENTS" value={totalMoments} />
          </div>
        </div>

      </div>
    </div>
  )
}
