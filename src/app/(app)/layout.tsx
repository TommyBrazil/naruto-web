import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import EpisodeSeeder from '@/components/EpisodeSeeder'
import PageHeader from '@/components/PageHeader'
import ThemeLoader from '@/components/ThemeLoader'
import MobileHeader from '@/components/MobileHeader'
import BottomNav from '@/components/BottomNav'
import { AddonsProvider } from '@/context/AddonsContext'
import { calculateStreak } from '@/lib/streak'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: profile }, { data: activity }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('activity').select('action, created_at').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(365),
  ])

  const streak = calculateStreak(activity || [])

  return (
    <AddonsProvider>
      <ThemeLoader />
      <div className="flex h-screen overflow-hidden"
        style={{ background: 'var(--background)' }}>
        <EpisodeSeeder userId={user.id} />
        <div className="hidden md:block">
          <Sidebar profile={profile} streak={streak} />
        </div>
        <main className="flex-1 overflow-hidden flex flex-col pb-16 md:pb-0">
          <MobileHeader profile={profile} />
          <div className="hidden md:block">
            <PageHeader />
          </div>
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </main>
        <BottomNav />
      </div>
    </AddonsProvider>
  )
}
