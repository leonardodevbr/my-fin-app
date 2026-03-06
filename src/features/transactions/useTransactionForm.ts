import { useCallback } from 'react'
import { addMonths, addDays, addWeeks, addYears } from 'date-fns'
import { db } from '../../db'
import type { Transaction, TransactionGroup, RecurrencePeriod } from '../../db'
import { generateId, toISODate } from '../../lib/utils'
import { pushChanges } from '../../sync/syncEngine'
import toast from 'react-hot-toast'

/** Form uses recurrence 'none' = single; 'daily'|'weekly'|'monthly'|'yearly' = recurring; installments_total > 1 = installments. */
export interface TransactionFormValues {
  type: 'income' | 'expense' | 'transfer'
  amount: number
  description: string
  date: string
  account_id: string
  category_id: string
  is_paid: boolean
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  installments_total: number
  notes: string
  tags: string[]
}

const defaultValues: TransactionFormValues = {
  type: 'expense',
  amount: 0,
  description: '',
  date: toISODate(new Date()),
  account_id: '',
  category_id: '',
  is_paid: true,
  recurrence: 'none',
  installments_total: 1,
  notes: '',
  tags: [],
}

export function getDefaultValues(transaction?: Transaction | null): TransactionFormValues {
  if (!transaction) return { ...defaultValues }
  return {
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    date: transaction.date,
    account_id: transaction.account_id,
    category_id: transaction.category_id ?? '',
    is_paid: transaction.is_paid,
    recurrence: 'none',
    installments_total: 1,
    notes: transaction.notes ?? '',
    tags: transaction.tags ?? [],
  }
}

function addByPeriod(d: Date, period: RecurrencePeriod, n: number): Date {
  switch (period) {
    case 'daily':
      return addDays(d, n)
    case 'weekly':
      return addWeeks(d, n)
    case 'monthly':
      return addMonths(d, n)
    case 'yearly':
      return addYears(d, n)
    default:
      return addMonths(d, n)
  }
}

export async function saveTransaction(
  values: TransactionFormValues,
  existingId?: string,
  userId?: string
): Promise<void> {
  const now = new Date().toISOString()
  const amountCents = Math.round(values.amount) || 0
  const installments = Math.max(1, Math.min(99, Math.round(values.installments_total) || 1))
  const isRecurring = values.recurrence !== 'none'
  const recurrencePeriod = values.recurrence === 'none' ? null : (values.recurrence as RecurrencePeriod)

  if (existingId) {
    const existing = await db.transactions.get(existingId)
    if (!existing) throw new Error('Transação não encontrada')
    const updated: Transaction = {
      ...existing,
      type: values.type,
      amount: amountCents,
      description: values.description.trim(),
      date: values.date,
      account_id: values.account_id,
      category_id: values.category_id || null,
      is_paid: values.is_paid,
      paid_at: values.is_paid ? now : null,
      notes: values.notes.trim() || null,
      tags: values.tags,
      updated_at: now,
    }
    await db.transactions.put(updated)
    await db.sync_queue.add({
      id: generateId(),
      table_name: 'transactions',
      record_id: existingId,
      operation: 'update',
      payload: JSON.stringify(updated),
      created_at: now,
      attempts: 0,
    })
    if (existing.group_id) {
      const group = await db.transaction_groups.get(existing.group_id)
      if (group) {
        await db.transaction_groups.update(existing.group_id, { updated_at: now })
        await db.sync_queue.add({
          id: generateId(),
          table_name: 'transaction_groups',
          record_id: group.id,
          operation: 'update',
          payload: JSON.stringify({ ...group, updated_at: now }),
          created_at: now,
          attempts: 0,
        })
      }
    }
    pushChanges().catch(() => {})
    return
  }

  const paymentMode: TransactionGroup['payment_mode'] =
    installments > 1 ? 'installments' : isRecurring ? 'recurring' : 'single'

  const groupId = generateId()
  const startDate = values.date
  const name = values.description.trim() || 'Transação'

  const amountTotal = amountCents * (paymentMode === 'installments' ? installments : 1)
  const amountPerInstallment =
    paymentMode === 'installments' ? Math.floor(amountTotal / installments) : amountCents
  const remainder = paymentMode === 'installments' ? amountTotal - amountPerInstallment * installments : 0

  const group: TransactionGroup = {
    id: groupId,
    user_id: userId ?? '',
    name,
    type: values.type,
    account_id: values.account_id,
    category_id: values.category_id || null,
    payment_mode: paymentMode,
    installments_total: paymentMode === 'installments' ? installments : null,
    amount_total: paymentMode === 'installments' ? amountTotal : null,
    amount_per_installment: paymentMode === 'installments' ? amountPerInstallment : null,
    recurrence_period: recurrencePeriod,
    recurrence_end_date: null,
    start_date: startDate,
    notes: values.notes.trim() || null,
    tags: values.tags,
    created_at: now,
    updated_at: now,
    synced_at: null,
  }

  const records: Transaction[] = []

  if (paymentMode === 'single') {
    records.push({
      id: generateId(),
      group_id: groupId,
      account_id: values.account_id,
      category_id: values.category_id || null,
      type: values.type,
      amount: amountCents,
      description: name,
      date: startDate,
      paid_at: values.is_paid ? now : null,
      is_paid: values.is_paid,
      installment_number: null,
      notes: values.notes.trim() || null,
      tags: values.tags,
      created_at: now,
      updated_at: now,
      synced_at: null,
    })
  } else if (paymentMode === 'installments') {
    for (let i = 0; i < installments; i++) {
      const date = addMonths(new Date(startDate + 'T12:00:00'), i)
      const parcelCents = amountPerInstallment + (i < remainder ? 1 : 0)
      records.push({
        id: generateId(),
        group_id: groupId,
        account_id: values.account_id,
        category_id: values.category_id || null,
        type: values.type,
        amount: parcelCents,
        description: `${name} ${i + 1}/${installments}`,
        date: toISODate(date),
        paid_at: null,
        is_paid: false,
        installment_number: i + 1,
        notes: values.notes.trim() || null,
        tags: values.tags,
        created_at: now,
        updated_at: now,
        synced_at: null,
      })
    }
  } else if (paymentMode === 'recurring' && recurrencePeriod) {
    const end = addMonths(new Date(startDate + 'T12:00:00'), 12)
    let d = new Date(startDate + 'T12:00:00')
    let n = 0
    while (d <= end) {
      records.push({
        id: generateId(),
        group_id: groupId,
        account_id: values.account_id,
        category_id: values.category_id || null,
        type: values.type,
        amount: amountCents,
        description: name,
        date: toISODate(d),
        paid_at: null,
        is_paid: false,
        installment_number: null,
        notes: values.notes.trim() || null,
        tags: values.tags,
        created_at: now,
        updated_at: now,
        synced_at: null,
      })
      n++
      d = addByPeriod(new Date(startDate + 'T12:00:00'), recurrencePeriod, n)
    }
  }

  await db.transaction_groups.add(group)
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'transaction_groups',
    record_id: groupId,
    operation: 'insert',
    payload: JSON.stringify(group),
    created_at: now,
    attempts: 0,
  })
  await db.transactions.bulkAdd(records)
  for (const r of records) {
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
  pushChanges().catch(() => {})
}

export function useTransactionForm(onSaved: () => void, userId?: string) {
  const handleSubmit = useCallback(
    async (values: TransactionFormValues, existingId?: string) => {
      try {
        await saveTransaction(values, existingId, userId)
        toast.success('Transação salva')
        onSaved()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
        throw e
      }
    },
    [onSaved, userId]
  )
  return { handleSubmit }
}
