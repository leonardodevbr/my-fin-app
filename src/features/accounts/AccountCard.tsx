import { Link } from 'react-router-dom'
import { Pencil, Archive, Wallet, Landmark, CreditCard, Banknote, TrendingUp, PiggyBank } from 'lucide-react'
import type { Account } from '../../db'
import { formatCurrencyFromCents } from '../../lib/utils'
import { useComputedAccountBalance } from '../../hooks/useAccounts'
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
  if (LucideIcon) return <LucideIcon className="h-7 w-7 shrink-0" />
  return <span className="text-2xl leading-none">{icon}</span>
}

export interface AccountCardProps {
  account: Account
  onEdit: (account: Account) => void
  onArchive: (account: Account) => void
}

export function AccountCard({ account, onEdit, onArchive }: AccountCardProps) {
  const computedBalance = useComputedAccountBalance(account.id)
  const typeLabel = ACCOUNT_TYPE_LABELS[account.type]

  return (
    <article
      className="rounded-xl border border-surface-200 border-l-4 bg-white shadow-sm overflow-hidden"
      style={{ borderLeftColor: account.color }}
    >
      <header className="flex items-start gap-3 p-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-surface-700"
          style={{ backgroundColor: account.color + '20' }}
        >
          <AccountIcon icon={account.icon} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-surface-900">
            <Link to={`/accounts/${account.id}`} className="hover:underline">
              {account.name}
            </Link>
          </h2>
          <p className="mt-1 text-sm text-surface-600">{typeLabel}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
      </header>
      <div className="border-t border-surface-100 px-4 py-3">
        <p
          className={cn(
            'text-2xl font-bold tabular-nums',
            computedBalance >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
          )}
        >
          {formatCurrencyFromCents(computedBalance, account.currency)}
        </p>
        <Link
          to={`/transactions?account=${account.id}`}
          className="mt-2 inline-block text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Ver lançamentos
        </Link>
      </div>
    </article>
  )
}
