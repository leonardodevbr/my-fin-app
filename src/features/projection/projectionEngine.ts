/**
 * Pure computation module for financial projection.
 * Reads from Dexie only; never writes. Generates virtual future events in memory.
 *
 * All monetary amounts (Transaction.amount, group amounts, eventDelta, ProjectionMonthEntry
 * income/expenses/net/closing_balance, metadata.startingBalance/lowestBalance/highestBalance)
 * are in integer cents. Display layers must use formatCurrencyFromCents().
 */

import { addMonths } from 'date-fns'
import { db } from '../../db'
import type { Transaction, TransactionGroup } from '../../db'
import { addPeriod } from '../../sync/recurringScheduler'
import { generateId, toISODate } from '../../lib/utils'

export interface ProjectionEvent {
  id: string
  group_id: string | null
  account_id: string
  category_id: string | null
  type: 'income' | 'expense' | 'transfer'
  amount: number
  description: string
  date: string
  is_paid: boolean
  is_virtual: boolean
  installment_number: number | null
}

export interface ProjectionEntry {
  date: string
  event: ProjectionEvent
  balanceAfter: number
  is_virtual: boolean
}

export interface ProjectionMonthEntry {
  month: string
  income: number
  expenses: number
  net: number
  closing_balance: number
  has_negative: boolean
  is_virtual: boolean
}

export interface ProjectionAlert {
  type: 'negative_balance' | 'large_expense' | 'installment_ending' | 'no_income'
  date: string
  message: string
  severity: 'warning' | 'danger'
}

export interface ProjectionResult {
  dailyEntries: ProjectionEntry[]
  monthlyEntries: ProjectionMonthEntry[]
  alerts: ProjectionAlert[]
  metadata: {
    fromDate: string
    toDate: string
    startingBalance: number
    lowestBalance: { date: string; amount: number }
    highestBalance: { date: string; amount: number }
    monthsNegative: string[]
  }
}

function toProjectionEvent(t: Transaction, is_virtual: boolean): ProjectionEvent {
  return {
    id: t.id,
    group_id: t.group_id,
    account_id: t.account_id,
    category_id: t.category_id,
    type: t.type,
    amount: t.amount,
    description: t.description,
    date: t.date,
    is_paid: t.is_paid,
    is_virtual,
    installment_number: t.installment_number,
  }
}

function eventDelta(e: ProjectionEvent, accountIds: Set<string>): number {
  if (!accountIds.has(e.account_id)) return 0
  if (e.type === 'income') return e.amount
  return -e.amount
}

/** Generate virtual recurring occurrences from nextDate (exclusive) to toDate. */
function generateVirtualRecurring(
  group: TransactionGroup,
  lastDate: string | null,
  toDate: Date,
  accountIds: Set<string>
): ProjectionEvent[] {
  if (!group.recurrence_period || !accountIds.has(group.account_id)) return []
  const period = group.recurrence_period
  const endDateStr = group.recurrence_end_date
  const toDateStr = toISODate(toDate)
  let nextStr = lastDate ? addPeriod(lastDate, period) : group.start_date
  const events: ProjectionEvent[] = []
  const amount = group.amount_per_installment ?? group.amount_total ?? 0

  while (nextStr <= toDateStr) {
    if (endDateStr && nextStr > endDateStr) break
    events.push({
      id: `virtual-${generateId()}`,
      group_id: group.id,
      account_id: group.account_id,
      category_id: group.category_id,
      type: group.type,
      amount,
      description: group.name,
      date: nextStr,
      is_paid: false,
      is_virtual: true,
      installment_number: null,
    })
    nextStr = addPeriod(nextStr, period)
  }
  return events
}

/** Generate virtual installments for missing dates (group has installments_total, start_date, amount_per_installment). */
function generateVirtualInstallments(
  group: TransactionGroup,
  existingByNumber: Map<number, Transaction>,
  toDate: Date,
  accountIds: Set<string>
): ProjectionEvent[] {
  if (group.payment_mode !== 'installments' || !accountIds.has(group.account_id)) return []
  const total = group.installments_total ?? 0
  if (total < 1) return []
  const startDate = new Date(group.start_date + 'T12:00:00')
  const amountPer = group.amount_per_installment ?? Math.floor((group.amount_total ?? 0) / total)
  const amountTotal = group.amount_total ?? amountPer * total
  const remainder = amountTotal - amountPer * total
  const toDateStr = toISODate(toDate)
  const events: ProjectionEvent[] = []

  for (let n = 1; n <= total; n++) {
    if (existingByNumber.has(n)) continue
    const date = addMonths(startDate, n - 1)
    const dateStr = toISODate(date)
    if (dateStr > toDateStr) break
    const parcelCents = amountPer + (n <= remainder ? 1 : 0)
    events.push({
      id: `virtual-${generateId()}`,
      group_id: group.id,
      account_id: group.account_id,
      category_id: group.category_id,
      type: group.type,
      amount: parcelCents,
      description: `${group.name} ${n}/${total}`,
      date: dateStr,
      is_paid: false,
      is_virtual: true,
      installment_number: n,
    })
  }
  return events
}

export async function computeProjection(
  fromDate: string,
  toDate: string,
  accountIds?: string[]
): Promise<ProjectionResult> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = toISODate(today)
  const toDateObj = new Date(toDate + 'T23:59:59')

  const allAccounts = await db.accounts.toArray()
  const activeAccounts = allAccounts.filter((a) => a.is_active)
  const accountSet =
    accountIds?.length ? new Set(accountIds) : new Set(activeAccounts.map((a) => a.id))

  const accounts = await db.accounts.toArray()
  const filteredAccounts = accounts.filter((a) => accountSet.has(a.id))
  const startingBalance = filteredAccounts.reduce((sum, a) => sum + a.balance, 0)

  const unpaidFromToday = await db.transactions
    .where('date')
    .aboveOrEqual(todayStr)
    .filter((t) => !t.is_paid && accountSet.has(t.account_id))
    .toArray()

  const groups = await db.transaction_groups
    .where('payment_mode')
    .anyOf(['recurring', 'installments'])
    .filter(
      (g) =>
        (g.recurrence_end_date == null || g.recurrence_end_date >= fromDate) &&
        accountSet.has(g.account_id)
    )
    .toArray()

  const realUnpaidEvents = unpaidFromToday.map((t) => toProjectionEvent(t, false))

  const virtualEvents: ProjectionEvent[] = []

  for (const group of groups) {
    if (group.payment_mode === 'recurring') {
      const groupTxs = await db.transactions
        .where('group_id')
        .equals(group.id)
        .toArray()
      const sorted = groupTxs.sort((a, b) => a.date.localeCompare(b.date))
      const lastTx = sorted[sorted.length - 1]
      const lastDate = lastTx?.date ?? null
      virtualEvents.push(...generateVirtualRecurring(group, lastDate, toDateObj, accountSet))
    } else {
      const groupTxs = await db.transactions.where('group_id').equals(group.id).toArray()
      const existingByNumber = new Map<number, Transaction>()
      for (const t of groupTxs) {
        if (t.installment_number != null) existingByNumber.set(t.installment_number, t)
      }
      virtualEvents.push(
        ...generateVirtualInstallments(group, existingByNumber, toDateObj, accountSet)
      )
    }
  }

  const projectedEvents = [...realUnpaidEvents, ...virtualEvents].sort((a, b) =>
    a.date.localeCompare(b.date)
  )

  const sortedEvents = [...projectedEvents].sort((a, b) => a.date.localeCompare(b.date))

  let runningBalance = startingBalance
  const dailyEntries: ProjectionEntry[] = []
  let lowestBalance = startingBalance
  let lowestDate = fromDate
  let highestBalance = startingBalance
  let highestDate = fromDate

  for (const e of sortedEvents) {
    runningBalance += eventDelta(e, accountSet)
    dailyEntries.push({
      date: e.date,
      event: e,
      balanceAfter: runningBalance,
      is_virtual: e.is_virtual,
    })
    if (runningBalance < lowestBalance) {
      lowestBalance = runningBalance
      lowestDate = e.date
    }
    if (runningBalance > highestBalance) {
      highestBalance = runningBalance
      highestDate = e.date
    }
  }

  const monthMap = new Map<
    string,
    { income: number; expenses: number; entries: ProjectionEntry[] }
  >()
  for (const entry of dailyEntries) {
    const month = entry.date.slice(0, 7)
    if (!monthMap.has(month)) {
      monthMap.set(month, { income: 0, expenses: 0, entries: [] })
    }
    const row = monthMap.get(month)!
    row.entries.push(entry)
    if (entry.event.type === 'income') row.income += entry.event.amount
    else row.expenses += entry.event.amount
  }

  const monthlyEntries: ProjectionMonthEntry[] = []
  let closing = startingBalance
  const monthsNegative: string[] = []

  const monthsToShow: string[] = []
  let d = new Date(fromDate + 'T01')
  const end = new Date(toDate + 'T01')
  while (d <= end) {
    monthsToShow.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'))
    d = addMonths(d, 1)
  }

  for (const month of monthsToShow) {
    const row = monthMap.get(month) ?? { income: 0, expenses: 0, entries: [] }
    const net = row.income - row.expenses
    closing += net
    const isFuture = month > todayStr.slice(0, 7)
    monthlyEntries.push({
      month,
      income: row.income,
      expenses: row.expenses,
      net,
      closing_balance: closing,
      has_negative: closing < 0,
      is_virtual: isFuture,
    })
    if (closing < 0) monthsNegative.push(month)
  }

  const alerts: ProjectionAlert[] = []
  for (const me of monthlyEntries) {
    if (me.has_negative) {
      alerts.push({
        type: 'negative_balance',
        date: `${me.month}-01`,
        message: `Saldo negativo previsto em ${formatMonthYear(me.month)} (${formatCents(me.closing_balance)})`,
        severity: 'danger',
      })
    }
  }

  return {
    dailyEntries,
    monthlyEntries,
    alerts,
    metadata: {
      fromDate,
      toDate,
      startingBalance,
      lowestBalance: { date: lowestDate, amount: lowestBalance },
      highestBalance: { date: highestDate, amount: highestBalance },
      monthsNegative,
    },
  }
}

function formatMonthYear(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${months[m - 1]}/${y}`
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}
