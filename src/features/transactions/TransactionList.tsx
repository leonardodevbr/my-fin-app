import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Transaction } from '../../db'
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
}: TransactionListProps) {
  const [page, setPage] = useState(1)
  const accounts = useAccounts(false)
  const categories = useCategories()

  const accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts])
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, { name: c.name, color: c.color }])),
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

  return (
    <div className="space-y-6">
      {visibleGroups.map(({ date, items, dayTotal }) => (
        <section key={date}>
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="text-sm font-semibold text-surface-700">
              {format(new Date(date + 'T12:00:00'), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <span
              className={cn(
                'text-sm font-medium',
                dayTotal >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
              )}
            >
              {dayTotal >= 0 ? '+' : ''}
              {formatCurrencyFromCents(dayTotal)}
            </span>
          </div>
          <ul className="space-y-2">
            {items.map((t) => (
              <li key={t.id}>
                <TransactionItem
                  transaction={t}
                  accountName={accountMap.get(t.account_id) ?? t.account_id}
                  categoryColor={categoryMap.get(t.category_id ?? '')?.color ?? '#94a3b8'}
                  categoryName={categoryMap.get(t.category_id ?? '')?.name ?? ''}
                  onEdit={() => onEdit(t)}
                  onTogglePaid={() => onTogglePaid(t)}
                  onDelete={() => onDelete(t)}
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

