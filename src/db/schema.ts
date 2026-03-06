/**
 * Domain types and Dexie schema for My Fin App
 */

export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment'
export type CategoryType = 'income' | 'expense'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type SyncOperation = 'insert' | 'update' | 'delete'

export interface Account {
  id: string
  name: string
  type: AccountType
  /** Saldo em centavos (inteiro). Ex: R$ 10,50 = 1050 */
  balance: number
  color: string
  icon: string
  currency: string
  is_active: boolean
  created_at: string
  updated_at: string
  synced_at: string | null
}

export interface Category {
  id: string
  name: string
  type: CategoryType
  color: string
  icon: string
  parent_id: string | null
  created_at: string
  updated_at: string
  synced_at: string | null
}

export interface Transaction {
  id: string
  account_id: string
  category_id: string | null
  type: TransactionType
  /** Valor em centavos (inteiro). Ex: R$ 5,25 = 525 */
  amount: number
  description: string
  date: string
  notes: string | null
  recurrence: RecurrenceType
  recurrence_end_date: string | null
  installments_total: number | null
  installments_current: number | null
  installment_group_id: string | null
  is_paid: boolean
  tags: string[]
  created_at: string
  updated_at: string
  synced_at: string | null
}

export interface Budget {
  id: string
  category_id: string
  /** Limite em centavos (inteiro). Ex: R$ 1.000,00 = 100000 */
  amount: number
  month: string
  created_at: string
  updated_at: string
  synced_at: string | null
}

export interface SyncQueueItem {
  id: string
  table_name: string
  record_id: string
  operation: SyncOperation
  payload: string
  created_at: string
  attempts: number
}

export const DB_NAME = 'MyFinAppDB'
export const DB_VERSION = 1

export const SCHEMA = {
  accounts: 'id, name, type, balance, color, icon, currency, is_active, created_at, updated_at, synced_at',
  categories: 'id, name, type, color, icon, parent_id, created_at, updated_at, synced_at',
  transactions: 'id, account_id, category_id, type, amount, description, date, notes, recurrence, recurrence_end_date, installments_total, installments_current, installment_group_id, is_paid, tags, created_at, updated_at, synced_at',
  budgets: 'id, category_id, amount, month, created_at, updated_at, synced_at',
  sync_queue: 'id, table_name, record_id, operation, payload, created_at, attempts',
}
