/**
 * Domain types and Dexie schema for My Fin App
 *
 * Core concept:
 * - A "transaction" is a single financial event on a specific date.
 * - A "transaction_group" is the parent that defines recurrence or installment rules.
 * - Individual transactions belong to a group and can be edited independently.
 */

export type AccountType = 'checking' | 'savings' | 'credit' | 'cash' | 'investment'
export type CategoryType = 'income' | 'expense'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type PaymentMode = 'single' | 'installments' | 'recurring'
export type RecurrencePeriod = 'daily' | 'weekly' | 'monthly' | 'yearly'
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

/** Parent for installments/recurring/single. Defines rules; individual transactions reference group_id. */
export interface TransactionGroup {
  id: string
  user_id: string
  name: string
  type: TransactionType
  account_id: string
  category_id: string | null
  payment_mode: PaymentMode

  /** For installments */
  installments_total: number | null
  amount_total: number | null
  amount_per_installment: number | null

  /** For recurring */
  recurrence_period: RecurrencePeriod | null
  recurrence_end_date: string | null

  start_date: string
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
  synced_at: string | null
}

/** Single financial event on a date. Belongs to a group (or standalone when group_id is null). */
export interface Transaction {
  id: string
  group_id: string | null
  account_id: string
  category_id: string | null
  type: TransactionType
  /** Valor em centavos (inteiro). Ex: R$ 5,25 = 525. Actual amount for this installment/occurrence. */
  amount: number
  description: string
  date: string
  /** ISO datetime when marked as paid; null = unpaid */
  paid_at: string | null
  is_paid: boolean
  installment_number: number | null
  notes: string | null
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
export const DB_VERSION = 2

export const SCHEMA = {
  accounts: 'id, name, type, balance, color, icon, currency, is_active, created_at, updated_at, synced_at',
  categories: 'id, name, type, color, icon, parent_id, created_at, updated_at, synced_at',
  transaction_groups:
    'id, user_id, name, type, account_id, category_id, payment_mode, installments_total, amount_total, amount_per_installment, recurrence_period, recurrence_end_date, start_date, notes, tags, created_at, updated_at, synced_at',
  transactions:
    'id, group_id, account_id, category_id, type, amount, description, date, paid_at, is_paid, installment_number, notes, tags, created_at, updated_at, synced_at',
  budgets: 'id, category_id, amount, month, created_at, updated_at, synced_at',
  sync_queue: 'id, table_name, record_id, operation, payload, created_at, attempts',
}
