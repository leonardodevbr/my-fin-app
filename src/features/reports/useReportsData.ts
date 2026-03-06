import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../db'
import type { Transaction } from '../../db'
import {
  monthRange,
  toMonthKey,
  lastNMonthsRange,
  addMonthToKey,
} from '../../lib/utils'
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  parseISO,
  getDate,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'

const INCOME = '#10b981'
const EXPENSE = '#ef4444'

/** Single month: pass monthKey (YYYY-MM). Returns transactions in range and aggregates. */
export function useReportsDataMonth(monthKey: string) {
  const [from, to] = monthRange(monthKey)
  const raw = useLiveQuery(
    async () =>
      db.transactions
        .where('date')
        .between(from, to, true, true)
        .toArray(),
    [from, to]
  )
  const transactions = raw ?? []
  const data = useMemo(() => aggregateByMonth(transactions), [transactions])
  return { transactions, ...data, from, to }
}

/** Multi-month: pass number of months (3, 6, 12). Returns transactions and per-month aggregates. */
export function useReportsDataRange(months: number) {
  const [from, to] = lastNMonthsRange(months)
  const raw = useLiveQuery(
    async () =>
      db.transactions
        .where('date')
        .between(from, to, true, true)
        .toArray(),
    [from, to]
  )
  const transactions = raw ?? []
  const data = useMemo(
    () => aggregateByMonthRange(transactions, from, to),
    [transactions, from, to]
  )
  return { transactions, ...data, from, to }
}

/** Last 6 months for trends: per-category expense by month. */
export function useReportsDataTrends(monthKey?: string) {
  const endMonth = monthKey ?? toMonthKey(new Date())
  const [from] = lastNMonthsRange(6)
  const to = (() => {
    const [y, m] = endMonth.split('-').map(Number)
    const d = new Date(y, m - 1, 1)
    return format(endOfMonth(d), 'yyyy-MM-dd')
  })()
  const raw = useLiveQuery(
    async () =>
      db.transactions
        .where('date')
        .between(from, to, true, true)
        .toArray(),
    [from, to]
  )
  const transactions = raw ?? []
  const data = useMemo(
    () => aggregateTrendsByCategory(transactions),
    [transactions]
  )
  return { transactions, ...data, from, to }
}

function aggregateByMonth(txs: Transaction()) {
  const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense
  const byWeek = weekBuckets(txs)
  const topExpenseCategories = topExpenseCategoriesByCategory(txs, 5)
  const maxExpense = txs
    .filter((t) => t.type === 'expense')
    .reduce((max, t) => (t.amount > max ? t.amount : max), 0)
  const maxExpenseTx = txs.find((t) => t.type === 'expense' && t.amount === maxExpense)
  return {
    income,
    expense,
    balance,
    byWeek,
    topExpenseCategories,
    maxExpense: maxExpenseTx?.amount ?? 0,
    maxExpenseDescription: maxExpenseTx?.description ?? '—',
  }
}

function weekBuckets(txs: Transaction()): { week: string; income: number; expense: number }[] {
  const buckets: Record<string, { income: number; expense: number }> = {}
  for (let w = 1; w <= 4; w++) {
    buckets[`Semana ${w}`] = { income: 0, expense: 0 }
  }
  for (const t of txs) {
    const d = parseISO(t.date)
    const day = getDate(d)
    const week = Math.min(4, Math.ceil(day / 7))
    const key = `Semana ${week}`
    if (t.type === 'income') buckets[key].income += t.amount
    else if (t.type === 'expense') buckets[key].expense += t.amount
  }
  return ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'].map((week) => ({
    week,
    income: buckets[week].income,
    expense: buckets[week].expense,
  }))
}

function topExpenseCategoriesByCategory(
  txs: Transaction(),
  limit: number
): { categoryId: string | null; categoryName: string; amount: number }[] {
  const byCat: Record<string, number> = {}
  const names: Record<string, string> = { '': 'Sem categoria' }
  for (const t of txs) {
    if (t.type !== 'expense') continue
    const id = t.category_id ?? ''
    byCat[id] = (byCat[id] ?? 0) + t.amount
  }
  const sorted = Object.entries(byCat)
    .map(([id, amount]) => ({ categoryId: id || null, categoryName: names[id] ?? id || 'Sem categoria', amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
  return sorted
}

function aggregateByMonthRange(
  txs: Transaction(),
  from: string,
  to: string
) {
  const byMonthKey: Record<
    string,
    { income: number; expense: number; balance: number; running: number }
  > = {}
  let running = 0
  const start = parseISO(from)
  const end = parseISO(to)
  for (let d = startOfMonth(start); d <= end; d = startOfMonth(addMonthToKey(toMonthKey(d), 1))) {
    const key = toMonthKey(d)
    const monthEnd = endOfMonth(d)
    const monthStart = startOfMonth(d)
    const f = format(monthStart, 'yyyy-MM-dd')
    const t = format(monthEnd, 'yyyy-MM-dd')
    const inMonth = txs.filter(
      (x) => x.date >= f && x.date <= t
    )
    const income = inMonth.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0)
    const expense = inMonth.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0)
    const balance = income - expense
    running += balance
    byMonthKey[key] = { income, expense, balance, running }
  }
  const months = Object.entries(byMonthKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      monthLabel: format(parseISO(month + '-01'), 'MMM yyyy', { locale: ptBR }),
      ...v,
    }))
  return { byMonth: months, totalIncome: months.reduce((s, m) => s + m.income, 0), totalExpense: months.reduce((s, m) => s + m.expense, 0) }
}

function addMonthToKey(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  d.setMonth(d.getMonth() + delta)
  return format(d, 'yyyy-MM')
}

function aggregateTrendsByCategory(txs: Transaction()) {
  type Point = { month: string; amount: number }
  const byCategory: Record<string, Record<string, number>> = {}
  const categoryNames: Record<string, string> = {}
  const expenseTxs = txs.filter((t) => t.type === 'expense')
  for (const t of expenseTxs) {
    const cid = t.category_id ?? '_none'
    if (!byCategory[cid]) byCategory[cid] = {}
    const month = t.date.slice(0, 7)
    byCategory[cid][month] = (byCategory[cid][month] ?? 0) + t.amount
    if (!categoryNames[cid]) categoryNames[cid] = (t as Transaction & { categoryName?: string }).categoryName ?? cid === '_none' ? 'Sem categoria' : cid
  }
  const months = useMemo(() => {
    const set = new Set<string>()
    expenseTxs.forEach((t) => set.add(t.date.slice(0, 7)))
    return Array.from(set).sort()
  }, [expenseTxs])
  const series = Object.entries(byCategory).map(([cid, byMonth]) => ({
    categoryId: cid === '_none' ? null : cid,
    name: categoryNames[cid] ?? cid,
    color: EXPENSE,
    points: months.map((month) => ({
      month,
      amount: byMonth[month] ?? 0,
    })),
    projected: null as number | null,
  }))
  return { series, months, categoryNames }
}

export { INCOME, EXPENSE }
