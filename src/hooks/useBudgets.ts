import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Budget } from '../db'

export function useBudgets(month: string) {
  const list = useLiveQuery(
    () => db.budgets.filter((b) => b.month === month).toArray(),
    [month]
  )
  return list ?? []
}

export function useBudgetsWithLoading(month: string): {
  budgets: Budget[]
  isLoading: boolean
} {
  const list = useLiveQuery(
    () => db.budgets.filter((b) => b.month === month).toArray(),
    [month]
  )
  return { budgets: list ?? [], isLoading: list === undefined }
}
