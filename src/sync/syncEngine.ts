import { db } from '../db'
import type { Account, Budget, Category, SyncQueueItem, Transaction, TransactionGroup } from '../db'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

const LAST_SYNC_KEY = 'finapp_last_sync'
const SYNC_INTERVAL_MS = 5 * 60 * 1000
let syncIntervalId: ReturnType<typeof setInterval> | null = null

function getLastSync(): string {
  try {
    return localStorage.getItem(LAST_SYNC_KEY) ?? ''
  } catch {
    return ''
  }
}

function setLastSync(iso: string): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, iso)
  } catch {
    // ignore
  }
}

/** Limpa o último sync para que o próximo pull traga tudo de novo (útil se categorias/contas não carregaram). */
export function clearLastSync(): void {
  try {
    localStorage.removeItem(LAST_SYNC_KEY)
  } catch {
    // ignore
  }
}

async function pushTable(
  tableName: string,
  items: SyncQueueItem[]
): Promise<void> {
  const supabase = getSupabase()
  if (!supabase || items.length === 0) return
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id
  for (const item of items) {
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>
      if (tableName === 'transactions' || tableName === 'transaction_groups') {
        if (userId) payload.user_id = userId
      }
      if (item.operation === 'delete') {
        await supabase.from(tableName).delete().eq('id', item.record_id)
      } else if (item.operation === 'insert') {
        await supabase.from(tableName).upsert(payload, { onConflict: 'id' })
      } else {
        await supabase.from(tableName).update(payload).eq('id', item.record_id)
      }
      const now = new Date().toISOString()
      if (tableName === 'accounts') {
        await db.accounts.update(item.record_id, { synced_at: now })
      } else if (tableName === 'categories') {
        await db.categories.update(item.record_id, { synced_at: now })
      } else if (tableName === 'transaction_groups') {
        await db.transaction_groups.update(item.record_id, { synced_at: now })
      } else if (tableName === 'transactions') {
        await db.transactions.update(item.record_id, { synced_at: now })
      } else if (tableName === 'budgets') {
        await db.budgets.update(item.record_id, { synced_at: now })
      }
      await db.sync_queue.delete(item.id)
    } catch (err) {
      await db.sync_queue.update(item.id, { attempts: item.attempts + 1 })
      throw err
    }
  }
}

export async function pushChanges(): Promise<void> {
  if (!isSupabaseConfigured) return
  const items = await db.sync_queue.orderBy('created_at').toArray()
  const byTable = items.reduce<Record<string, SyncQueueItem[]>>((acc, item) => {
    if (!acc[item.table_name]) acc[item.table_name] = []
    acc[item.table_name].push(item)
    return acc
  }, {})
  for (const [tableName, tableItems] of Object.entries(byTable)) {
    await pushTable(tableName, tableItems)
  }
}

function mergeByUpdatedAt<T extends { id: string; updated_at: string }>(
  local: T[],
  remote: T[],
  key: (r: T) => string
): T[] {
  const map = new Map<string, T>()
  for (const r of local) map.set(key(r), r)
  for (const r of remote) {
    const existing = map.get(key(r))
    if (!existing || existing.updated_at < r.updated_at) map.set(key(r), r)
  }
  return Array.from(map.values())
}

/** Strip user_id from remote row so Dexie stores only Transaction fields. */
function toTransaction(r: Record<string, unknown>): Transaction {
  const { user_id: _u, ...rest } = r
  return rest as unknown as Transaction
}

export async function pullChanges(since: string): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  const tables = ['accounts', 'categories', 'transaction_groups', 'transactions', 'budgets'] as const
  for (const tableName of tables) {
    let query = supabase.from(tableName).select('*')
    if (since) {
      query = query.gt('updated_at', since)
    }
    const { data: remote, error } = await query
    if (error) throw error
    if (!remote || remote.length === 0) continue
    const key = (r: { id: string }) => r.id
    if (tableName === 'accounts') {
      const local = await db.accounts.toArray()
      const merged = mergeByUpdatedAt(local, remote as Account[], key) as Account[]
      await db.accounts.bulkPut(merged)
    } else if (tableName === 'categories') {
      const local = await db.categories.toArray()
      const merged = mergeByUpdatedAt(local, remote as Category[], key) as Category[]
      await db.categories.bulkPut(merged)
    } else if (tableName === 'transaction_groups') {
      const local = await db.transaction_groups.toArray()
      const merged = mergeByUpdatedAt(local, remote as TransactionGroup[], key) as TransactionGroup[]
      await db.transaction_groups.bulkPut(merged)
    } else if (tableName === 'transactions') {
      const local = await db.transactions.toArray()
      const remoteTx = (remote as Record<string, unknown>[]).map(toTransaction)
      const merged = mergeByUpdatedAt(local, remoteTx, key) as Transaction[]
      await db.transactions.bulkPut(merged)
    } else if (tableName === 'budgets') {
      const local = await db.budgets.toArray()
      const merged = mergeByUpdatedAt(local, remote as Budget[], key) as Budget[]
      await db.budgets.bulkPut(merged)
    }
  }
  setLastSync(new Date().toISOString())
}

export async function syncAll(): Promise<void> {
  if (!isSupabaseConfigured) return
  const since = getLastSync()
  await pullChanges(since)
  const { scheduleRecurringTransactions } = await import('./recurringScheduler')
  await scheduleRecurringTransactions()
  await pushChanges()
}

export function startAutoSync(onStatus?: (syncing: boolean, error?: string) => void): () => void {
  if (!isSupabaseConfigured) return () => {}

  const run = async (): Promise<void> => {
    try {
      onStatus?.(true)
      await syncAll()
      onStatus?.(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      onStatus?.(false, msg)
    }
  }

  const onFocus = (): void => {
    void run()
  }
  const onOnline = (): void => {
    void run()
  }

  window.addEventListener('focus', onFocus)
  window.addEventListener('online', onOnline)
  syncIntervalId = setInterval(run, SYNC_INTERVAL_MS)
  void run()

  return () => {
    window.removeEventListener('focus', onFocus)
    window.removeEventListener('online', onOnline)
    if (syncIntervalId) {
      clearInterval(syncIntervalId)
      syncIntervalId = null
    }
  }
}

export function getLastSyncTime(): string {
  return getLastSync()
}
