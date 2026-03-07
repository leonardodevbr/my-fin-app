import { useState } from 'react'
import { ChevronDown, ChevronRight, Tag } from 'lucide-react'
import type { Budget } from '../../db'
import type { Category } from '../../db'
import type { Transaction } from '../../db'
import { formatCurrencyFromCents } from '../../lib/utils'
import { cn } from '../../lib/utils'
import { endOfMonth, differenceInDays } from 'date-fns'

function progressBarColor(pct: number): string {
  if (pct > 1) return 'bg-[var(--color-expense)]'
  if (pct >= 0.8) return 'bg-orange-500'
  if (pct >= 0.6) return 'bg-yellow-500'
  return 'bg-[var(--color-income)]'
}

export interface BudgetCardProps {
  budget: Budget
  category: Category | null
  spent: number
  transactions: Transaction[]
  daysRemaining: number
}

export function BudgetCard({
  budget,
  category,
  spent,
  transactions,
  daysRemaining,
}: BudgetCardProps) {
  const [expanded, setExpanded] = useState(false)
  const limit = budget.amount
  const pct = limit > 0 ? spent / limit : 0
  const name = category?.name ?? budget.category_id
  const color = category?.color ?? '#64748b'

  return (
    <div className="rounded-xl border border-surface-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left p-4"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: color }}
          >
            <Tag className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-surface-900 truncate">{name}</p>
            <p className="text-sm text-surface-600 tabular-nums">
              {formatCurrencyFromCents(spent)} / {formatCurrencyFromCents(limit)}
            </p>
          </div>
          {expanded ? (
            <ChevronDown className="h-5 w-5 shrink-0 text-surface-400" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-surface-400" />
          )}
        </div>
        <div className="mt-3 h-2.5 w-full overflow-visible rounded-full bg-surface-200 relative">
          <div
            className={cn('absolute left-0 top-0 h-full rounded-full transition-all duration-300', progressBarColor(pct))}
            style={{ width: `${Math.min(pct * 100, 100)}%` }}
          />
          {pct > 1 && (
            <div
              className={cn('absolute top-0 h-full rounded-r-full', progressBarColor(pct))}
              style={{
                left: '100%',
                width: `${Math.min((pct - 1) * 100, 50)}%`,
              }}
            />
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-surface-500">
          <span className={pct > 1 ? 'text-[var(--color-expense)] font-medium' : ''}>
            {limit > 0 ? `${(pct * 100).toFixed(0)}% usado` : '—'}
          </span>
          <span>{daysRemaining} dias restantes no mês</span>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-surface-200 bg-surface-50/50 px-4 py-3">
          <p className="text-xs font-medium text-surface-500 mb-2">Lançamentos neste mês</p>
          {transactions.length === 0 ? (
            <p className="text-sm text-surface-500">Nenhuma despesa nesta categoria.</p>
          ) : (
            <ul className="space-y-2">
              {transactions.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between text-sm text-surface-700"
                >
                  <span className="truncate">{t.description}</span>
                  <span className="shrink-0 tabular-nums text-[var(--color-expense)] ml-2">
                    {formatCurrencyFromCents(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function getDaysRemainingInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number)
  const end = endOfMonth(new Date(y, m - 1, 1))
  const today = new Date()
  return Math.max(0, differenceInDays(end, today))
}
