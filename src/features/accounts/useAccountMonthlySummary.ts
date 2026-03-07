import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../db'
import { lastNMonthsRange } from '../../lib/utils'
import { format, parseISO, addMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function useAccountMonthlySummary(accountId: string | null, months = 6) {
  const [from, to] = lastNMonthsRange(months)
  const txs = useLiveQuery(
    async () => {
      if (!accountId) return []
      const all = await db.transactions
        .where('account_id')
        .equals(accountId)
        .filter((t) => t.date >= from && t.date <= to)
        .toArray()
      return all
    },
    [accountId, from, to]
  )
  const list = txs ?? []
  const byMonth = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {}
    let cur = startOfMonth(parseISO(from))
    const end = endOfMonth(parseISO(to))
    while (cur <= end) {
      const key = format(cur, 'yyyy-MM')
      map[key] = { income: 0, expense: 0 }
      cur = addMonths(cur, 1)
    }
    for (const t of list) {
      const key = t.date.slice(0, 7)
      if (!map[key]) map[key] = { income: 0, expense: 0 }
      if (t.type === 'income') map[key].income += t.amount
      else if (t.type === 'expense') map[key].expense += t.amount
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        monthLabel: format(parseISO(month + '-01'), 'MMM yyyy', { locale: ptBR }),
        ...v,
      }))
  }, [list, from, to])
  return byMonth
}
