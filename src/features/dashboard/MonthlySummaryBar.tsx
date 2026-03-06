import { useMemo } from 'react'
import { useTransactionsWithLoading } from '../../hooks/useTransactions'
import { formatCurrencyFromCents, monthRange } from '../../lib/utils'
import { useAppStore } from '../../store/appStore'
import { Skeleton } from '../../components/ui/Skeleton'

export function MonthlySummaryBar() {
  const { selectedMonth } = useAppStore()
  const [from, to] = monthRange(selectedMonth)
  const { transactions, isLoading: transactionsLoading } = useTransactionsWithLoading({ from, to })

  const { income, expense, balance } = useMemo(() => {
    const inc = transactions
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0)
    const exp = transactions
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0)
    return {
      income: inc,
      expense: exp,
      balance: inc - exp,
    }
  }, [transactions])

  const ratio = income > 0 ? Math.min(expense / income, 1) : 0
  const isLoading = transactionsLoading

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs font-medium uppercase text-surface-500">Receitas</p>
          <p className="text-lg font-bold text-[var(--color-income)]">
            {formatCurrencyFromCents(income)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-surface-500">Despesas</p>
          <p className="text-lg font-bold text-[var(--color-expense)]">
            {formatCurrencyFromCents(expense)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-surface-500">Saldo do mês</p>
          <p
            className={`text-lg font-bold ${
              balance >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
            }`}
          >
            {formatCurrencyFromCents(balance)}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex h-2 overflow-hidden rounded-full bg-surface-200">
          <div
            className="rounded-full bg-[var(--color-expense)] transition-all duration-300"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-surface-500">
          Despesas / Receitas: {(ratio * 100).toFixed(0)}%
        </p>
      </div>
    </div>
  )
}
