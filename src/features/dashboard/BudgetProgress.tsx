import { useMemo } from 'react'
import { useBudgetsWithLoading } from '../../hooks/useBudgets'
import { useTransactions } from '../../hooks/useTransactions'
import { useCategories } from '../../hooks/useCategories'
import { formatCurrencyFromCents, monthRange } from '../../lib/utils'
import { useAppStore } from '../../store/appStore'
import { Skeleton } from '../../components/ui/Skeleton'

export function BudgetProgress() {
  const { selectedMonth } = useAppStore()
  const [from, to] = monthRange(selectedMonth)
  const { budgets, isLoading: budgetsLoading } = useBudgetsWithLoading(selectedMonth)
  const transactions = useTransactions({ from, to })
  const categories = useCategories()

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  )

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of transactions) {
      if (t.type !== 'expense' || !t.category_id) continue
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount)
    }
    return map
  }, [transactions])

  const items = useMemo(
    () =>
      budgets.map((b) => {
        const spent = spentByCategory.get(b.category_id) ?? 0
        const limit = b.amount
        const pct = limit > 0 ? Math.min(spent / limit, 1) : 0
        return {
          categoryId: b.category_id,
          categoryName: categoryMap.get(b.category_id) ?? b.category_id,
          spent,
          limit,
          pct,
        }
      }),
    [budgets, spentByCategory, categoryMap]
  )

  const isLoading = budgetsLoading

  if (isLoading) {
    return (
      <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
        <Skeleton className="h-6 w-32" />
        <div className="mt-3 space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="min-w-0 rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
      <h3 className="font-semibold text-surface-900">Orçamento do mês</h3>
      <ul className="mt-3 space-y-4">
        {items.map((item) => (
          <li key={item.categoryId}>
            <div className="flex justify-between text-sm">
              <span className="font-medium text-surface-700">{item.categoryName}</span>
              <span className="text-surface-600">
                {formatCurrencyFromCents(item.spent)} / {formatCurrencyFromCents(item.limit)}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  item.pct > 0.8 ? 'bg-[var(--color-expense)]' : 'bg-primary-500'
                }`}
                style={{ width: `${Math.min(item.pct * 100, 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
