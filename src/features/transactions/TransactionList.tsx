import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Transaction, TransactionGroup } from '../../db'
import { db } from '../../db'
import { formatCurrencyFromCents, cn } from '../../lib/utils'
import { useAccounts } from '../../hooks/useAccounts'
import { useCategories } from '../../hooks/useCategories'
import { TransactionItem } from './TransactionItem'
import { Button } from '../../components/ui/Button'

const PAGE_SIZE = 50

export interface TransactionListProps {
  transactions: Transaction[]
  onEdit: (t: Transaction) => void
  onTogglePaid: (t: Transaction) => void
  onDelete: (t: Transaction) => void
  selectionMode?: boolean
  selectedIds?: Set<string>
  onToggleSelect?: (id: string, selected: boolean) => void
  onBulkMarkPaid?: () => void
  onBulkDelete?: () => void
  onCancelSelection?: () => void
}

function groupByDate(transactions: Transaction[]): { date: string; items: Transaction[]; dayTotal: number }[] {
  const map = new Map<string, Transaction[]>()
  for (const t of transactions) {
    const list = map.get(t.date) ?? []
    list.push(t)
    map.set(t.date, list)
  }
  const dates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a))
  return dates.map((date) => {
    const items = map.get(date)!
    const dayTotal = items.reduce((sum, t) => {
      if (t.type === 'income') return sum + t.amount
      if (t.type === 'expense') return sum - t.amount
      return sum
    }, 0)
    return { date, items, dayTotal }
  })
}

export function TransactionList({
  transactions,
  onEdit,
  onTogglePaid,
  onDelete,
  selectionMode,
  selectedIds = new Set(),
  onToggleSelect,
  onBulkMarkPaid,
  onBulkDelete,
  onCancelSelection,
}: TransactionListProps) {
  const [page, setPage] = useState(1)
  const accounts = useAccounts(false)
  const categories = useCategories()

  const groupIds = useMemo(
    () => [...new Set(transactions.map((t) => t.group_id).filter((id): id is string => id != null))],
    [transactions]
  )
  const groupsList = useLiveQuery(
    async (): Promise<TransactionGroup[]> =>
      groupIds.length > 0 ? db.transaction_groups.where('id').anyOf(groupIds).toArray() : [],
    [groupIds.join(',')]
  )
  const groupMap = useMemo(() => new Map((groupsList ?? []).map((g) => [g.id, g])), [groupsList])

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, { name: c.name, color: c.color, icon: c.icon }])),
    [categories]
  )

  const grouped = useMemo(() => groupByDate(transactions), [transactions])
  const flatCount = grouped.reduce((s, g) => s + g.items.length, 0)
  const visibleGroups = useMemo(() => {
    let count = 0
    const limit = page * PAGE_SIZE
    const result: { date: string; items: Transaction[]; dayTotal: number }[] = []
    for (const g of grouped) {
      if (count >= limit) break
      const remaining = limit - count
      if (g.items.length <= remaining) {
        result.push(g)
        count += g.items.length
      } else {
        result.push({
          date: g.date,
          items: g.items.slice(0, remaining),
          dayTotal: g.items.slice(0, remaining).reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0),
        })
        count += remaining
      }
    }
    return result
  }, [grouped, page])

  const hasMore = flatCount > page * PAGE_SIZE

  if (transactions.length === 0) {
    return (
      <p className="py-8 text-center text-surface-500">Nenhuma transação encontrada.</p>
    )
  }

  const selectedCount = selectedIds.size

  return (
    <div className="space-y-6 pb-24 sm:pb-0">
      {selectionMode && selectedCount > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 shadow-sm">
          <span className="text-sm font-medium text-surface-700">
            {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
          </span>
          {onBulkMarkPaid && (
            <Button variant="secondary" size="sm" onClick={onBulkMarkPaid}>
              Marcar como pago
            </Button>
          )}
          {onBulkDelete && (
            <Button variant="danger" size="sm" onClick={onBulkDelete}>
              Excluir
            </Button>
          )}
          {onCancelSelection && (
            <Button variant="ghost" size="sm" onClick={onCancelSelection}>
              Cancelar
            </Button>
          )}
        </div>
      )}
      {visibleGroups.map(({ date, items, dayTotal }) => (
        <section key={date} className="space-y-2">
          <header className="w-full flex items-center justify-between rounded-lg border border-surface-200 bg-surface-50 px-3 py-2">
            <h3 className="text-sm font-semibold text-surface-700">
              {format(new Date(date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <span
              className={cn(
                'text-sm font-medium tabular-nums',
                dayTotal >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
              )}
            >
              {dayTotal >= 0 ? '+' : ''}
              {formatCurrencyFromCents(dayTotal)}
            </span>
          </header>
          <ul className="space-y-2">
            {items.map((t) => (
              <li key={t.id}>
                <TransactionItem
                  transaction={t}
                  accountName={accountMap.get(t.account_id) ?? t.account_id}
                  categoryColor={categoryMap.get(t.category_id ?? '')?.color ?? '#94a3b8'}
                  categoryName={categoryMap.get(t.category_id ?? '')?.name ?? ''}
                  categoryIcon={categoryMap.get(t.category_id ?? '')?.icon ?? null}
                  onEdit={() => onEdit(t)}
                  onTogglePaid={() => onTogglePaid(t)}
                  onDelete={() => onDelete(t)}
                  selectionMode={selectionMode}
                  selected={selectedIds.has(t.id)}
                  onToggleSelect={onToggleSelect ? () => onToggleSelect(t.id, !selectedIds.has(t.id)) : undefined}
                  paymentMode={t.group_id ? groupMap.get(t.group_id)?.payment_mode : null}
                  installmentsTotal={t.group_id ? groupMap.get(t.group_id)?.installments_total ?? null : null}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  )
}

