'use client'

const SERIES_ORDER = ['Naruto', 'Naruto Shippuden', 'Boruto']
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

type Stats = {
  totalEps: number
  watchedEps: number
  fillerEps: number
  avgRating: string | null
  ratedEpsCount: number
  seriesMap: Record<string, { total: number; watched: number }>
  tagMap: Record<string, number>
  totalCaseFiles: number
  totalFights: number
  avgFightRating: string | null
  totalQuotes: number
  totalMoments: number
  theoryBreakdown: { open: number; confirmed: number; debunked: number }
}

function StatCard({ label, value, sub, color }: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-1">
      <div className="font-eyebrow text-[9px] text-muted-foreground">{label}</div>
      <div className="font-display text-3xl font-bold" style={{ color: color || 'var(--foreground)' }}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

function ProgressBar({ value, max, color = 'var(--primary)', label }: {
  value: number
  max: number
  color?: string
  label?: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="space-y-1">
      {label && <div className="flex justify-between text-xs">
        <span style={{ color: 'var(--foreground)' }}>{label}</span>
        <span style={{ color: 'var(--muted-foreground)' }}>{value} / {max}</span>
      </div>}
      <div className="h-2 rounded-full" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function InsightsContent({ stats }: { stats: Stats }) {
  const pctWatched = stats.totalEps > 0
    ? Math.round((stats.watchedEps / stats.totalEps) * 100)
    : 0

  const orderedSeries = SERIES_ORDER.filter(s => stats.seriesMap[s])
  const otherSeries   = Object.keys(stats.seriesMap).filter(s => !SERIES_ORDER.includes(s))
  const allSeries     = [...orderedSeries, ...otherSeries]

  const tagEntries = Object.entries(stats.tagMap).sort((a, b) => b[1] - a[1])
  const maxTagCount = Math.max(...tagEntries.map(([, v]) => v), 1)

  return (
    <div style={{ height: 'calc(100vh - 57px)', overflowY: 'auto' }}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">

        {/* Header */}
        <div>
          <div className="font-eyebrow text-[10px] tracking-widest text-muted-foreground mb-0.5">INSIGHTS</div>
          <h1 className="font-display font-bold text-3xl text-foreground">Your Stats</h1>
        </div>

        {/* Top stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="EPISODES WATCHED"
            value={stats.watchedEps}
            sub={`${pctWatched}% of ${stats.totalEps} total`}
            color="var(--primary)"
          />
          <StatCard
            label="CASE FILES"
            value={stats.totalCaseFiles}
            sub={`${tagEntries.length} categories`}
          />
          <StatCard
            label="FIGHTS LOGGED"
            value={stats.totalFights}
            sub={stats.avgFightRating ? `avg ${stats.avgFightRating}/10` : 'none rated yet'}
          />
          <StatCard
            label="AVG EP RATING"
            value={stats.avgRating ? `${stats.avgRating}/10` : '—'}
            sub={stats.ratedEpsCount > 0 ? `from ${stats.ratedEpsCount} rated` : 'no ratings yet'}
          />
        </div>

        {/* Watch progress by series */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
          <div className="font-eyebrow text-[10px] text-muted-foreground">WATCH PROGRESS BY SERIES</div>
          <div className="space-y-3">
            {allSeries.map(series => {
              const { total, watched } = stats.seriesMap[series]
              return (
                <ProgressBar
                  key={series}
                  label={series}
                  value={watched}
                  max={total}
                  color="var(--primary)"
                />
              )
            })}
            {allSeries.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No episode data yet.</p>
            )}
          </div>
          {stats.fillerEps > 0 && (
            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground">
                {stats.fillerEps} filler episodes in total library
              </div>
            </div>
          )}
        </div>

        {/* Case files breakdown */}
        {tagEntries.length > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
            <div className="font-eyebrow text-[10px] text-muted-foreground">CASE FILES BY CATEGORY</div>
            <div className="space-y-2.5">
              {tagEntries.map(([tag, count]) => (
                <div key={tag} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize" style={{ color: 'var(--foreground)' }}>{tag}</span>
                    <span style={{ color: 'var(--muted-foreground)' }}>{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${(count / maxTagCount) * 100}%`, background: TAG_COLORS[tag] || 'var(--primary)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Theory breakdown */}
        {(stats.theoryBreakdown.open + stats.theoryBreakdown.confirmed + stats.theoryBreakdown.debunked) > 0 && (
          <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
            <div className="font-eyebrow text-[10px] text-muted-foreground">THEORY LOG</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl" style={{ background: '#82780018' }}>
                <div className="font-display text-2xl font-bold" style={{ color: '#827800' }}>
                  {stats.theoryBreakdown.open}
                </div>
                <div className="font-eyebrow text-[9px] mt-0.5" style={{ color: '#827800' }}>OPEN</div>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: '#00503218' }}>
                <div className="font-display text-2xl font-bold" style={{ color: '#005032' }}>
                  {stats.theoryBreakdown.confirmed}
                </div>
                <div className="font-eyebrow text-[9px] mt-0.5" style={{ color: '#005032' }}>CONFIRMED</div>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ background: '#8c000018' }}>
                <div className="font-display text-2xl font-bold" style={{ color: '#8c0000' }}>
                  {stats.theoryBreakdown.debunked}
                </div>
                <div className="font-eyebrow text-[9px] mt-0.5" style={{ color: '#8c0000' }}>DEBUNKED</div>
              </div>
            </div>
          </div>
        )}

        {/* Community stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-surface p-4 flex items-center gap-4">
            <div className="text-3xl">💬</div>
            <div>
              <div className="font-eyebrow text-[9px] text-muted-foreground">QUOTES SAVED</div>
              <div className="font-display text-2xl font-bold">{stats.totalQuotes}</div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 flex items-center gap-4">
            <div className="text-3xl">✨</div>
            <div>
              <div className="font-eyebrow text-[9px] text-muted-foreground">BEST MOMENTS</div>
              <div className="font-display text-2xl font-bold">{stats.totalMoments}</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
