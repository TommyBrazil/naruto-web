import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InsightsDisplay from '@/components/InsightsDisplay'

export const dynamic = 'force-dynamic'

export default async function InsightsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const TOTAL_EPS = 720

  const [
    { data: episodes },
    { data: caseFiles },
    { data: fights },
    { data: rankingsRow },
    { data: activity },
  ] = await Promise.all([
    supabase.from('episodes').select('watched, personal_rating, series, is_filler, runtime, arc'),
    supabase.from('case_files').select('tag'),
    supabase.from('fights').select('rating, winner, title, team_a, team_b, team_c, deaths, arc'),
    supabase
      .from('rankings')
      .select('theory_log, quotes_vault, best_moments, top_characters, best_fights')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('activity')
      .select('action, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
  ])

  // ── Progress ──
  const watchedEps  = episodes?.filter(e => e.watched).length ?? 0
  const fillerEps   = episodes?.filter(e => e.is_filler).length ?? 0
  const totalHours  = Math.round(
    (episodes?.filter(e => e.watched).reduce((s, e) => s + (e.runtime ?? 23), 0) ?? 0) / 60
  )

  const seriesMap: Record<string, { total: number; watched: number }> = {}
  episodes?.forEach(e => {
    if (!seriesMap[e.series]) seriesMap[e.series] = { total: 0, watched: 0 }
    seriesMap[e.series].total++
    if (e.watched) seriesMap[e.series].watched++
  })

  // Arc completion (exclude Standalone / Movie / null)
  const arcMap: Record<string, { total: number; watched: number }> = {}
  episodes?.forEach(e => {
    if (!e.arc || e.arc === 'Standalone' || e.arc === 'Movie') return
    if (!arcMap[e.arc]) arcMap[e.arc] = { total: 0, watched: 0 }
    arcMap[e.arc].total++
    if (e.watched) arcMap[e.arc].watched++
  })
  const arcEntries    = Object.values(arcMap)
  const totalArcs     = arcEntries.length
  const arcsCompleted = arcEntries.filter(a => a.total > 0 && a.watched === a.total).length

  // ── Ratings ──
  const ratedEps = episodes?.filter(e => e.personal_rating != null) ?? []
  const avgRating = ratedEps.length
    ? (ratedEps.reduce((s, e) => s + (e.personal_rating ?? 0), 0) / ratedEps.length).toFixed(1)
    : null

  const ratingDist: Record<number, number> = {}
  for (let i = 1; i <= 10; i++) ratingDist[i] = 0
  ratedEps.forEach(e => {
    const r = Math.round(e.personal_rating ?? 0)
    if (r >= 1 && r <= 10) ratingDist[r] = (ratingDist[r] || 0) + 1
  })

  // ── Fights ──
  const totalFights = fights?.length ?? 0
  const ratedFights = fights?.filter(f => f.rating != null) ?? []
  const avgFightRating = ratedFights.length
    ? (ratedFights.reduce((s, f) => s + (f.rating ?? 0), 0) / ratedFights.length).toFixed(1)
    : null

  const fightRatingDist: Record<number, number> = {}
  for (let i = 1; i <= 10; i++) fightRatingDist[i] = 0
  ratedFights.forEach(f => {
    const r = Math.round(f.rating ?? 0)
    if (r >= 1 && r <= 10) fightRatingDist[r] = (fightRatingDist[r] || 0) + 1
  })

  const decidedFights   = fights?.filter(f => f.winner != null).length ?? 0
  const undecidedFights = totalFights - decidedFights

  // ── Fight extras ──
  const charCount: Record<string, number> = {}
  fights?.forEach(f => {
    const fighters = [
      ...(Array.isArray(f.team_a) ? f.team_a as string[] : []),
      ...(Array.isArray(f.team_b) ? f.team_b as string[] : []),
      ...(Array.isArray(f.team_c) ? f.team_c as string[] : []),
    ]
    fighters.forEach(name => { if (name) charCount[name] = (charCount[name] || 0) + 1 })
  })
  const mostFoughtEntry = Object.entries(charCount).sort((a, b) => b[1] - a[1])[0] ?? null
  const mostFoughtChar  = mostFoughtEntry ? { name: mostFoughtEntry[0], count: mostFoughtEntry[1] } : null

  const bestRatedFightRaw = [...(fights ?? [])]
    .filter(f => f.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null
  const bestRatedFight = bestRatedFightRaw
    ? { title: bestRatedFightRaw.title as string, rating: bestRatedFightRaw.rating as number }
    : null

  const deadliestFightRaw = [...(fights ?? [])]
    .filter(f => Array.isArray(f.deaths) && (f.deaths as string[]).length > 0)
    .sort((a, b) => ((b.deaths as string[])?.length ?? 0) - ((a.deaths as string[])?.length ?? 0))[0] ?? null
  const deadliestFight = deadliestFightRaw
    ? { title: deadliestFightRaw.title as string, deathCount: (deadliestFightRaw.deaths as string[]).length }
    : null

  const arcFightMap: Record<string, { sum: number; count: number }> = {}
  fights?.forEach(f => {
    if (!f.arc) return
    if (!arcFightMap[f.arc]) arcFightMap[f.arc] = { sum: 0, count: 0 }
    if (f.rating != null) { arcFightMap[f.arc].sum += f.rating as number; arcFightMap[f.arc].count++ }
  })
  const bestFightArcEntry = Object.entries(arcFightMap)
    .filter(([, d]) => d.count > 0)
    .sort((a, b) => (b[1].sum / b[1].count) - (a[1].sum / a[1].count))[0] ?? null
  const bestFightArc = bestFightArcEntry
    ? { name: bestFightArcEntry[0], avgRating: +(bestFightArcEntry[1].sum / bestFightArcEntry[1].count).toFixed(1) }
    : null

  // ── Watch progress over time ──
  const watchActivity = (activity ?? [])
    .filter(a => a.action === 'Watched episode')
    .map(a => ({ date: new Date(a.created_at).toISOString().slice(0, 10) }))

  const dailyCounts: Record<string, number> = {}
  watchActivity.forEach(a => {
    dailyCounts[a.date] = (dailyCounts[a.date] || 0) + 1
  })

  const sortedDates = Object.keys(dailyCounts).sort()
  let cumulative = 0
  const progressData: { date: string; count: number }[] = sortedDates.map(date => {
    cumulative += dailyCounts[date]
    return { date, count: cumulative }
  })

  const today = new Date().toISOString().slice(0, 10)
  if (progressData.length > 0 && progressData[progressData.length - 1].date !== today) {
    progressData.push({ date: today, count: cumulative })
  }

  // ── Streak (consecutive days with watches, ending today or yesterday) ──
  const watchDateSet = new Set(watchActivity.map(a => a.date))
  let streak = 0
  const now = new Date()
  const startOffset = watchDateSet.has(today) ? 0 : 1
  for (let i = startOffset; i < 366; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    if (watchDateSet.has(d.toISOString().slice(0, 10))) streak++
    else break
  }

  // ── Case Files ──
  const tagMap: Record<string, number> = {}
  caseFiles?.forEach(c => { tagMap[c.tag] = (tagMap[c.tag] || 0) + 1 })
  const totalCaseFiles = caseFiles?.length ?? 0

  // ── Theory Log (from rankings JSONB) ──
  const theoryLog = (rankingsRow?.theory_log ?? []) as Array<{ status: string }>
  const theoryBreakdown = {
    ongoing: theoryLog.filter(t => t.status === 'ongoing').length,
    correct: theoryLog.filter(t => t.status === 'correct').length,
    wrong:   theoryLog.filter(t => t.status === 'wrong').length,
  }
  const totalQuotes     = ((rankingsRow?.quotes_vault   ?? []) as unknown[]).length
  const totalMoments    = ((rankingsRow?.best_moments   ?? []) as unknown[]).length
  const totalChars      = ((rankingsRow?.top_characters ?? []) as unknown[]).length
  const totalBestFights = ((rankingsRow?.best_fights    ?? []) as unknown[]).length

  return (
    <InsightsDisplay
      watchedEps={watchedEps}
      totalEps={TOTAL_EPS}
      fillerEps={fillerEps}
      seriesMap={seriesMap}
      ratingDist={ratingDist}
      ratedEpsCount={ratedEps.length}
      avgRating={avgRating}
      totalFights={totalFights}
      avgFightRating={avgFightRating}
      fightRatingDist={fightRatingDist}
      decidedFights={decidedFights}
      undecidedFights={undecidedFights}
      totalHours={totalHours}
      arcsCompleted={arcsCompleted}
      totalArcs={totalArcs}
      streak={streak}
      mostFoughtChar={mostFoughtChar}
      bestRatedFight={bestRatedFight}
      deadliestFight={deadliestFight}
      bestFightArc={bestFightArc}
      tagMap={tagMap}
      totalCaseFiles={totalCaseFiles}
      theoryBreakdown={theoryBreakdown}
      totalQuotes={totalQuotes}
      totalMoments={totalMoments}
      totalChars={totalChars}
      totalBestFights={totalBestFights}
      progressData={progressData}
    />
  )
}
