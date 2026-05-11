'use client'

import { useEffect } from 'react'
import { seedEpisodesIfEmpty } from '@/lib/seedEpisodes'

export default function EpisodeSeeder({ userId }: { userId: string }) {
  useEffect(() => {
    seedEpisodesIfEmpty(userId).catch(console.error)
  }, [userId])

  return null // renders nothing
}
