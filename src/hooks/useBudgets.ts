import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db'
import type { Budget } from '../db'
import { generateId } from '../lib/utils'
import { monthRange, toISODate, addMonthToKey } from '../lib/utils'

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

/** Spent per category for the month: expense transactions where (is_paid=true OR date <= today). */
export function useBudgetSpentByCategory(month: string): Map<string, number> {
  const [from, to] = monthRange(month)
  const txs = useLiveQuery(
    async () => {
      const all = await db.transactions
        .where('date')
        .between(from, to, true, true)
        .toArray()
      return all
    },
    [from, to]
  )
  const list = txs ?? []
  const today = toISODate(new Date())
  return useMemo(() => {
    const map = new Map<string, number>()
    for (const t of list) {
      if (t.type !== 'expense' || !t.category_id) continue
      if (!t.is_paid && t.date > today) continue
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount)
    }
    return map
  }, [list, today])
}

export async function addBudget(data: Omit<Budget, 'id' | 'created_at' | 'updated_at' | 'synced_at'>): Promise<string> {
  const id = generateId()
  const now = new Date().toISOString()
  const budget: Budget = {
    ...data,
    id,
    created_at: now,
    updated_at: now,
    synced_at: null,
  }
  await db.budgets.add(budget)
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'budgets',
    record_id: id,
    operation: 'insert',
    payload: JSON.stringify(budget),
    created_at: now,
    attempts: 0,
  })
  return id
}

export async function addBudgetsForMonths(
  category_id: string,
  amount: number,
  startMonth: string,
  count: number
): Promise<void> {
  const now = new Date().toISOString()
  let month = startMonth
  for (let i = 0; i < count; i++) {
    const id = generateId()
    const budget: Budget = {
      id,
      category_id,
      amount,
      month,
      created_at: now,
      updated_at: now,
      synced_at: null,
    }
    await db.budgets.add(budget)
    await db.sync_queue.add({
      id: generateId(),
      table_name: 'budgets',
      record_id: id,
      operation: 'insert',
      payload: JSON.stringify(budget),
      created_at: now,
      attempts: 0,
    })
    month = addMonthToKey(month, 1)
  }
}

export async function updateBudget(
  id: string,
  data: Partial<Omit<Budget, 'id' | 'created_at'>>
): Promise<void> {
  const existing = await db.budgets.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  const updated = { ...existing, ...data, updated_at: now }
  await db.budgets.put(updated)
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'budgets',
    record_id: id,
    operation: 'update',
    payload: JSON.stringify(updated),
    created_at: now,
    attempts: 0,
  })
}

export async function deleteBudget(id: string): Promise<void> {
  await db.budgets.delete(id)
  const now = new Date().toISOString()
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'budgets',
    record_id: id,
    operation: 'delete',
    payload: JSON.stringify({ id }),
    created_at: now,
    attempts: 0,
  })
}
