import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useBudgets, useBudgetSpentByCategory } from '../../hooks/useBudgets'
import { useCategories } from '../../hooks/useCategories'
import { useTransactions } from '../../hooks/useTransactions'
import { formatCurrencyFromCents, monthRange, toMonthKey, addMonthToKey } from '../../lib/utils'
import { BudgetCard, getDaysRemainingInMonth } from './BudgetCard'
import { BudgetFormModal } from './BudgetFormModal'
import type { Budget } from '../../db'
import { cn } from '../../lib/utils'

export function BudgetsPage() {
  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()))
  const [formOpen, setFormOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

  const budgets = useBudgets(monthKey)
  const spentByCategory = useBudgetSpentByCategory(monthKey)
  const categories = useCategories()
  const [from, to] = monthRange(monthKey)
  const transactions = useTransactions({ from, to })

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  )

  const { totalOrcado, totalGasto, disponivel } = useMemo(() => {
    let orcado = 0
    let gasto = 0
    for (const b of budgets) {
      orcado += b.amount
      gasto += spentByCategory.get(b.category_id) ?? 0
    }
    return {
      totalOrcado: orcado,
      totalGasto: gasto,
      disponivel: orcado - gasto,
    }
  }, [budgets, spentByCategory])

  const transactionsByCategory = useMemo(() => {
    const map = new Map<string, typeof transactions>()
    for (const t of transactions) {
      if (t.type !== 'expense' || !t.category_id) continue
      const list = map.get(t.category_id) ?? []
      list.push(t)
      map.set(t.category_id, list)
    }
    return map
  }, [transactions])

  const daysRemaining = getDaysRemainingInMonth(monthKey)

  const addMonth = (delta: number) => {
    setMonthKey((k) => addMonthToKey(k, delta))
  }

  const handleNew = () => {
    setEditingBudget(null)
    setFormOpen(true)
  }

  const handleSaved = () => {
    setFormOpen(false)
    setEditingBudget(null)
  }

  const monthLabel = (() => {
    try {
      const [y, m] = monthKey.split('-').map(Number)
      return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: ptBR })
    } catch {
      return monthKey
    }
  })()

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-2xl font-bold text-surface-900">Orçamentos</h1>

      <div className="flex items-center justify-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 shadow-sm">
        <button
          type="button"
          onClick={() => addMonth(-1)}
          className="rounded-lg p-1.5 text-surface-600 hover:bg-surface-100"
          aria-label="Mês anterior"
        >
          ‹
        </button>
        <span className="min-w-[140px] text-center text-sm font-semibold text-surface-900 capitalize">
          {monthLabel}
        </span>
        <button
          type="button"
          onClick={() => addMonth(1)}
          className="rounded-lg p-1.5 text-surface-600 hover:bg-surface-100"
          aria-label="Mês seguinte"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs font-medium text-surface-500">Total orçado</p>
          <p className="text-lg font-bold text-surface-900 tabular-nums">
            {formatCurrencyFromCents(totalOrcado)}
          </p>
        </div>
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs font-medium text-surface-500">Total gasto</p>
          <p className="text-lg font-bold text-[var(--color-expense)] tabular-nums">
            {formatCurrencyFromCents(totalGasto)}
          </p>
        </div>
        <div className="rounded-xl border border-surface-200 bg-white p-3">
          <p className="text-xs font-medium text-surface-500">Disponível</p>
          <p
            className={cn(
              'text-lg font-bold tabular-nums',
              disponivel >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
            )}
          >
            {formatCurrencyFromCents(disponivel)}
          </p>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50/50 py-12 text-center">
          <p className="text-surface-600 font-medium">Nenhum orçamento neste mês.</p>
          <p className="text-sm text-surface-500 mt-1">
            Toque em &quot;+ Novo orçamento&quot; para definir limites por categoria.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              category={categoryMap.get(budget.category_id) ?? null}
              spent={spentByCategory.get(budget.category_id) ?? 0}
              transactions={transactionsByCategory.get(budget.category_id) ?? []}
              daysRemaining={daysRemaining}
            />
          ))}
        </div>
      )}

      <BudgetFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        budget={editingBudget}
        initialMonth={monthKey}
        onSaved={handleSaved}
      />

      <button
        type="button"
        onClick={handleNew}
        className="fixed bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2"
        aria-label="Novo orçamento"
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  )
}
