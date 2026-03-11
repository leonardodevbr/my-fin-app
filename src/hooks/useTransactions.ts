import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Transaction } from '../db'
import { generateId } from '../lib/utils'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

export function useTransactions(filters?: { accountId?: string; from?: string; to?: string }) {
  const list = useLiveQuery(
    async () => {
      if (filters?.from && filters?.to) {
        let results = await db.transactions
          .where('date')
          .between(filters.from!, filters.to!, true, true)
          .toArray()
        if (filters.accountId) {
          results = results.filter((t) => t.account_id === filters!.accountId)
        }
        return results.sort((a, b) => b.date.localeCompare(a.date))
      }
      let collection = db.transactions.orderBy('date').reverse()
      if (filters?.accountId) {
        collection = collection.filter((t) => t.account_id === filters.accountId)
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
      if (filters?.from && filters?.to) {
        let results = await db.transactions
          .where('date')
          .between(filters.from!, filters.to!, true, true)
          .toArray()
        if (filters.accountId) {
          results = results.filter((t) => t.account_id === filters!.accountId)
        }
        return results.sort((a, b) => b.date.localeCompare(a.date))
      }
      let collection = db.transactions.orderBy('date').reverse()
      if (filters?.accountId) {
        collection = collection.filter((t) => t.account_id === filters.accountId)
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
  const row: Transaction = {
    ...data,
    id,
    created_at: now,
    updated_at: now,
    synced_at: null,
  }
  await db.transactions.add(row)
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'transactions',
    record_id: id,
    operation: 'insert',
    payload: JSON.stringify(row),
    created_at: now,
    attempts: 0,
  })

  // Best-effort: envia imediatamente para o Supabase quando online.
  if (isSupabaseConfigured) {
    const supabase = getSupabase()
    if (supabase) {
      try {
        await supabase.from('transactions').upsert(row, { onConflict: 'id' })
      } catch {
        // Fica na fila; pushChanges trata depois.
      }
    }
  }
  return id
}

export async function updateTransaction(
  id: string,
  data: Partial<Omit<Transaction, 'id' | 'created_at'>>
): Promise<void> {
  const now = new Date().toISOString()
  const existing = await db.transactions.get(id)
  if (!existing) return
  const paid_at =
    data.is_paid !== undefined ? (data.is_paid ? now : null) : existing.paid_at
  const updated: Transaction = { ...existing, ...data, paid_at, updated_at: now }
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

  if (isSupabaseConfigured) {
    const supabase = getSupabase()
    if (supabase) {
      try {
        await supabase.from('transactions').update(updated).eq('id', id)
      } catch {
        // Fila garante retry.
      }
    }
  }
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

  if (isSupabaseConfigured) {
    const supabase = getSupabase()
    if (supabase) {
      try {
        await supabase.from('transactions').delete().eq('id', id)
      } catch {
        // Mantém na fila para tentar depois.
      }
    }
  }
}

export async function getTransactionsByGroupId(group_id: string): Promise<Transaction[]> {
  return db.transactions.where('group_id').equals(group_id).toArray()
}

export async function deleteTransactionGroup(group_id: string): Promise<void> {
  const group = await getTransactionsByGroupId(group_id)
  const now = new Date().toISOString()
  const supabase = isSupabaseConfigured ? getSupabase() : null

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

    if (supabase) {
      try {
        await supabase.from('transactions').delete().eq('id', t.id)
      } catch {
        // Ignora; fila tenta depois.
      }
    }
  }
  await db.transaction_groups.delete(group_id)
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'transaction_groups',
    record_id: group_id,
    operation: 'delete',
    payload: JSON.stringify({ id: group_id }),
    created_at: now,
    attempts: 0,
  })

  if (supabase) {
    try {
      await supabase.from('transaction_groups').delete().eq('id', group_id)
    } catch {
      // Fila tenta depois.
    }
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
