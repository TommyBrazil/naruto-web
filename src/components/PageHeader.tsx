import { createClient } from '@/lib/supabase/server'
import ProfileChip from './ProfileChip'

export default async function PageHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <header className="flex items-center justify-end px-6 py-3 border-b flex-shrink-0"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <ProfileChip profile={profile} />
    </header>
  )
}
