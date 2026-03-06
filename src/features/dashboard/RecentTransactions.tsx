import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { useTransactionsWithLoading } from '../../hooks/useTransactions'
import { useAccounts } from '../../hooks/useAccounts'
import { useCategories } from '../../hooks/useCategories'
import { formatCurrency, formatDate, monthRange } from '../../lib/utils'
import { useAppStore } from '../../store/appStore'
import { Skeleton } from '../../components/ui/Skeleton'

export function RecentTransactions() {
  const { selectedMonth } = useAppStore()
  const [from, to] = monthRange(selectedMonth)
  const { transactions, isLoading: transactionsLoading } = useTransactionsWithLoading({ from, to })
  const accounts = useAccounts(false)
  const categories = useCategories()

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts]
  )
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, { name: c.name, color: c.color }])),
    [categories]
  )

  const recent = useMemo(
    () => transactions.slice(0, 5),
    [transactions]
  )

  const isLoading = transactionsLoading

  if (isLoading) {
    return (
      <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-16" />
        </div>
        <ul className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-16" />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-surface-900">Últimas transações</h3>
        <Link
          to="/transactions"
          className="flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Ver todas
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="mt-4 text-sm text-surface-500">Nenhuma transação no mês.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {recent.map((t) => {
            const cat = t.category_id ? categoryMap.get(t.category_id) : null
            const amountColor =
              t.type === 'income'
                ? 'text-[var(--color-income)]'
                : t.type === 'expense'
                  ? 'text-[var(--color-expense)]'
                  : 'text-[var(--color-transfer)]'
            return (
              <li
                key={t.id}
                className="flex items-center gap-3 border-b border-surface-100 pb-3 last:border-0 last:pb-0"
              >
                <div
                  className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: cat?.color ?? '#94a3b8' }}
                >
                  {cat?.name?.charAt(0) ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-surface-900">{t.description}</p>
                  <p className="text-xs text-surface-500">
                    {accountMap.get(t.account_id) ?? t.account_id} · {formatDate(t.date)}
                  </p>
                </div>
                <span className={`shrink-0 font-medium ${amountColor}`}>
                  {t.type === 'expense' ? '-' : '+'}
                  {formatCurrency(t.amount)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
