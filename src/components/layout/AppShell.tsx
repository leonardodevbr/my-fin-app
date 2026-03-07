import { type ReactNode } from 'react'
import { Menu, RefreshCw } from 'lucide-react'
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

  return (
    <div className="min-h-screen bg-surface-100">
      <Sidebar />
      <div className={`min-w-0 ${sidebarOpen ? 'lg:pl-64' : ''}`}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-surface-200 bg-white px-4 lg:px-6">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-surface-100"
            aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            <Menu className="h-6 w-6 text-surface-600" />
          </button>
          <div className="flex-1 lg:flex-none">
            <span className="font-semibold text-surface-900 lg:hidden">My Fin App</span>
          </div>
          <div className="flex items-center gap-2 text-surface-500 text-sm">
            {syncing && <span>Sincronizando…</span>}
            {!syncing && last_synced && <span>Última sync: {new Date(last_synced).toLocaleTimeString('pt-BR')}</span>}
            {error && <span className="text-red-500" title={error}>Erro</span>}
            {isSupabaseConfigured && (
              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={syncing}
                className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-500 hover:text-surface-700 disabled:opacity-50"
                title="Sincronizar agora"
                aria-label="Sincronizar agora"
              >
                <RefreshCw className={syncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              </button>
            )}
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
