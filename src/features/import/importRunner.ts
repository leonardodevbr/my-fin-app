/**
 * Executes the import: creates categories, transaction_groups, transactions, sync_queue.
 * All writes inside a single Dexie transaction for atomicity.
 */

import { addMonths } from 'date-fns'
import { db } from '../../db'
import type { Category, Transaction, TransactionGroup } from '../../db'
import { generateId, toISODate } from '../../lib/utils'
import { pushChanges } from '../../sync/syncEngine'
import type { ParsedStandaloneTransaction, ParsedTransactionGroup } from './importParser'

export interface CategoryMapping {
  /** hint from spreadsheet (bloco/categoria) -> existing id or new category name */
  [hint: string]: { type: 'existing'; category_id: string } | { type: 'new'; name: string }
}

export interface AccountMapping {
  /** spreadsheet account_name -> Dexie account id */
  [accountName: string]: string
}

export interface ImportRunOptions {
  userId: string
  defaultAccountId: string
  categoryMapping: CategoryMapping
  accountMapping: AccountMapping
  /** New categories to create (name -> type) when user chose "Criar nova categoria" */
  newCategories: { name: string; type: 'income' | 'expense' }[]
  transactions: ParsedStandaloneTransaction[]
  groups: ParsedTransactionGroup[]
  onProgress?: (processed: number, total: number) => void
}

export interface ImportRunResult {
  transactionsCreated: number
  groupsCreated: number
  installmentsCreated: number
  categoriesCreated: number
}

const DEFAULT_COLORS = ['#dc2626', '#ea580c', '#ca8a04', '#2563eb', '#7c3aed', '#0d9488', '#64748b']
const DEFAULT_ICON = 'circle'

function resolveCategoryId(
  hint: string | null,
  mapping: CategoryMapping,
  newCategoryIds: Map<string, string>
): string | null {
  if (!hint || !hint.trim()) return null
  const m = mapping[hint.trim()]
  if (!m) return null
  if (m.type === 'existing') return m.category_id
  return newCategoryIds.get(m.name) ?? null
}

function resolveAccountId(
  accountName: string | null,
  accountMapping: AccountMapping,
  defaultAccountId: string
): string {
  if (!accountName || !accountName.trim()) return defaultAccountId
  return accountMapping[accountName.trim()] ?? defaultAccountId
}

/** Generate child transactions for a group (single, installments, or recurring 12 months). Group amounts are in cents. */
function createGroupTransactions(
  group: TransactionGroup,
  now: string
): Transaction[] {
  const records: Transaction[] = []
  const startDate = group.start_date
  const name = group.name
  const type = group.type
  const account_id = group.account_id
  const category_id = group.category_id

  if (group.payment_mode === 'single') {
    const amountCents = group.amount_per_installment ?? group.amount_total ?? 0
    records.push({
      id: generateId(),
      group_id: group.id,
      account_id,
      category_id,
      type,
      amount: amountCents,
      description: name,
      date: startDate,
      paid_at: null,
      is_paid: false,
      installment_number: null,
      notes: null,
      tags: [],
      created_at: now,
      updated_at: now,
      synced_at: null,
    })
    return records
  }

  if (group.payment_mode === 'installments' && group.installments_total != null) {
    const total = group.installments_total
    const perInstallment = group.amount_per_installment ?? Math.floor((group.amount_total ?? 0) / total)
    const amountTotal = group.amount_total ?? perInstallment * total
    const remainder = amountTotal - perInstallment * total
    for (let i = 0; i < total; i++) {
      const date = addMonths(new Date(startDate + 'T12:00:00'), i)
      const parcelCents = perInstallment + (i < remainder ? 1 : 0)
      records.push({
        id: generateId(),
        group_id: group.id,
        account_id,
        category_id,
        type,
        amount: parcelCents,
        description: `${name} ${i + 1}/${total}`,
        date: toISODate(date),
        paid_at: null,
        is_paid: false,
        installment_number: i + 1,
        notes: null,
        tags: [],
        created_at: now,
        updated_at: now,
        synced_at: null,
      })
    }
    return records
  }

  if (group.payment_mode === 'recurring' && (group.recurrence_period === 'monthly' || group.recurrence_period === 'weekly' || group.recurrence_period === 'yearly')) {
    const amountCents = group.amount_per_installment ?? group.amount_total ?? 0
    const end = addMonths(new Date(startDate + 'T12:00:00'), 12)
    let d = new Date(startDate + 'T12:00:00')
    let n = 0
    while (d <= end) {
      records.push({
        id: generateId(),
        group_id: group.id,
        account_id,
        category_id,
        type,
        amount: amountCents,
        description: name,
        date: toISODate(d),
        paid_at: null,
        is_paid: false,
        installment_number: null,
        notes: null,
        tags: [],
        created_at: now,
        updated_at: now,
        synced_at: null,
      })
      n++
      d = addMonths(new Date(startDate + 'T12:00:00'), n)
    }
    return records
  }

  return records
}

export async function runImport(options: ImportRunOptions): Promise<ImportRunResult> {
  // NOTE: All monetary values from spreadsheet arrive as BRL reais (e.g. 650.00)
  // and must be converted to integer cents (× 100) before saving to Dexie/Supabase.
  const {
    userId,
    defaultAccountId,
    categoryMapping,
    accountMapping,
    newCategories,
    transactions,
    groups,
    onProgress,
  } = options

  const now = new Date().toISOString()
  const result: ImportRunResult = {
    transactionsCreated: 0,
    groupsCreated: 0,
    installmentsCreated: 0,
    categoriesCreated: 0,
  }

  const newCategoryIds = new Map<string, string>()
  const newCats: Category[] = newCategories.map(({ name, type }, index) => {
    const id = generateId()
    newCategoryIds.set(name, id)
    return {
      id,
      name,
      type,
      color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      icon: DEFAULT_ICON,
      parent_id: null,
      created_at: now,
      updated_at: now,
      synced_at: null,
    }
  })

  const totalSteps =
    newCats.length +
    groups.length +
    groups.reduce((acc, g) => {
      const installments = g.installments_total ?? 1
      return acc + 1 + (g.payment_mode === 'single' ? 1 : installments)
    }, 0) +
    transactions.length
  let processed = 0

  await db.transaction(
    'rw',
    [db.categories, db.transaction_groups, db.transactions, db.sync_queue],
    async () => {
      for (const cat of newCats) {
        await db.categories.add(cat)
        await db.sync_queue.add({
          id: generateId(),
          table_name: 'categories',
          record_id: cat.id,
          operation: 'insert',
          payload: JSON.stringify(cat),
          created_at: now,
          attempts: 0,
        })
        result.categoriesCreated++
        processed++
        onProgress?.(processed, totalSteps)
      }

      for (const parsed of groups) {
        const category_id = resolveCategoryId(parsed.categoryHint, categoryMapping, newCategoryIds)
        const account_id = resolveAccountId(parsed.account_name, accountMapping, defaultAccountId)
        const amount_total_cents =
          parsed.amount_total != null ? Math.round(parsed.amount_total * 100) : null
        const amount_per_installment_cents =
          parsed.amount_per_installment != null ? Math.round(parsed.amount_per_installment * 100) : null
        const group: TransactionGroup = {
          id: generateId(),
          user_id: userId,
          name: parsed.name,
          type: parsed.type,
          account_id,
          category_id,
          payment_mode: parsed.payment_mode,
          installments_total: parsed.installments_total,
          amount_total: amount_total_cents,
          amount_per_installment: amount_per_installment_cents,
          recurrence_period: parsed.recurrence_period,
          recurrence_end_date: parsed.recurrence_end_date,
          start_date: parsed.start_date,
          notes: null,
          tags: [],
          created_at: now,
          updated_at: now,
          synced_at: null,
        }
        await db.transaction_groups.add(group)
        await db.sync_queue.add({
          id: generateId(),
          table_name: 'transaction_groups',
          record_id: group.id,
          operation: 'insert',
          payload: JSON.stringify(group),
          created_at: now,
          attempts: 0,
        })
        result.groupsCreated++
        processed++
        onProgress?.(processed, totalSteps)

        const childTxs = createGroupTransactions(group, now)
        result.installmentsCreated += childTxs.length
        await db.transactions.bulkAdd(childTxs)
        for (const r of childTxs) {
          await db.sync_queue.add({
            id: generateId(),
            table_name: 'transactions',
            record_id: r.id,
            operation: 'insert',
            payload: JSON.stringify(r),
            created_at: now,
            attempts: 0,
          })
        }
        processed += childTxs.length
        onProgress?.(processed, totalSteps)
      }

      for (const tx of transactions) {
        const category_id = resolveCategoryId(tx.categoryHint, categoryMapping, newCategoryIds)
        const account_id = resolveAccountId(tx.account_name, accountMapping, defaultAccountId)
        const record: Transaction = {
          id: generateId(),
          group_id: null,
          account_id,
          category_id,
          type: tx.type,
          amount: Math.round(tx.amount * 100),
          description: tx.description,
          date: tx.date,
          paid_at: tx.is_paid ? now : null,
          is_paid: tx.is_paid,
          installment_number: null,
          notes: tx.notes ?? null,
          tags: [],
          created_at: now,
          updated_at: now,
          synced_at: null,
        }
        await db.transactions.add(record)
        await db.sync_queue.add({
          id: generateId(),
          table_name: 'transactions',
          record_id: record.id,
          operation: 'insert',
          payload: JSON.stringify(record),
          created_at: now,
          attempts: 0,
        })
        result.transactionsCreated++
        processed++
        onProgress?.(processed, totalSteps)
      }
    }
  )

  pushChanges().catch(() => {})
  return result
}
