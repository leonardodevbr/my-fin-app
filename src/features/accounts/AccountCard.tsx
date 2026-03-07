import { Link } from 'react-router-dom'
import { Pencil, Archive, Wallet, Landmark, CreditCard, Banknote, TrendingUp, PiggyBank } from 'lucide-react'
import type { Account } from '../../db'
import { formatCurrencyFromCents } from '../../lib/utils'
import { useAccountBalance } from '../../hooks/useAccounts'
import { ACCOUNT_TYPE_LABELS } from './constants'
import { cn } from '../../lib/utils'

const LUCIDE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  landmark: Landmark,
  'credit-card': CreditCard,
  banknote: Banknote,
  'trending-up': TrendingUp,
  'piggy-bank': PiggyBank,
  briefcase: Wallet,
  home: Landmark,
  car: Banknote,
  'shopping-cart': CreditCard,
}

function AccountIcon({ icon }: { icon: string }) {
  const LucideIcon = LUCIDE_ICONS[icon]
  if (LucideIcon) return <LucideIcon className="h-6 w-6 shrink-0" />
  return <span className="text-2xl leading-none">{icon}</span>
}

export interface AccountCardProps {
  account: Account
  onEdit: (account: Account) => void
  onArchive: (account: Account) => void
}

export function AccountCard({ account, onEdit, onArchive }: AccountCardProps) {
  const { balancePaid } = useAccountBalance(account.id)
  const typeLabel = ACCOUNT_TYPE_LABELS[account.type]

  return (
    <div
      className="flex flex-col rounded-xl border border-surface-200 border-l-4 bg-white shadow-sm overflow-hidden min-h-[160px]"
      style={{ borderLeftColor: account.color }}
    >
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/accounts/${account.id}`} className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-surface-700"
              style={{ backgroundColor: account.color + '20' }}
            >
              <AccountIcon icon={account.icon} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-surface-900 truncate">{account.name}</p>
              <span className="inline-block mt-0.5 rounded bg-surface-100 px-1.5 py-0.5 text-xs font-medium text-surface-600">
                {typeLabel}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(account)}
              className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onArchive(account)}
              className="rounded-lg p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700"
              aria-label="Arquivar"
            >
              <Archive className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p
          className={cn(
            'mt-3 text-xl font-bold tabular-nums',
            balancePaid >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
          )}
        >
          {formatCurrencyFromCents(balancePaid, account.currency)}
        </p>
        <Link
          to={`/transactions?account=${account.id}`}
          className="mt-2 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Ver lançamentos
        </Link>
      </div>
    </div>
  )
}
