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
      // Tabelas multi-tenant: sempre garantir user_id no Supabase
      if (userId && ['accounts', 'transactions', 'transaction_groups', 'budgets'].includes(tableName)) {
        payload.user_id = userId
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

/** Ordem obrigatória: FKs (transaction_groups) antes de dependentes (transactions). */
const PUSH_TABLE_ORDER = ['accounts', 'categories', 'transaction_groups', 'transactions', 'budgets']

export async function pushChanges(): Promise<void> {
  if (!isSupabaseConfigured) return
  const items = await db.sync_queue.orderBy('created_at').toArray()
  const byTable = items.reduce<Record<string, SyncQueueItem[]>>((acc, item) => {
    if (!acc[item.table_name]) acc[item.table_name] = []
    acc[item.table_name].push(item)
    return acc
  }, {})
  for (const tableName of PUSH_TABLE_ORDER) {
    const tableItems = byTable[tableName]
    if (tableItems?.length) await pushTable(tableName, tableItems)
  }
  for (const [tableName, tableItems] of Object.entries(byTable)) {
    if (!PUSH_TABLE_ORDER.includes(tableName)) await pushTable(tableName, tableItems)
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

/** Normaliza id para comparação (Supabase pode devolver UUID em formato diferente). */
function normId(id: string | number): string {
  return String(id ?? '').trim().toLowerCase()
}

export async function pullChanges(): Promise<void> {
  const supabase = getSupabase()
  if (!supabase) return
  const tables = ['accounts', 'categories', 'transaction_groups', 'transactions', 'budgets'] as const
  for (const tableName of tables) {
    const { data: remote, error } = await supabase.from(tableName).select('*')
    if (error) throw error
    const rows = (remote ?? []) as { id: string }[]
    const key = (r: { id: string }) => r.id
    const remoteIds = new Set(rows.map((r) => normId(r.id)))
    const emptyRemote = rows.length === 0

    if (tableName === 'accounts') {
      if (emptyRemote) {
        await db.accounts.clear()
      } else {
        const local = await db.accounts.toArray()
        const merged = mergeByUpdatedAt(local, rows as Account[], key) as Account[]
        const toDelete = local.filter((a) => !remoteIds.has(normId(a.id)))
        if (toDelete.length) await db.accounts.bulkDelete(toDelete.map((a) => a.id))
        await db.accounts.bulkPut(merged)
      }
    } else if (tableName === 'categories') {
      if (emptyRemote) {
        await db.categories.clear()
      } else {
        const local = await db.categories.toArray()
        const merged = mergeByUpdatedAt(local, rows as Category[], key) as Category[]
        const toDelete = local.filter((c) => !remoteIds.has(normId(c.id)))
        if (toDelete.length) await db.categories.bulkDelete(toDelete.map((c) => c.id))
        await db.categories.bulkPut(merged)
      }
    } else if (tableName === 'transaction_groups') {
      if (emptyRemote) {
        await db.transaction_groups.clear()
      } else {
        const local = await db.transaction_groups.toArray()
        const merged = mergeByUpdatedAt(local, rows as TransactionGroup[], key) as TransactionGroup[]
        const toDelete = local.filter((g) => !remoteIds.has(normId(g.id)))
        if (toDelete.length) await db.transaction_groups.bulkDelete(toDelete.map((g) => g.id))
        await db.transaction_groups.bulkPut(merged)
      }
    } else if (tableName === 'transactions') {
      if (emptyRemote) {
        await db.transactions.clear()
      } else {
        const local = await db.transactions.toArray()
        const remoteTx = (rows as Record<string, unknown>[]).map(toTransaction)
        const merged = mergeByUpdatedAt(local, remoteTx, key) as Transaction[]
        const toDelete = local.filter((t) => !remoteIds.has(normId(t.id)))
        if (toDelete.length) await db.transactions.bulkDelete(toDelete.map((t) => t.id))
        await db.transactions.bulkPut(merged)
      }
    } else if (tableName === 'budgets') {
      if (emptyRemote) {
        await db.budgets.clear()
      } else {
        const local = await db.budgets.toArray()
        const merged = mergeByUpdatedAt(local, rows as Budget[], key) as Budget[]
        const toDelete = local.filter((b) => !remoteIds.has(normId(b.id)))
        if (toDelete.length) await db.budgets.bulkDelete(toDelete.map((b) => b.id))
        await db.budgets.bulkPut(merged)
      }
    }
  }
  setLastSync(new Date().toISOString())
}

export async function syncAll(): Promise<void> {
  if (!isSupabaseConfigured) return
  await pullChanges()
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
