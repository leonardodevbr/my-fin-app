import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Transaction } from '../db'
import { toISODate } from '../lib/utils'

const DEFAULT_DAYS_AHEAD = 14

/**
 * Transações com data de vencimento nos próximos N dias (hoje inclusivo).
 * Por padrão considera apenas não pagas; opcionalmente todas.
 */
export function useDueTransactions(options?: {
  daysAhead?: number
  unpaidOnly?: boolean
}): Transaction[] {
  const daysAhead = options?.daysAhead ?? DEFAULT_DAYS_AHEAD
  const unpaidOnly = options?.unpaidOnly ?? true

  const list = useLiveQuery(
    async () => {
      const today = toISODate(new Date())
      const end = new Date()
      end.setDate(end.getDate() + daysAhead)
      const endStr = toISODate(end)
      const results = await db.transactions
        .where('date')
        .between(today, endStr, true, true)
        .toArray()
      const filtered = unpaidOnly ? results.filter((t) => !t.is_paid) : results
      return filtered.sort((a, b) => a.date.localeCompare(b.date))
    },
    [daysAhead, unpaidOnly]
  )
  return list ?? []
}
