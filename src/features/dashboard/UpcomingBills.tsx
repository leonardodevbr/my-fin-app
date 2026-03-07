import { useMemo } from 'react'
import { useTransactionsWithLoading } from '../../hooks/useTransactions'
import { useAccounts } from '../../hooks/useAccounts'
import { formatCurrencyFromCents, formatDate, toISODate } from '../../lib/utils'
import { Skeleton } from '../../components/ui/Skeleton'

function getDaysAhead(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function UpcomingBills() {
  const limit30 = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return toISODate(d)
  })()
  const from30 = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return toISODate(d)
  })()
  const { transactions: allTransactions, isLoading: transactionsLoading } =
    useTransactionsWithLoading({ from: from30, to: limit30 })
  const accounts = useAccounts(false)

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts]
  )

  const today = toISODate(new Date())
  const limit7 = getDaysAhead(7)

  const upcoming = useMemo(() => {
    return allTransactions
      .filter(
        (t) =>
          !t.is_paid &&
          t.date >= today &&
          t.date <= limit7
      )
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [allTransactions])

  const overdueExpenses = useMemo(() => {
    return allTransactions
      .filter((t) => t.type === 'expense' && !t.is_paid && t.date < today)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [allTransactions])

  const list = [...overdueExpenses, ...upcoming]
  const isLoading = transactionsLoading

  if (isLoading) {
    return (
      <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
        <Skeleton className="h-6 w-36" />
        <ul className="mt-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <li key={i}>
              <Skeleton className="h-12 rounded-lg" />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (list.length === 0) return null

  return (
    <div className="min-w-0 rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-surface-900">Contas a pagar e receber (próximos 7 dias)</h3>
      <ul className="mt-3 space-y-2">
        {list.map((t) => {
          const isIncome = t.type === 'income'
          const isOverdue = !isIncome && t.date < today
          return (
            <li
              key={t.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                isIncome ? 'bg-emerald-50' : isOverdue ? 'bg-red-50' : 'bg-surface-50'
              }`}
            >
              <div>
                <p className="font-medium text-surface-900">{t.description}</p>
                <p className="text-xs text-surface-500">
                  {accountMap.get(t.account_id)} · {formatDate(t.date)}
                  {isOverdue && (
                    <span className="ml-1 font-medium text-[var(--color-expense)]">(vencida)</span>
                  )}
                </p>
              </div>
              <span
                className={
                  isIncome
                    ? 'font-semibold text-emerald-700'
                    : 'font-semibold text-[var(--color-expense)]'
                }
              >
                {isIncome ? '+' : '-'}
                {formatCurrencyFromCents(t.amount)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
