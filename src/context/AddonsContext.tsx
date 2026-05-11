'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export type Addons = {
  showFiller: boolean
  showRatings: boolean
  showCrunchyroll: boolean
}

type AddonsCtx = Addons & {
  toggle: (key: keyof Addons) => void | Promise<void>
}

const defaults: Addons = {
  showFiller: true,
  showRatings: true,
  showCrunchyroll: true,
}

const Ctx = createContext<AddonsCtx>({
  ...defaults,
  toggle: () => {},
})

export function useAddons() {
  return useContext(Ctx)
}

export function AddonsProvider({ children }: { children: ReactNode }) {
  const [addons, setAddons] = useState<Addons>(() => {
    // Read synchronously from localStorage on first render — no async gap
    if (typeof window === 'undefined') return defaults
    try {
      const saved = localStorage.getItem('naruto-addons')
      if (saved) return { ...defaults, ...JSON.parse(saved) }
    } catch {}
    return defaults
  })
  const supabase = createClient()

  useEffect(() => {
    // Only fetch from Supabase on first-ever load (no localStorage key yet)
    async function load() {
      try {
        if (localStorage.getItem('naruto-addons')) return // already have saved values
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('profiles').select('addons').eq('id', user.id).single()
        if (data?.addons) {
          const merged = { ...defaults, ...data.addons }
          setAddons(merged)
          localStorage.setItem('naruto-addons', JSON.stringify(merged))
        }
      } catch {}
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function toggle(key: keyof Addons) {
    const updated = { ...addons, [key]: !addons[key] }
    setAddons(updated)
    localStorage.setItem('naruto-addons', JSON.stringify(updated)) // sync, immediate
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await supabase.from('profiles').update({ addons: updated }).eq('id', user.id)
    } catch {}
  }

  return <Ctx.Provider value={{ ...addons, toggle }}>{children}</Ctx.Provider>
}
