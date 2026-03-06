import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ArrowLeftRight,
  ChevronLeft,
  Wallet,
  Tags,
  BarChart3,
  PiggyBank,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useAppStore } from '../../store/appStore'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
  { to: '/accounts', icon: Wallet, label: 'Contas' },
  { to: '/categories', icon: Tags, label: 'Categorias' },
  { to: '/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/budgets', icon: PiggyBank, label: 'Orçamentos' },
]

function isNavActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/' || pathname === ''
  return pathname === to || pathname.startsWith(to + '/')
}

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore()
  const { pathname } = useLocation()
  const currentPath = (pathname || '/').replace(/^#/, '') || '/'

  return (
    <>
      {/* Backdrop no mobile: tocar fora fecha o drawer */}
      <button
        type="button"
        aria-label="Fechar menu"
        onClick={() => setSidebarOpen(false)}
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      {/* Sidebar: no mobile só aparece quando open; no desktop sempre visível */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-surface-900 text-white border-r border-surface-700 transition-transform duration-200 ease-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex items-center justify-between h-14 px-4 border-b border-surface-700">
          <span className="font-semibold text-primary-400">My Fin App</span>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded hover:bg-surface-700 lg:hidden"
            aria-label="Fechar menu"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => {
              const active = isNavActive(currentPath, to)
              return (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      active
                        ? 'bg-primary-600 text-white hover:bg-primary-600'
                        : 'text-surface-300 hover:bg-surface-800 hover:text-white'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>
    </>
  )
}
