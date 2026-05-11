export function calculateStreak(activity: any[]): number {
  if (!activity || activity.length === 0) return 0

  const watchDates = activity
    .filter(a => a.action === 'Watched episode')
    .map(a => new Date(a.created_at).toDateString())

  const uniqueDates = [...new Set(watchDates)].sort((a, b) =>
    new Date(b).getTime() - new Date(a).getTime()
  )

  if (uniqueDates.length === 0) return 0

  const today     = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1])
    const curr = new Date(uniqueDates[i])
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000)
    if (diff === 1) streak++
    else break
  }
  return streak
}
