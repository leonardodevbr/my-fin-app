import { useCallback } from 'react'
import { addMonths } from 'date-fns'
import { db } from '../../db'
import type { Transaction, RecurrenceType } from '../../db'
import { generateId, toISODate } from '../../lib/utils'
import { pushChanges } from '../../sync/syncEngine'
import toast from 'react-hot-toast'

export interface TransactionFormValues {
  type: 'income' | 'expense' | 'transfer'
  amount: string
  description: string
  date: string
  account_id: string
  category_id: string
  is_paid: boolean
  recurrence: RecurrenceType
  installments_total: number
  notes: string
  tags: string[]
}

const defaultValues: TransactionFormValues = {
  type: 'expense',
  amount: '',
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
    amount: String(transaction.amount),
    description: transaction.description,
    date: transaction.date,
    account_id: transaction.account_id,
    category_id: transaction.category_id ?? '',
    is_paid: transaction.is_paid,
    recurrence: transaction.recurrence,
    installments_total: transaction.installments_total ?? 1,
    notes: transaction.notes ?? '',
    tags: transaction.tags ?? [],
  }
}

export async function saveTransaction(
  values: TransactionFormValues,
  existingId?: string
): Promise<void> {
  const now = new Date().toISOString()
  const amount = parseFloat(values.amount) || 0
  const installments = Math.max(1, Math.min(99, Math.round(values.installments_total) || 1))

  if (existingId) {
    const existing = await db.transactions.get(existingId)
    if (!existing) throw new Error('Transação não encontrada')
    const updated: Transaction = {
      ...existing,
      type: values.type,
      amount,
      description: values.description.trim(),
      date: values.date,
      account_id: values.account_id,
      category_id: values.category_id || null,
      is_paid: values.is_paid,
      recurrence: values.recurrence,
      installments_total: installments > 1 ? installments : null,
      installments_current: installments > 1 ? existing.installments_current : null,
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
    pushChanges().catch(() => {})
    return
  }

  const groupId = generateId()
  const perAmount = amount / installments
  const records: Transaction[] = []

  for (let i = 0; i < installments; i++) {
    const date = addMonths(new Date(values.date + 'T12:00:00'), i)
    records.push({
      id: generateId(),
      account_id: values.account_id,
      category_id: values.category_id || null,
      type: values.type,
      amount: Math.round(perAmount * 100) / 100,
      description: installments > 1 ? `${values.description.trim()} (${i + 1}/${installments})` : values.description.trim(),
      date: toISODate(date),
      notes: values.notes.trim() || null,
      recurrence: values.recurrence,
      recurrence_end_date: null,
      installments_total: installments > 1 ? installments : null,
      installments_current: installments > 1 ? i + 1 : null,
      installment_group_id: installments > 1 ? groupId : null,
      is_paid: values.is_paid,
      tags: values.tags,
      created_at: now,
      updated_at: now,
      synced_at: null,
    })
  }

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

export function useTransactionForm(onSaved: () => void) {
  const handleSubmit = useCallback(
    async (values: TransactionFormValues, existingId?: string) => {
      try {
        await saveTransaction(values, existingId)
        toast.success('Transação salva')
        onSaved()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
        throw e
      }
    },
    [onSaved]
  )
  return { handleSubmit }
}
