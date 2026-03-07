/**
 * Create and update transaction groups and their child transactions.
 * All group writes run inside a single Dexie rw transaction.
 */

import { addDays, addWeeks, addMonths, addYears } from 'date-fns'
import { db } from '../../db'
import type { Transaction, TransactionGroup } from '../../db'
import type { RecurrencePeriod } from '../../db'
import { RECURRING_HORIZON_MONTHS } from '../../lib/constants'
import { generateId, toISODate } from '../../lib/utils'
import { pushChanges } from '../../sync/syncEngine'
import { scheduleRecurringTransactions } from '../../sync/recurringScheduler'
import toast from 'react-hot-toast'

export type PaymentMode = 'single' | 'recurring' | 'installments'

/** Form payload for creating a new group (from TransactionFormModal). */
export interface CreateTransactionGroupData {
  type: 'income' | 'expense' | 'transfer'
  description: string
  account_id: string
  category_id: string | null
  notes: string | null
  tags: string[]
  is_paid: boolean

  payment_mode: PaymentMode

  /** Único + Fixo: amount per occurrence (cents). Parcelado: used when "por parcela". */
  amount_cents: number

  /** Fixo */
  recurrence_period?: RecurrencePeriod | null
  start_date?: string
  recurrence_end_date?: string | null
  recurrence_end_after_occurrences?: number | null

  /** Parcelado */
  installment_mode?: 'per_parcel' | 'total'
  amount_per_installment_cents?: number
  amount_total_cents?: number
  installments_total?: number
  installment_interval?: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
}

function addByPeriod(d: Date, period: RecurrencePeriod, n: number): Date {
  switch (period) {
    case 'daily':
      return addDays(d, n)
    case 'weekly':
      return addWeeks(d, n)
    case 'biweekly':
      return addDays(d, 15 * n)
    case 'monthly':
      return addMonths(d, n)
    case 'every_2_months':
      return addMonths(d, 2 * n)
    case 'every_3_months':
      return addMonths(d, 3 * n)
    case 'every_6_months':
      return addMonths(d, 6 * n)
    case 'yearly':
      return addYears(d, n)
    default:
      return addMonths(d, n)
  }
}

function addByInstallmentInterval(
  d: Date,
  interval: 'weekly' | 'biweekly' | 'monthly' | 'yearly',
  n: number
): Date {
  switch (interval) {
    case 'weekly':
      return addWeeks(d, n)
    case 'biweekly':
      return addDays(d, 15 * n)
    case 'monthly':
      return addMonths(d, n)
    case 'yearly':
      return addYears(d, n)
    default:
      return addMonths(d, n)
  }
}

export async function createTransactionGroup(
  data: CreateTransactionGroupData,
  userId: string
): Promise<void> {
  const now = new Date().toISOString()
  const name = (data.description || 'Transação').trim()

  const groupId = generateId()
  let group: TransactionGroup
  const transactions: Transaction[] = []

  if (data.payment_mode === 'single') {
    group = {
      id: groupId,
      user_id: userId,
      name,
      type: data.type,
      account_id: data.account_id,
      category_id: data.category_id ?? null,
      payment_mode: 'single',
      installments_total: null,
      amount_total: data.amount_cents,
      amount_per_installment: data.amount_cents,
      recurrence_period: null,
      recurrence_end_date: null,
      start_date: data.start_date!,
      notes: data.notes ?? null,
      tags: data.tags ?? [],
      created_at: now,
      updated_at: now,
      synced_at: null,
    }
    transactions.push({
      id: generateId(),
      group_id: groupId,
      account_id: data.account_id,
      category_id: data.category_id ?? null,
      type: data.type,
      amount: data.amount_cents,
      description: name,
      date: data.start_date!,
      paid_at: data.is_paid ? now : null,
      is_paid: data.is_paid,
      installment_number: null,
      notes: data.notes ?? null,
      tags: data.tags ?? [],
      created_at: now,
      updated_at: now,
      synced_at: null,
    })
  } else if (data.payment_mode === 'recurring') {
    const period = data.recurrence_period ?? 'monthly'
    const startDate = data.start_date!
    const endDate = data.recurrence_end_date
    const afterOccurrences = data.recurrence_end_after_occurrences
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const horizonDate = addMonths(today, RECURRING_HORIZON_MONTHS)
    const endLimit = endDate
      ? new Date(endDate + 'T23:59:59')
      : afterOccurrences != null && afterOccurrences > 0
        ? null
        : null
    const horizonOrEnd = endLimit && endLimit < horizonDate ? endLimit : horizonDate

    let d = new Date(startDate + 'T12:00:00')
    let n = 0
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    while (d <= horizonOrEnd) {
      if (endLimit && d > endLimit) break
      if (afterOccurrences != null && afterOccurrences > 0 && n >= afterOccurrences) break
      const isPaid = data.is_paid && d <= todayEnd
      transactions.push({
        id: generateId(),
        group_id: groupId,
        account_id: data.account_id,
        category_id: data.category_id ?? null,
        type: data.type,
        amount: data.amount_cents,
        description: name,
        date: toISODate(d),
        paid_at: isPaid ? now : null,
        is_paid: isPaid,
        installment_number: null,
        notes: data.notes ?? null,
        tags: data.tags ?? [],
        created_at: now,
        updated_at: now,
        synced_at: null,
      })
      n++
      d = addByPeriod(new Date(startDate + 'T12:00:00'), period, n)
    }

    group = {
      id: groupId,
      user_id: userId,
      name,
      type: data.type,
      account_id: data.account_id,
      category_id: data.category_id ?? null,
      payment_mode: 'recurring',
      installments_total: null,
      amount_total: null,
      amount_per_installment: data.amount_cents,
      recurrence_period: period,
      recurrence_end_date: data.recurrence_end_date ?? null,
      start_date: startDate,
      notes: data.notes ?? null,
      tags: data.tags ?? [],
      created_at: now,
      updated_at: now,
      synced_at: null,
    }
  } else {
    // installments
    const total = Math.max(2, Math.min(360, data.installments_total ?? 2))
    const interval = data.installment_interval ?? 'monthly'
    const startDate = data.start_date!

    let amountPerInstallment: number
    let amountTotal: number
    if (data.installment_mode === 'total' && data.amount_total_cents != null) {
      amountTotal = data.amount_total_cents
      amountPerInstallment = Math.floor(amountTotal / total)
    } else {
      amountPerInstallment = data.amount_per_installment_cents ?? data.amount_cents ?? 0
      amountTotal = amountPerInstallment * total
    }
    const remainder = amountTotal - amountPerInstallment * total

    for (let i = 0; i < total; i++) {
      const date = addByInstallmentInterval(
        new Date(startDate + 'T12:00:00'),
        interval,
        i
      )
      const parcelCents = amountPerInstallment + (i < remainder ? 1 : 0)
      transactions.push({
        id: generateId(),
        group_id: groupId,
        account_id: data.account_id,
        category_id: data.category_id ?? null,
        type: data.type,
        amount: parcelCents,
        description: `${name} ${i + 1}/${total}`,
        date: toISODate(date),
        paid_at: null,
        is_paid: false,
        installment_number: i + 1,
        notes: data.notes ?? null,
        tags: data.tags ?? [],
        created_at: now,
        updated_at: now,
        synced_at: null,
      })
    }

    group = {
      id: groupId,
      user_id: userId,
      name,
      type: data.type,
      account_id: data.account_id,
      category_id: data.category_id ?? null,
      payment_mode: 'installments',
      installments_total: total,
      amount_total: amountTotal,
      amount_per_installment: amountPerInstallment,
      recurrence_period: null,
      recurrence_end_date: null,
      start_date: startDate,
      notes: data.notes ?? null,
      tags: data.tags ?? [],
      created_at: now,
      updated_at: now,
      synced_at: null,
    }
  }

  const syncEntries = [
    {
      id: generateId(),
      table_name: 'transaction_groups' as const,
      record_id: groupId,
      operation: 'insert' as const,
      payload: JSON.stringify(group),
      created_at: now,
      attempts: 0,
    },
    ...transactions.map((t) => ({
      id: generateId(),
      table_name: 'transactions' as const,
      record_id: t.id,
      operation: 'insert' as const,
      payload: JSON.stringify(t),
      created_at: now,
      attempts: 0,
    })),
  ]

  await db.transaction(
    'rw',
    [db.transaction_groups, db.transactions, db.sync_queue],
    async () => {
      await db.transaction_groups.add(group)
      await db.transactions.bulkAdd(transactions)
      await db.sync_queue.bulkAdd(syncEntries)
    }
  )

  pushChanges().catch(() => {})
  if (data.payment_mode === 'recurring') {
    await scheduleRecurringTransactions(groupId)
  }
  toast.success(`${transactions.length} lançamento(s) criado(s)`)
}

/** Edit scope when editing a transaction that belongs to a group. */
export type EditGroupScope = 'this_only' | 'this_and_future' | 'all'

export async function updateTransactionInGroup(
  transactionId: string,
  updates: Partial<Pick<Transaction, 'type' | 'amount' | 'description' | 'date' | 'account_id' | 'category_id' | 'is_paid' | 'notes' | 'tags'>>,
  scope: EditGroupScope,
  _userId: string
): Promise<void> {
  const now = new Date().toISOString()
  const tx = await db.transactions.get(transactionId)
  if (!tx || !tx.group_id) throw new Error('Transação não encontrada ou não pertence a um grupo')
  const groupId = tx.group_id

  const group = await db.transaction_groups.get(groupId)
  if (!group) throw new Error('Grupo não encontrado')

  const allInGroup = await db.transactions.where('group_id').equals(groupId).sortBy('date')

  let toUpdate: Transaction[]
  if (scope === 'this_only') {
    const updated: Transaction = {
      ...tx,
      ...updates,
      description: updates.description ?? tx.description,
      paid_at: updates.is_paid !== undefined ? (updates.is_paid ? now : null) : tx.paid_at,
      updated_at: now,
    }
    if (updated.description && !updated.description.endsWith(' *')) {
      updated.description = updated.description + ' *'
    }
    toUpdate = [updated]
  } else if (scope === 'this_and_future') {
    const currentNum = tx.installment_number ?? 0
    const { date: _d, description: _desc, ...restUpdates } = updates
    const multiUpdates = restUpdates as typeof updates
    toUpdate = allInGroup
      .filter((t) => (t.installment_number ?? 0) >= currentNum)
      .map((t) => {
        const isCurrent = t.id === transactionId
        const applied = isCurrent ? updates : multiUpdates
        return {
          ...t,
          ...applied,
          paid_at: applied.is_paid !== undefined ? (applied.is_paid ? now : null) : t.paid_at,
          updated_at: now,
        }
      })
  } else {
    const { date: _d, description: _desc, ...restUpdates } = updates
    const multiUpdates = restUpdates as typeof updates
    toUpdate = allInGroup.map((t) => {
      const isCurrent = t.id === transactionId
      const applied = isCurrent ? updates : multiUpdates
      return {
        ...t,
        ...applied,
        paid_at: applied.is_paid !== undefined ? (applied.is_paid ? now : null) : t.paid_at,
        updated_at: now,
      }
    })
  }

  await db.transaction('rw', [db.transactions, db.transaction_groups, db.sync_queue], async () => {
    for (const u of toUpdate) {
      await db.transactions.put(u)
      await db.sync_queue.add({
        id: generateId(),
        table_name: 'transactions',
        record_id: u.id,
        operation: 'update',
        payload: JSON.stringify(u),
        created_at: now,
        attempts: 0,
      })
    }
    if (scope !== 'this_only') {
      await db.transaction_groups.update(groupId, { updated_at: now })
      await db.sync_queue.add({
        id: generateId(),
        table_name: 'transaction_groups',
        record_id: groupId,
        operation: 'update',
        payload: JSON.stringify({ ...group, updated_at: now }),
        created_at: now,
        attempts: 0,
      })
    }
  })

  if (scope !== 'this_only' && group.payment_mode === 'recurring') {
    const todayStr = toISODate(new Date())
    const futureUnpaid = await db.transactions
      .where('group_id')
      .equals(groupId)
      .filter((t) => !t.is_paid && t.date >= todayStr)
      .toArray()
    if (futureUnpaid.length > 0) {
      await db.transaction('rw', [db.transactions, db.sync_queue], async () => {
        for (const t of futureUnpaid) {
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
        }
      })
    }
    await scheduleRecurringTransactions(groupId)
  }

  pushChanges().catch(() => {})
  toast.success('Lançamento(s) atualizado(s)')
}

/** End a recurring group: set recurrence_end_date and remove future unpaid transactions. */
export async function endRecurringGroup(
  groupId: string,
  endDateStr?: string
): Promise<void> {
  const now = new Date().toISOString()
  const group = await db.transaction_groups.get(groupId)
  if (!group || group.payment_mode !== 'recurring') throw new Error('Grupo recorrente não encontrado')
  const todayStr = endDateStr ?? toISODate(new Date())

  const futureUnpaid = await db.transactions
    .where('group_id')
    .equals(groupId)
    .filter((t) => !t.is_paid && t.date > todayStr)
    .toArray()

  await db.transaction('rw', [db.transaction_groups, db.transactions, db.sync_queue], async () => {
    await db.transaction_groups.update(groupId, {
      recurrence_end_date: todayStr,
      updated_at: now,
    })
    await db.sync_queue.add({
      id: generateId(),
      table_name: 'transaction_groups',
      record_id: groupId,
      operation: 'update',
      payload: JSON.stringify({ ...group, recurrence_end_date: todayStr, updated_at: now }),
      created_at: now,
      attempts: 0,
    })
    for (const t of futureUnpaid) {
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
    }
  })

  pushChanges().catch(() => {})
  toast.success(`Recorrência encerrada. ${futureUnpaid.length} lançamento(s) futuro(s) removido(s).`)
}
