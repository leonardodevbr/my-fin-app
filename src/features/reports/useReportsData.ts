import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../../db'
import type { Transaction } from '../../db'
import { monthRange, toMonthKey, lastNMonthsRange, addMonthToKey } from '../../lib/utils'
import {
  startOfMonth,
  endOfMonth,
  addMonths,
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

/** By category for one month and one type (income/expense). For "Por Categoria" tab. */
export function useReportsDataByCategory(monthKey: string, type: 'income' | 'expense') {
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
  const prevMonthKey = addMonthToKey(monthKey, -1)
  const [prevFrom, prevTo] = monthRange(prevMonthKey)
  const prevRaw = useLiveQuery(
    async () =>
      db.transactions
        .where('date')
        .between(prevFrom, prevTo, true, true)
        .toArray(),
    [prevFrom, prevTo]
  )
  const prevTransactions = prevRaw ?? []
  const data = useMemo(
    () => aggregateByCategoryForType(transactions, prevTransactions, type),
    [transactions, prevTransactions, type]
  )
  return { transactions: transactions.filter((t) => t.type === type), ...data, from, to }
}

function aggregateByCategoryForType(
  txs: Transaction[],
  prevTxs: Transaction[],
  type: 'income' | 'expense'
) {
  const filtered = txs.filter((t) => t.type === type)
  const prevFiltered = prevTxs.filter((t) => t.type === type)
  const total = filtered.reduce((s, t) => s + t.amount, 0)
  const prevTotal = prevFiltered.reduce((s, t) => s + t.amount, 0)
  const byCat: Record<string, number> = {}
  const prevByCat: Record<string, number> = {}
  for (const t of filtered) byCat[t.category_id ?? ''] = (byCat[t.category_id ?? ''] ?? 0) + t.amount
  for (const t of prevFiltered) prevByCat[t.category_id ?? ''] = (prevByCat[t.category_id ?? ''] ?? 0) + t.amount
  const allIds = new Set([...Object.keys(byCat), ...Object.keys(prevByCat)])
  const byCategory = Array.from(allIds).map((categoryId) => {
    const amount = byCat[categoryId] ?? 0
    const prevAmount = prevByCat[categoryId] ?? 0
    const delta = amount - prevAmount
    const pct = total > 0 ? (amount / total) * 100 : 0
    return {
      categoryId: categoryId || null,
      amount,
      prevAmount,
      delta,
      pct,
    }
  })
  byCategory.sort((a, b) => b.amount - a.amount)
  return { byCategory, total, prevTotal }
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
    () => aggregateTrendsByCategory(transactions, from, to),
    [transactions, from, to]
  )
  return { transactions, ...data, from, to }
}

function aggregateByMonth(txs: Transaction[]) {
  const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const balance = income - expense
  const byWeek = weekBuckets(txs)
  const topExpenseCategories = topExpenseByCategory(txs, 5)
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

function weekBuckets(txs: Transaction[]): { week: string; income: number; expense: number }[] {
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

function topExpenseByCategory(
  txs: Transaction[],
  limit: number
): { categoryId: string | null; amount: number }[] {
  const byCat: Record<string, number> = {}
  for (const t of txs) {
    if (t.type !== 'expense') continue
    const id = t.category_id ?? ''
    byCat[id] = (byCat[id] ?? 0) + t.amount
  }
  return Object.entries(byCat)
    .map(([categoryId, amount]) => ({
      categoryId: categoryId || null,
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
}

function aggregateByMonthRange(
  txs: Transaction[],
  from: string,
  to: string
) {
  const byMonthKey: Record<
    string,
    { income: number; expense: number; balance: number; running: number }
  > = {}
  let running = 0
  let current = startOfMonth(parseISO(from))
  const end = endOfMonth(parseISO(to))
  while (current <= end) {
    const key = toMonthKey(current)
    const monthEnd = endOfMonth(current)
    const monthStart = startOfMonth(current)
    const f = format(monthStart, 'yyyy-MM-dd')
    const t = format(monthEnd, 'yyyy-MM-dd')
    const inMonth = txs.filter((x) => x.date >= f && x.date <= t)
    const income = inMonth.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0)
    const expense = inMonth.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0)
    const balance = income - expense
    running += balance
    byMonthKey[key] = { income, expense, balance, running }
    current = addMonths(current, 1)
  }
  const months = Object.entries(byMonthKey)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      monthLabel: format(parseISO(month + '-01'), 'MMM yyyy', { locale: ptBR }),
      ...v,
    }))
  return {
    byMonth: months,
    totalIncome: months.reduce((s, m) => s + m.income, 0),
    totalExpense: months.reduce((s, m) => s + m.expense, 0),
  }
}

function aggregateTrendsByCategory(
  txs: Transaction[],
  from: string,
  to: string
) {
  const byCategory: Record<string, Record<string, number>> = {}
  const expenseTxs = txs.filter((t) => t.type === 'expense')
  for (const t of expenseTxs) {
    const cid = t.category_id ?? '_none'
    if (!byCategory[cid]) byCategory[cid] = {}
    const month = t.date.slice(0, 7)
    byCategory[cid][month] = (byCategory[cid][month] ?? 0) + t.amount
  }
  const monthList: string[] = []
  let cur = startOfMonth(parseISO(from))
  const end = endOfMonth(parseISO(to))
  while (cur <= end) {
    monthList.push(toMonthKey(cur))
    cur = addMonths(cur, 1)
  }
  const series = Object.entries(byCategory).map(([cid, byMonth]) => {
    const points = monthList.map((month) => ({
      month,
      amount: byMonth[month] ?? 0,
    }))
    const lastThree = points.slice(-3).map((p) => p.amount).filter((a) => a > 0)
    const projected =
      lastThree.length > 0
        ? Math.round(lastThree.reduce((s, a) => s + a, 0) / lastThree.length)
        : null
    return {
      categoryId: cid === '_none' ? null : cid,
      points,
      projected,
    }
  })
  return { series, months: monthList }
}

export { INCOME, EXPENSE }
