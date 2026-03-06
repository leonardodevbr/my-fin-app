import { Fragment, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { Transaction } from '../../../db'
import { formatCurrencyFromCents, formatDate } from '../../../lib/utils'
import { cn } from '../../../lib/utils'

export interface CategoryRow {
  categoryId: string | null
  categoryName: string
  amount: number
  pct: number
  delta: number
}

export interface CategoryBreakdownTableProps {
  rows: CategoryRow[]
  transactionsByCategory: Record<string, Transaction[]>
  empty?: boolean
}

export function CategoryBreakdownTable({
  rows,
  transactionsByCategory,
  empty,
}: CategoryBreakdownTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  if (empty || !rows.length) return null

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-surface-200">
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-surface-200 bg-surface-50">
            <th className="w-8 px-2 py-2 text-left"></th>
            <th className="px-3 py-2 text-left font-medium text-surface-700">Categoria</th>
            <th className="px-3 py-2 text-right font-medium text-surface-700">Valor</th>
            <th className="px-3 py-2 text-right font-medium text-surface-700">% do total</th>
            <th className="px-3 py-2 text-right font-medium text-surface-700">vs mês anterior</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = row.categoryId ?? '_none'
            const isExpanded = expanded.has(key)
            const txs = transactionsByCategory[key] ?? []
            return (
              <Fragment key={key}>
                <tr
                  key={key}
                  className={cn(
                    'border-b border-surface-100 hover:bg-surface-50 cursor-pointer',
                    isExpanded && 'bg-surface-50'
                  )}
                  onClick={() => toggle(key)}
                >
                  <td className="px-2 py-2">
                    {txs.length > 0 ? (
                      isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-surface-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-surface-500" />
                      )
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-medium text-surface-900">{row.categoryName}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-surface-900">
                    {formatCurrencyFromCents(row.amount)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-surface-600">
                    {row.pct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row.delta === 0 ? (
                      <span className="text-surface-500">—</span>
                    ) : row.delta > 0 ? (
                      <span className="text-[var(--color-expense)]">↑ {formatCurrencyFromCents(row.delta)}</span>
                    ) : (
                      <span className="text-[var(--color-income)]">↓ {formatCurrencyFromCents(-row.delta)}</span>
                    )}
                  </td>
                </tr>
                {isExpanded && txs.length > 0 && (
                  <tr key={`${key}-detail`} className="bg-surface-50/80">
                    <td colSpan={5} className="px-4 py-2">
                      <ul className="space-y-1 text-surface-600">
                        {txs.map((t) => (
                          <li
                            key={t.id}
                            className="flex justify-between items-center text-xs sm:text-sm"
                          >
                            <span>{t.description}</span>
                            <span className="tabular-nums">
                              {formatDate(t.date, 'dd/MM')} · {formatCurrencyFromCents(t.amount)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
