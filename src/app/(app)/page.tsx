import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: episodes },
    { data: profile },
    { data: activity },
    { data: caseFiles },
  ] = await Promise.all([
    supabase.from('episodes').select('*').eq('user_id', user.id).order('global_episode', { ascending: true }),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('activity').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('case_files').select('id').eq('user_id', user.id),
  ])

  const allEps      = episodes || []
  const epOnly      = allEps.filter((e: any) => e.type === 'episode')
  const narutoEps   = epOnly.filter((e: any) => e.series === 'naruto')
  const shippudenEps= epOnly.filter((e: any) => e.series === 'shippuden')

  const totalWatched     = epOnly.filter((e: any) => e.watched).length
  const narutoWatched    = narutoEps.filter((e: any) => e.watched).length
  const shippudenWatched = shippudenEps.filter((e: any) => e.watched).length
  const totalMins        = epOnly.filter((e: any) => e.watched).reduce((s: number, e: any) => s + (e.runtime || 23), 0)
  const hours            = Math.round(totalMins / 60)
  const total            = 720
  const pct              = Math.round((totalWatched / total) * 100)

  // ETA — same formula as single file: remaining * 23 min, 2 eps/day
  const remaining  = total - totalWatched
  const hoursLeft  = Math.round((remaining * 23) / 60)
  const etaMonths  = Math.round(hoursLeft / (2 * 30))
  const etaLabel   = remaining === 0 ? 'Done!' : etaMonths > 0 ? `~${etaMonths} mo` : 'Almost there!'

  // Current episode — find first unwatched
  const currentEp = allEps.find((e: any) => !e.watched && e.type === 'episode') || allEps[0]

  // Arc progress — same logic as updateArcProgress()
  const arcMap: Record<string, { total: number; watched: number; series: string }> = {}
  epOnly.forEach((ep: any) => {
    if (!ep.arc || ep.arc === 'Standalone' || ep.arc === 'Movie') return
    if (!arcMap[ep.arc]) arcMap[ep.arc] = { total: 0, watched: 0, series: ep.series }
    arcMap[ep.arc].total++
    if (ep.watched) arcMap[ep.arc].watched++
  })
  const arcs       = Object.entries(arcMap)
  const inProgress = arcs.filter(([, d]) => d.watched > 0 && d.watched < d.total)
  const upcoming   = arcs.filter(([, d]) => d.watched === 0)
  const toShow     = [...inProgress, ...upcoming].slice(0, 4)
  const allDone    = arcs.length > 0 && arcs.every(([, d]) => d.watched === d.total && d.total > 0)

  // Completed arcs count
  const completedArcs = arcs.filter(([, d]) => d.watched === d.total && d.total > 0).length

  const profileName = profile?.name || 'Shinobi'
  const greetings = [
    `The journey continues, ${profileName}.`,
    `Believe it, ${profileName}.`,
    `Ready to train, ${profileName}?`,
    `Your ninja way awaits, ${profileName}.`,
    `The Will of Fire burns, ${profileName}.`,
    `Never give up, ${profileName}.`,
    `Dattebayo, ${profileName}.`,
  ]
  const greeting = greetings[Math.floor(Date.now() / 86400000) % greetings.length]

  const activityIcons: Record<string, string> = {
    episode:  '▶',
    casefile: '🗂',
    death:    '💀',
    ranking:  '★',
    import:   '⚡',
    glossary: '📖',
  }

  return (
    <div className="px-4 py-4 md:px-10 md:py-8 space-y-6">

      {/* Greeting */}
      <div>
        <div className="font-eyebrow text-[10px] mb-0.5 tracking-widest uppercase text-muted-foreground">DASHBOARD</div>
        <h1 className="font-display font-bold text-3xl text-foreground">{greeting}</h1>
      </div>

      {/* Hero Card */}
      <section className="rounded-2xl overflow-hidden border border-border shadow-soft bg-surface">
        <div className="grid md:grid-cols-2">

          {/* Left: thumbnail */}
          <div className="aspect-video relative overflow-hidden">
            {currentEp?.thumbnail
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={currentEp.thumbnail} alt={currentEp?.name || ''} className="w-full h-full object-cover object-center absolute inset-0" />
              : null}
            <div className="absolute inset-0 gradient-hero opacity-60"></div>
            <div className="absolute top-4 left-4 font-eyebrow text-[10px] text-white/80 bg-black/30 backdrop-blur px-2 py-1 rounded">
              {currentEp?.type === 'movie' ? '🎬 MOVIE' : 'NOW WATCHING'}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <div className="font-eyebrow text-[11px] opacity-80">
                {currentEp
                  ? (currentEp.type === 'movie' ? 'Movie' : `${currentEp.series === 'naruto' ? 'Naruto' : 'Shippuden'} Ep. ${currentEp.episode}`) +
                    (currentEp.arc ? ` · ${currentEp.arc.toUpperCase()}` : '')
                  : ''}
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-bold mt-1">
                {currentEp?.name || 'No episodes yet'}
              </h2>
            </div>
          </div>

          {/* Right: episode info */}
          <div className="p-6 lg:p-8 flex flex-col justify-center gap-4">
            <div>
              <div className="font-eyebrow text-[10px] text-muted-foreground">CONTINUE WATCHING</div>
              <h3 className="font-display text-xl font-semibold mt-1 mb-1">Pick up where you left off</h3>
              <p className="text-sm text-muted-foreground">
                {currentEp
                  ? (currentEp.type === 'movie' ? 'Movie' : `${currentEp.series === 'naruto' ? 'Naruto' : 'Shippuden'} Ep. ${currentEp.episode}`) +
                    (currentEp.runtime ? ` · ${currentEp.runtime} min` : ' · 24 min')
                  : ''}
              </p>
              {currentEp?.imdb && (
                <p className="text-xs text-muted-foreground mt-1">★ {currentEp.imdb} · TMDB rating</p>
              )}
            </div>
            {currentEp?.is_filler && (
              <div className="rounded-lg bg-accent px-3 py-2 text-xs text-muted-foreground">
                ⚠️ This is a filler episode
              </div>
            )}
            <div className="flex gap-2 flex-wrap">
              <a href="/episodes"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-glow"
                style={{ textDecoration: 'none' }}>▶ Resume</a>
              {currentEp?.crunchyroll && (
                <a href={currentEp.crunchyroll} target="_blank" rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium inline-flex items-center gap-1.5"
                  style={{ borderColor: '#F47521', color: '#F47521', textDecoration: 'none' }}>
                  ▶ Crunchyroll
                </a>
              )}
            </div>
          </div>

        </div>
      </section>

      {/* Main two-col grid */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-[1fr_360px]" style={{ alignItems: 'start' }}>
        <div className="space-y-6">

          {/* Arc Progress */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-eyebrow text-[10px] text-muted-foreground">ARCS IN PROGRESS</div>
                <h3 className="font-display text-lg font-semibold">Your journey</h3>
              </div>
              <a href="/episodes" className="text-xs text-primary font-medium" style={{ textDecoration: 'none' }}>View all →</a>
            </div>
            <div className="space-y-5">
              {toShow.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  {allDone ? '🎉 All arcs completed! You are a true shinobi.' : 'Loading arc data…'}
                </p>
              ) : toShow.map(([name, data]) => {
                const arcPct     = data.total > 0 ? Math.round((data.watched / data.total) * 100) : 0
                const isUpcoming = data.watched === 0
                return (
                  <div key={name} className={isUpcoming ? 'opacity-50' : ''}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium">{name}</span>
                      <span className="text-muted-foreground">{data.watched} / {data.total}</span>
                    </div>
                    <div className="arc-track h-2 rounded-full overflow-hidden">
                      <div className="arc-fill h-full" style={{ width: `${arcPct}%` }}></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Overall Journey */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <div className="flex items-end justify-between mb-3">
              <div>
                <div className="font-eyebrow text-[10px] text-muted-foreground">OVERALL JOURNEY</div>
                <h3 className="font-display text-lg font-semibold">{totalWatched} of {total} episodes</h3>
              </div>
              <div className="font-display text-3xl font-bold text-primary">{pct}%</div>
            </div>
            <div className="arc-track h-3 rounded-full overflow-hidden">
              <div className="arc-fill h-full" style={{ width: `${pct}%` }}></div>
            </div>
            <div className="grid grid-cols-3 mt-4 text-xs text-muted-foreground">
              <div>
                <span className="block font-display text-foreground text-base font-semibold">{narutoWatched} / 220</span>
                Naruto
              </div>
              <div>
                <span className="block font-display text-foreground text-base font-semibold">{shippudenWatched} / 500</span>
                Shippuden
              </div>
              <div>
                <span className="block font-display text-foreground text-base font-semibold">{etaLabel}</span>
                ETA
              </div>
            </div>
          </section>

        </div>

        <div className="space-y-6">

          {/* Stats Panel */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
            <div className="font-eyebrow text-[10px] text-muted-foreground mb-3">STATS</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-muted p-4">
                <div className="font-display text-2xl font-bold">{totalWatched}</div>
                <div className="text-xs text-muted-foreground">Episodes</div>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <div className="font-display text-2xl font-bold">{hours}h</div>
                <div className="text-xs text-muted-foreground">Watched</div>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <div className="font-display text-2xl font-bold">{caseFiles?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Case Files</div>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <div className="font-display text-2xl font-bold">{completedArcs}</div>
                <div className="text-xs text-muted-foreground">Arcs done</div>
              </div>
            </div>
          </section>

          {/* Activity Feed */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-soft flex flex-col" style={{ minHeight: '200px' }}>
            <div className="font-eyebrow text-[10px] text-muted-foreground mb-3">RECENT ACTIVITY</div>
            <ul className="space-y-3 text-sm flex-1 overflow-y-auto">
              {(!activity || activity.length === 0) ? (
                <li className="text-sm text-muted-foreground italic">No activity yet. Start watching!</li>
              ) : activity.map((item: any) => {
                const icon = activityIcons[item.type] || '✓'
                const time = getRelativeTime(item.created_at)
                return (
                  <li key={item.id} className="flex gap-3">
                    <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center text-primary flex-shrink-0">
                      {icon}
                    </div>
                    <div>
                      <div className="font-medium text-sm">{item.action}</div>
                      <div className="text-xs text-muted-foreground">{item.name} · {time}</div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>

        </div>
      </div>

    </div>
  )
}

function getRelativeTime(dateString: string): string {
  const now    = new Date()
  const date   = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const mins   = Math.floor(diffMs / 60000)
  const hours  = Math.floor(mins / 60)
  const days   = Math.floor(hours / 24)

  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return date.toLocaleDateString()
}
