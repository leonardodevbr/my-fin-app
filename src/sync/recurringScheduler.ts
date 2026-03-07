/**
 * Lazy/on-demand generation of recurring transactions.
 * Only generates up to RECURRING_HORIZON_MONTHS ahead; runs on startup, focus, after pull, and when creating a recurring group.
 */

import { addDays, addWeeks, addMonths, addYears } from 'date-fns'
import { db } from '../db'
import type { Transaction, TransactionGroup } from '../db'
import type { RecurrencePeriod } from '../db'
import { RECURRING_HORIZON_MONTHS } from '../lib/constants'
import { generateId, toISODate } from '../lib/utils'
import { pushChanges } from './syncEngine'

/** Add one period to a date string. Handles month-end (e.g. Jan 31 → Feb 28). */
export function addPeriod(dateStr: string, period: RecurrencePeriod): string {
  const d = new Date(dateStr + 'T12:00:00')
  switch (period) {
    case 'daily':
      return toISODate(addDays(d, 1))
    case 'weekly':
      return toISODate(addWeeks(d, 1))
    case 'biweekly':
      return toISODate(addDays(d, 15))
    case 'monthly':
      return toISODate(addMonths(d, 1))
    case 'every_2_months':
      return toISODate(addMonths(d, 2))
    case 'every_3_months':
      return toISODate(addMonths(d, 3))
    case 'every_6_months':
      return toISODate(addMonths(d, 6))
    case 'yearly':
      return toISODate(addYears(d, 1))
    default:
      return toISODate(addMonths(d, 1))
  }
}

/**
 * Generate recurring transactions up to horizon (or end_date) for active recurring groups.
 * If groupId is provided, only process that group.
 */
export async function scheduleRecurringTransactions(groupId?: string): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toISODate(today)
  const horizonDate = addMonths(today, RECURRING_HORIZON_MONTHS)

  let groups: TransactionGroup[]
  if (groupId) {
    const g = await db.transaction_groups.get(groupId)
    groups = g && g.payment_mode === 'recurring' ? [g] : []
  } else {
    groups = await db.transaction_groups
      .where('payment_mode')
      .equals('recurring')
      .filter(
        (g) =>
          g.recurrence_end_date == null ||
          g.recurrence_end_date >= todayStr
      )
      .toArray()
  }

  const now = new Date().toISOString()

  for (const group of groups) {
    const period = group.recurrence_period
    if (!period) continue

    const endDate = group.recurrence_end_date
      ? new Date(group.recurrence_end_date + 'T23:59:59')
      : null

    let lastTx: Transaction | undefined
    try {
      lastTx = await db.transactions
        .where('[group_id+date]')
        .between([group.id, '0000-00-00'], [group.id, '9999-12-31'])
        .last()
    } catch {
      lastTx = await db.transactions
        .where('group_id')
        .equals(group.id)
        .sortBy('date')
        .then((arr) => arr[arr.length - 1])
    }

    let nextDateStr = lastTx
      ? addPeriod(lastTx.date, period)
      : group.start_date

    const toAdd: Transaction[] = []
    let nextDate = new Date(nextDateStr + 'T12:00:00')

    while (nextDate <= horizonDate) {
      const nextStr = toISODate(nextDate)
      if (endDate && nextDate > endDate) break

      toAdd.push({
        id: generateId(),
        group_id: group.id,
        account_id: group.account_id,
        category_id: group.category_id,
        type: group.type,
        amount: group.amount_per_installment ?? group.amount_total ?? 0,
        description: group.name,
        date: nextStr,
        paid_at: null,
        is_paid: false,
        installment_number: null,
        notes: group.notes,
        tags: group.tags ?? [],
        created_at: now,
        updated_at: now,
        synced_at: null,
      })
      nextDateStr = addPeriod(nextStr, period)
      nextDate = new Date(nextDateStr + 'T12:00:00')
    }

    if (toAdd.length > 0) {
      await db.transaction('rw', [db.transactions, db.sync_queue], async () => {
        await db.transactions.bulkAdd(toAdd)
        for (const t of toAdd) {
          await db.sync_queue.add({
            id: generateId(),
            table_name: 'transactions',
            record_id: t.id,
            operation: 'insert',
            payload: JSON.stringify(t),
            created_at: now,
            attempts: 0,
          })
        }
      })
      pushChanges().catch(() => {})
    }
  }
}
