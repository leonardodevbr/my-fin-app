import Dexie, { type Table } from 'dexie'
import {
  DB_NAME,
  DB_VERSION,
  SCHEMA,
  type Account,
  type Budget,
  type Category,
  type SyncQueueItem,
  type Transaction,
} from './schema'

export class FinAppDB extends Dexie {
  accounts!: Table<Account, string>
  categories!: Table<Category, string>
  transactions!: Table<Transaction, string>
  budgets!: Table<Budget, string>
  sync_queue!: Table<SyncQueueItem, string>

  constructor() {
    super(DB_NAME)
    this.version(DB_VERSION).stores({
      accounts: SCHEMA.accounts,
      categories: SCHEMA.categories,
      transactions: SCHEMA.transactions,
      budgets: SCHEMA.budgets,
      sync_queue: SCHEMA.sync_queue,
    })
  }
}

export const db = new FinAppDB()
export type { Account, Budget, Category, SyncQueueItem, Transaction } from './schema'
