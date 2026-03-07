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

/** Computed balance = account.balance (initial) + delta from paid transactions only. */
export function useComputedAccountBalance(accountId: string): number {
  const balance = useLiveQuery(
    async () => {
      const account = await db.accounts.get(accountId)
      if (!account) return 0
      const paidTransactions = await db.transactions
        .where('account_id')
        .equals(accountId)
        .filter((t) => t.is_paid === true)
        .toArray()
      const delta = paidTransactions.reduce((sum, t) => {
        if (t.type === 'income') return sum + t.amount
        if (t.type === 'expense') return sum - t.amount
        return sum
      }, 0)
      return account.balance + delta
    },
    [accountId]
  )
  return balance ?? 0
}

/** Map of account id -> computed balance (initial + paid tx delta) for all active accounts. */
export function useAllComputedBalances(): Map<string, number> {
  const balances = useLiveQuery(
    async () => {
      const [accounts, transactions] = await Promise.all([
        db.accounts.filter((a) => a.is_active).toArray(),
        db.transactions.filter((t) => t.is_paid).toArray(),
      ])
      const map = new Map<string, number>()
      for (const acc of accounts) {
        map.set(acc.id, acc.balance)
      }
      for (const tx of transactions) {
        const current = map.get(tx.account_id) ?? 0
        if (tx.type === 'income') map.set(tx.account_id, current + tx.amount)
        else if (tx.type === 'expense') map.set(tx.account_id, current - tx.amount)
      }
      return map
    },
    []
  )
  return balances ?? new Map()
}

/** Total computed balance across all active accounts (initial + paid tx deltas). */
export function useTotalComputedBalance(): number {
  const balances = useAllComputedBalances()
  let total = 0
  for (const v of balances.values()) total += v
  return total
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

/** Total balance (paid only) across all active accounts. @deprecated Prefer useTotalComputedBalance */
export function useTotalBalance(): number {
  return useTotalComputedBalance()
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
