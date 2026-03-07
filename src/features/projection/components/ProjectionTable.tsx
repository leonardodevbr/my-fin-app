import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ProjectionResult, ProjectionEntry } from '../projectionEngine'
import { formatCurrencyFromCents } from '../../../lib/utils'
import { cn } from '../../../lib/utils'

export interface ProjectionTableProps {
  result: ProjectionResult
  accountNames: Map<string, string>
  filterMonth?: string | null
}

function statusLabel(entry: ProjectionEntry): string {
  if (entry.event.is_virtual) return 'Projetado'
  if (entry.event.is_paid) return 'Pago'
  return 'Previsto'
}

function statusClass(entry: ProjectionEntry): string {
  if (entry.event.is_virtual) return 'text-surface-500 italic'
  if (entry.event.is_paid) return 'text-green-600'
  return 'text-blue-600'
}

export const ProjectionTable = React.memo(function ProjectionTable({
  result,
  accountNames,
  filterMonth,
}: ProjectionTableProps) {
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())

  const entriesByMonth = React.useMemo(() => {
    const map = new Map<string, ProjectionEntry[]>()
    for (const e of result.dailyEntries) {
      const month = e.date.slice(0, 7)
      if (filterMonth && month !== filterMonth) continue
      if (!map.has(month)) map.set(month, [])
      map.get(month)!.push(e)
    }
    return map
  }, [result.dailyEntries, filterMonth])

  const monthsToShow = filterMonth
    ? [filterMonth]
    : result.monthlyEntries.map((me) => me.month)

  return (
    <div className="border border-surface-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-50">
          <tr>
            <th className="w-8 px-2 py-2" />
            <th className="text-left px-3 py-2 font-medium text-surface-700">Data</th>
            <th className="text-left px-3 py-2 font-medium text-surface-700">Descrição</th>
            <th className="text-left px-3 py-2 font-medium text-surface-700">Conta</th>
            <th className="text-left px-3 py-2 font-medium text-surface-700">Tipo</th>
            <th className="text-right px-3 py-2 font-medium text-surface-700">Valor</th>
            <th className="text-right px-3 py-2 font-medium text-surface-700">Saldo após</th>
            <th className="text-left px-3 py-2 font-medium text-surface-700">Status</th>
          </tr>
        </thead>
        <tbody>
          {monthsToShow.map((month) => {
            const entries = entriesByMonth.get(month) ?? []
            const monthEntry = result.monthlyEntries.find((me) => me.month === month)
            const collapsed = collapsedMonths.has(month)
            const monthLabel = (() => {
              const [y, m] = month.split('-').map(Number)
              return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: ptBR })
            })()

            return (
              <React.Fragment key={month}>
                <tr
                  className="bg-surface-100 border-t border-surface-200 first:border-t-0"
                  onClick={() =>
                    setCollapsedMonths((s) => {
                      const next = new Set(s)
                      if (next.has(month)) next.delete(month)
                      else next.add(month)
                      return next
                    })
                  }
                >
                  <td className="px-2 py-2">
                    <button type="button" className="p-0.5">
                      {collapsed ? (
                        <ChevronRight className="h-4 w-4 text-surface-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-surface-500" />
                      )}
                    </button>
                  </td>
                  <td colSpan={2} className="px-3 py-2 font-medium text-surface-900 capitalize">
                    {monthLabel}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2">
                    {monthEntry && (
                      <span className="text-green-600">
                        +{formatCurrencyFromCents(monthEntry.income)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {monthEntry && (
                      <span className="text-red-600">
                        -{formatCurrencyFromCents(monthEntry.expenses)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {monthEntry && (
                      <span
                        className={cn(
                          'font-medium',
                          monthEntry.closing_balance < 0
                            ? 'text-red-600'
                            : 'text-surface-900'
                        )}
                      >
                        {formatCurrencyFromCents(monthEntry.closing_balance)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2" />
                </tr>
                {!collapsed &&
                  entries.map((entry) => (
                    <tr
                      key={entry.event.id}
                      className={cn(
                        'border-t border-surface-100 hover:bg-surface-50',
                        entry.event.is_virtual && 'bg-surface-50/50'
                      )}
                    >
                      <td className="w-8 px-2 py-2" />
                      <td className="px-3 py-2 text-surface-700">
                        {format(new Date(entry.date + 'T12:00:00'), 'dd/MM/yyyy', {
                          locale: ptBR,
                        })}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2',
                          entry.event.is_virtual && 'italic text-surface-600'
                        )}
                      >
                        {entry.event.description}
                      </td>
                      <td className="px-3 py-2 text-surface-600">
                        {accountNames.get(entry.event.account_id) ?? entry.event.account_id}
                      </td>
                      <td className="px-3 py-2 capitalize text-surface-600">
                        {entry.event.type === 'income'
                          ? 'Receita'
                          : entry.event.type === 'expense'
                            ? 'Despesa'
                            : 'Transferência'}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right',
                          entry.event.type === 'income'
                            ? 'text-green-600'
                            : 'text-red-600'
                        )}
                      >
                        {entry.event.type === 'income' ? '+' : '-'}
                        {formatCurrencyFromCents(entry.event.amount)}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right font-medium',
                          entry.balanceAfter < 0 ? 'text-red-600' : 'text-surface-900'
                        )}
                      >
                        {formatCurrencyFromCents(entry.balanceAfter)}
                      </td>
                      <td className={cn('px-3 py-2', statusClass(entry))}>
                        {statusLabel(entry)}
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
})
