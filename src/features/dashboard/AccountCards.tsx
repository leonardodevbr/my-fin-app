import { useNavigate } from 'react-router-dom'
import {
  Wallet,
  Landmark,
  CreditCard,
  Banknote,
  TrendingUp,
  PiggyBank,
} from 'lucide-react'
import { useAccountsWithLoading } from '../../hooks/useAccounts'
import { formatCurrency } from '../../lib/utils'
import { Skeleton } from '../../components/ui/Skeleton'
import type { Account } from '../../db'

const ACCOUNT_ICONS: Record<Account['type'], React.ComponentType<{ className?: string }>> = {
  checking: Landmark,
  savings: PiggyBank,
  credit: CreditCard,
  cash: Banknote,
  investment: TrendingUp,
}

export function AccountCards() {
  const navigate = useNavigate()
  const { accounts, isLoading } = useAccountsWithLoading(true)

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 min-w-[200px] rounded-xl md:min-w-0" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3">
      {accounts.map((account) => {
        const Icon = ACCOUNT_ICONS[account.type] ?? Wallet
        return (
          <button
            key={account.id}
            type="button"
            onClick={() => navigate(`/transactions?account=${account.id}`)}
            className="flex min-w-[200px] items-center gap-3 rounded-xl border border-surface-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 md:min-w-0"
          >
            <div
              className="h-12 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: account.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-surface-900">{account.name}</p>
              <p className="flex items-center gap-1.5 text-sm text-surface-500">
                <Icon className="h-4 w-4 shrink-0" />
                {account.type}
              </p>
            </div>
            <p className="shrink-0 font-semibold text-surface-900">
              {formatCurrency(account.balance, account.currency)}
            </p>
          </button>
        )
      })}
    </div>
  )
}
