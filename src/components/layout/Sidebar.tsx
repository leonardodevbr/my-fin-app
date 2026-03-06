import { NavLink } from 'react-router-dom'
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

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore()

  if (!sidebarOpen) return null

  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 w-64 bg-surface-900 text-white border-r border-surface-700 z-40">
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
          {navItems.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-surface-300 hover:bg-surface-800 hover:text-white transition-colors',
                    isActive && 'bg-primary-600 text-white hover:bg-primary-600'
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}
