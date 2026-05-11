'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ProfileChip({ profile }: { profile: any }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const name    = profile?.name    || 'Shinobi'
  const rank    = profile?.rank    || 'Genin'
  const village = profile?.village || 'Konoha'
  const image   = profile?.image   || ''
  const initial = name[0]?.toUpperCase() || 'S'

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl px-3 py-2 border transition-colors"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        {image ? (
          <img src={image} alt={name}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--primary)', color: 'white' }}>
            {initial}
          </div>
        )}
        <div className="text-left">
          <div className="text-xs font-semibold leading-tight"
            style={{ color: 'var(--foreground)' }}>{name}</div>
          <div className="text-[10px] leading-tight"
            style={{ color: 'var(--muted-foreground)' }}>{rank} · {village}</div>
        </div>
        <span className="text-xs ml-1" style={{ color: 'var(--muted-foreground)' }}>▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border p-5 space-y-3 shadow-xl"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)', top: '100%' }}>
            <div className="font-eyebrow text-[10px]"
              style={{ color: 'var(--primary)' }}>YOUR NINJA PROFILE</div>
            <div className="flex justify-center">
              {image ? (
                <img src={image} alt={name} className="w-16 h-16 rounded-full object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{ background: 'var(--primary)', color: 'white' }}>{initial}</div>
              )}
            </div>
            <div className="space-y-2">
              {[
                { label: 'NAME',    value: name    },
                { label: 'RANK',    value: rank    },
                { label: 'VILLAGE', value: village },
              ].map(field => (
                <div key={field.label}>
                  <div className="font-eyebrow text-[9px] mb-0.5"
                    style={{ color: 'var(--muted-foreground)' }}>{field.label}</div>
                  <div className="text-sm" style={{ color: 'var(--foreground)' }}>{field.value}</div>
                </div>
              ))}
            </div>
            <button onClick={signOut}
              className="w-full text-xs py-2 rounded-xl border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}>
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
