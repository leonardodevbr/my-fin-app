import { type ReactNode, useEffect, useState } from 'react'
import { Menu, RefreshCw } from 'lucide-react'
import { cn, formatRelativeTime } from '../../lib/utils'
import { AppLogo } from './AppLogo'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { useAppStore } from '../../store/appStore'
import { useSyncStatus } from '../../sync/useSyncStatus'
import { isSupabaseConfigured } from '../../lib/supabase'

export interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { sidebarOpen, setSidebarOpen } = useAppStore()
  const { syncing, last_synced, error, syncNow } = useSyncStatus()
  const [relativeTime, setRelativeTime] = useState(() => formatRelativeTime(last_synced))

  useEffect(() => {
    setRelativeTime(formatRelativeTime(last_synced))
    const t = setInterval(() => setRelativeTime(formatRelativeTime(last_synced)), 10_000)
    return () => clearInterval(t)
  }, [last_synced])

  useEffect(() => {
    if (window.innerWidth >= 1024) setSidebarOpen(true)
    const handleResize = () => {
      if (window.innerWidth >= 1024) setSidebarOpen(true)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [setSidebarOpen])

  return (
    <div className="min-h-screen bg-surface-100">
      <Sidebar />
      <div
        className={cn(
          'min-w-0 flex-1 transition-all duration-200',
          sidebarOpen && 'lg:pl-64'
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-surface-200 bg-white px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-surface-100"
            aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            <Menu className="h-6 w-6 text-surface-600" />
          </button>
          <div className="flex-1 lg:flex-none flex items-center lg:hidden">
            <AppLogo height={30} className="max-h-11" />
          </div>
          <div className="flex items-center gap-2 text-surface-500 text-sm">
            {syncing && <span>Sincronizando…</span>}
            {!syncing && last_synced && (
              <span className="flex items-center gap-1.5">
                {relativeTime}
                {isSupabaseConfigured && (
                  <button
                    type="button"
                    onClick={() => void syncNow()}
                    disabled={syncing}
                    className="p-1 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-700 disabled:opacity-50"
                    title="Sincronizar agora"
                    aria-label="Sincronizar agora"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </span>
            )}
            {error && <span className="text-red-500" title={error}>Erro</span>}
          </div>
        </header>
        <main className="min-w-0 overflow-x-hidden pb-20 lg:pb-6 px-4 lg:px-6 py-4">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
