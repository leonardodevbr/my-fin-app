import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Wallet, User } from 'lucide-react'
import { cn } from '../../lib/utils'

// Só o essencial no footer; Categorias, Relatórios e Orçamentos ficam no menu lateral
const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Início' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transações' },
  { to: '/accounts', icon: Wallet, label: 'Contas' },
  { to: '/profile', icon: User, label: 'Perfil' },
]

function isNavActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/' || pathname === ''
  return pathname === to || pathname.startsWith(to + '/')
}

export function BottomNav() {
  const { pathname } = useLocation()
  const currentPath = (pathname || '/').replace(/^#/, '') || '/'

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-surface-200 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = isNavActive(currentPath, to)
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center justify-center flex-1 py-2 transition-colors min-w-0',
                active
                  ? 'text-primary-600 font-medium'
                  : 'text-surface-500 hover:text-primary-600'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-[10px] mt-0.5 truncate max-w-full">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
