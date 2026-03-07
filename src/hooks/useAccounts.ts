import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Account } from '../db'
import { generateId, toISODate } from '../lib/utils'

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

export function useAccount(id: string | null): Account | undefined {
  return useLiveQuery<Account | undefined>(
    async () => (id ? await db.accounts.get(id) : undefined),
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

/** Computed balance from transactions: paid only (Saldo atual) and all (Saldo previsto). */
export function useAccountBalance(accountId: string | null): {
  balancePaid: number
  balanceProjected: number
} {
  const txs = useLiveQuery(
    async () => {
      if (!accountId) return []
      return db.transactions.where('account_id').equals(accountId).toArray()
    },
    [accountId]
  )
  const list = txs ?? []
  const balancePaid = list
    .filter((t) => t.is_paid)
    .reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)
  const balanceProjected = list.reduce(
    (s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0),
    0
  )
  return { balancePaid, balanceProjected }
}

/** Total balance (paid only) across all active accounts. */
export function useTotalBalance(): number {
  const accounts = useLiveQuery(() => db.accounts.filter((a) => a.is_active).toArray(), [])
  const txs = useLiveQuery(() => db.transactions.toArray(), [])
  const list = accounts ?? []
  const transactions = txs ?? []
  return list.reduce((total, acc) => {
    const paid = transactions
      .filter((t) => t.account_id === acc.id && t.is_paid)
      .reduce((s, t) => s + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0)
    return total + paid
  }, 0)
}

/** Create "Saldo inicial" transaction when opening an account with initial balance. */
export async function createInitialBalanceTransaction(
  accountId: string,
  amountCents: number
): Promise<void> {
  if (amountCents === 0) return
  const { addTransaction } = await import('./useTransactions')
  const now = new Date().toISOString()
  await addTransaction({
    group_id: null,
    account_id: accountId,
    category_id: null,
    type: 'income',
    amount: amountCents,
    description: 'Saldo inicial',
    date: toISODate(new Date()),
    paid_at: now,
    is_paid: true,
    installment_number: null,
    notes: null,
    tags: [],
  })
}
