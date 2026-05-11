import { createClient } from '@/lib/supabase/client'

export async function seedEpisodesIfEmpty(userId: string): Promise<void> {
  const supabase = createClient()

  const { count } = await supabase
    .from('episodes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // If incomplete seed detected (less than 720), delete and re-seed
  if (count !== null && count > 0 && count < 720) {
    console.log(`Incomplete seed detected (${count} episodes). Re-seeding…`)
    await supabase.from('episodes').delete().eq('user_id', userId)
    // fall through to seed
  } else if (count !== null && count >= 720) {
    return // already fully seeded
  }

  const response = await fetch('/naruto_final.json')
  if (!response.ok) throw new Error('Failed to fetch episode data')
  const episodes = await response.json()

  const BATCH_SIZE = 25 // small batches to stay under payload limits
  for (let i = 0; i < episodes.length; i += BATCH_SIZE) {
    const batch = episodes.slice(i, i + BATCH_SIZE).map((ep: any) => ({
      user_id: userId,
      global_episode: ep.global_episode,
      series: ep.series,
      season: ep.season || null,
      episode: ep.episode ?? ep.global_episode,
      name: ep.name,
      type: ep.type || 'episode',
      watched: false,
      personal_notes: '',
      in_this_episode: [],
      arc: ep.arc || null,
      is_filler: ep.is_filler || false,
      thumbnail: ep.thumbnail || null,
      runtime: ep.runtime || null,
      air_date: ep.air_date || null,
      overview: ep.overview || null,
      imdb: ep.imdb || null,
      crunchyroll: ep.crunchyroll || null,
    }))

    const { error } = await supabase.from('episodes').insert(batch)
    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error.message, error.details)
      // Continue with remaining batches rather than aborting
    }
  }
}
