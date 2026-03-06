import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Transaction } from '../db'
import { generateId } from '../lib/utils'

export function useTransactions(filters?: { accountId?: string; from?: string; to?: string }) {
  const list = useLiveQuery(
    async () => {
      let collection = db.transactions.orderBy('date').reverse()
      if (filters?.accountId) {
        collection = collection.filter((t) => t.account_id === filters.accountId)
      }
      if (filters?.from || filters?.to) {
        return (await collection.toArray()).filter((t) => {
          if (filters.from && t.date < filters.from) return false
          if (filters.to && t.date > filters.to) return false
          return true
        })
      }
      return collection.toArray()
    },
    [filters?.accountId, filters?.from, filters?.to]
  )
  return list ?? []
}

export function useTransactionsWithLoading(filters?: {
  accountId?: string
  from?: string
  to?: string
}): { transactions: Transaction[]; isLoading: boolean } {
  const list = useLiveQuery(
    async () => {
      let collection = db.transactions.orderBy('date').reverse()
      if (filters?.accountId) {
        collection = collection.filter((t) => t.account_id === filters.accountId)
      }
      if (filters?.from || filters?.to) {
        return (await collection.toArray()).filter((t) => {
          if (filters?.from && t.date < filters.from) return false
          if (filters?.to && t.date > filters.to) return false
          return true
        })
      }
      return collection.toArray()
    },
    [filters?.accountId, filters?.from, filters?.to]
  )
  return { transactions: list ?? [], isLoading: list === undefined }
}

export function useTransaction(id: string | null) {
  return useLiveQuery(
    () => (id ? db.transactions.get(id) : Promise.resolve(undefined)),
    [id]
  )
}

export async function addTransaction(
  data: Omit<Transaction, 'id' | 'created_at' | 'updated_at' | 'synced_at'>
): Promise<string> {
  const id = generateId()
  const now = new Date().toISOString()
  await db.transactions.add({
    ...data,
    id,
    created_at: now,
    updated_at: now,
    synced_at: null,
  })
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'transactions',
    record_id: id,
    operation: 'insert',
    payload: JSON.stringify({ ...data, id, created_at: now, updated_at: now, synced_at: null }),
    created_at: now,
    attempts: 0,
  })
  return id
}

export async function updateTransaction(
  id: string,
  data: Partial<Omit<Transaction, 'id' | 'created_at'>>
): Promise<void> {
  const now = new Date().toISOString()
  const existing = await db.transactions.get(id)
  if (!existing) return
  const updated = { ...existing, ...data, updated_at: now }
  await db.transactions.put(updated)
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'transactions',
    record_id: id,
    operation: 'update',
    payload: JSON.stringify(updated),
    created_at: now,
    attempts: 0,
  })
}

export async function deleteTransaction(id: string): Promise<void> {
  await db.transactions.delete(id)
  const now = new Date().toISOString()
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'transactions',
    record_id: id,
    operation: 'delete',
    payload: JSON.stringify({ id }),
    created_at: now,
    attempts: 0,
  })
}

export async function getTransactionsByInstallmentGroupId(
  installment_group_id: string
): Promise<Transaction[]> {
  return db.transactions
    .where('installment_group_id')
    .equals(installment_group_id)
    .toArray()
}

export async function deleteTransactionGroup(installment_group_id: string): Promise<void> {
  const group = await getTransactionsByInstallmentGroupId(installment_group_id)
  const now = new Date().toISOString()
  for (const t of group) {
    await db.transactions.delete(t.id)
    await db.sync_queue.add({
      id: generateId(),
      table_name: 'transactions',
      record_id: t.id,
      operation: 'delete',
      payload: JSON.stringify({ id: t.id }),
      created_at: now,
      attempts: 0,
    })
  }
}

export function useRecentDescriptions(limit = 20): string[] {
  const list = useLiveQuery(
    async () => {
      const all = await db.transactions.orderBy('updated_at').reverse().toArray()
      const seen = new Set<string>()
      const out: string[] = []
      for (const t of all) {
        if (t.description && !seen.has(t.description)) {
          seen.add(t.description)
          out.push(t.description)
          if (out.length >= limit) break
        }
      }
      return out
    },
    [limit]
  )
  return list ?? []
}
