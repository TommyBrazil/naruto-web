'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      })
      if (error) { setError(error.message); setLoading(false); return; }
      setError('Check your email for a confirmation link.')
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return; }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--background)' }}>
      <div className="w-full max-w-sm mx-4 space-y-6">

        <div className="text-center space-y-2">
          <h1 className="font-display font-bold text-3xl"
            style={{ color: 'var(--primary)' }}>
            NARUTO
          </h1>
          <p className="font-eyebrow text-xs tracking-widest"
            style={{ color: 'var(--muted-foreground)' }}>
            COMPANION
          </p>
        </div>

        <div className="rounded-2xl border p-6 space-y-4"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>

          <h2 className="font-display font-bold text-lg"
            style={{ color: 'var(--foreground)' }}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="font-eyebrow text-[10px] block mb-1.5"
                style={{ color: 'var(--muted-foreground)' }}>
                EMAIL
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="input w-full"
              />
            </div>
            <div>
              <label className="font-eyebrow text-[10px] block mb-1.5"
                style={{ color: 'var(--muted-foreground)' }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input w-full"
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: error.includes('Check') ? 'var(--primary)' : '#ef4444' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-medium text-sm"
              style={{
                background: 'var(--primary)', color: 'white',
                border: 'none', cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
                fontSize: '16px',
              }}>
              {loading ? 'Loading…' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="text-xs w-full text-center py-2"
            style={{ color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}>
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>

        </div>
      </div>
    </div>
  )
}
