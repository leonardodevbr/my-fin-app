import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Account } from '../db'
import { generateId } from '../lib/utils'

const defaultAccount: Omit<Account, 'id' | 'created_at' | 'updated_at' | 'synced_at'> = {
  name: '',
  type: 'checking',
  balance: 0,
  color: '#10b981',
  icon: 'wallet',
  currency: 'BRL',
  is_active: true,
}

export function useAccounts(activeOnly = true) {
  const list = useLiveQuery(
    async () => {
      const all = await db.accounts.orderBy('name').toArray()
      if (activeOnly) return all.filter((a) => a.is_active)
      return all
    },
    [activeOnly]
  )
  return list ?? []
}

export function useAccountsWithLoading(activeOnly = true): {
  accounts: Account[]
  isLoading: boolean
} {
  const list = useLiveQuery(
    async () => {
      const all = await db.accounts.orderBy('name').toArray()
      if (activeOnly) return all.filter((a) => a.is_active)
      return all
    },
    [activeOnly]
  )
  return { accounts: list ?? [], isLoading: list === undefined }
}

export function useAccount(id: string | null) {
  return useLiveQuery(
    () => (id ? db.accounts.get(id) : Promise.resolve(undefined)),
    [id]
  )
}

export async function addAccount(
  data: Partial<typeof defaultAccount> & Pick<Account, 'name' | 'type'>
): Promise<string> {
  const id = generateId()
  const now = new Date().toISOString()
  const account: Account = {
    ...defaultAccount,
    ...data,
    id,
    created_at: now,
    updated_at: now,
    synced_at: null,
  }
  await db.accounts.add(account)
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'accounts',
    record_id: id,
    operation: 'insert',
    payload: JSON.stringify(account),
    created_at: now,
    attempts: 0,
  })
  return id
}

export async function updateAccount(
  id: string,
  data: Partial<Omit<Account, 'id' | 'created_at'>>
): Promise<void> {
  const existing = await db.accounts.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  const updated = { ...existing, ...data, updated_at: now }
  await db.accounts.put(updated)
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'accounts',
    record_id: id,
    operation: 'update',
    payload: JSON.stringify(updated),
    created_at: now,
    attempts: 0,
  })
}

export async function deleteAccount(id: string): Promise<void> {
  await db.accounts.delete(id)
  const now = new Date().toISOString()
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'accounts',
    record_id: id,
    operation: 'delete',
    payload: JSON.stringify({ id }),
    created_at: now,
    attempts: 0,
  })
}
