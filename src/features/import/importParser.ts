/**
 * Parser for spreadsheet format finapp_import_v3.xlsx
 * Sheets: "transactions", "transaction_groups". Skip "_instrucoes".
 *
 * Column layout (NO id column):
 * transactions:       0=type, 1=amount, 2=description, 3=date, 4=account_name, 5=category_name, 6=is_paid, 7=payment_mode, 8=installments_total, 9=notes
 * transaction_groups: 0=name, 1=type, 2=account_name, 3=category_name, 4=payment_mode, 5=amount_per_installment, 6=amount_total, 7=installments_total, 8=recurrence_period, 9=start_date, 10=recurrence_end_date
 */

import type { WorkBook } from 'xlsx'
import * as XLSX from 'xlsx'

// ----- Parsed result types -----

export interface ParsedStandaloneTransaction {
  id: string
  type: 'income' | 'expense' | 'transfer'
  date: string
  description: string
  /** Valor em reais (BRL), e.g. 650.00 */
  amount: number
  is_paid: boolean
  account_name: string
  categoryHint: string | null
  notes: string | null
  _source: string
}

export interface ParsedTransactionGroup {
  id: string
  name: string
  type: 'income' | 'expense' | 'transfer'
  payment_mode: 'single' | 'recurring' | 'installments'
  installments_total: number | null
  /** Reais (BRL) */
  amount_total: number | null
  /** Reais (BRL) */
  amount_per_installment: number | null
  recurrence_period: 'monthly' | 'weekly' | 'yearly' | null
  recurrence_end_date: string | null
  start_date: string
  account_name: string
  categoryHint: string | null
  _source: string
}

export interface ParsedWarning {
  sheet: string
  row: number
  reason: string
}

export interface ParseResult {
  transactions: ParsedStandaloneTransaction[]
  groups: ParsedTransactionGroup[]
  warnings: ParsedWarning[]
}

const VALID_TYPES = ['income', 'expense', 'transfer'] as const
const VALID_PAYMENT_MODES = ['single', 'recurring', 'installments'] as const
const VALID_RECURRENCE = ['monthly', 'weekly', 'yearly'] as const

function genId(): string {
  return `import_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function cell<T = unknown>(row: unknown[], index: number): T {
  const v = row[index]
  return (v != null && v !== '' ? v : '') as T
}

function cellStr(row: unknown[], index: number): string {
  const v = row[index]
  return v != null ? String(v).trim() : ''
}

function toNum(val: unknown): number {
  if (val == null || val === '') return NaN
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/\s/g, '').replace(/\./g, '').replace(',', '.'))
    return Number.isNaN(n) ? NaN : n
  }
  return NaN
}

function parseIsPaid(val: unknown): boolean {
  if (val === true || val === 1) return true
  if (typeof val === 'string') {
    const s = val.trim().toUpperCase()
    if (s === 'TRUE' || s === 'SIM' || s === '1') return true
  }
  return false
}

function getSheetRows(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
}

/** transactions sheet: row 0=title, 1=aviso, 2=headers, 3+=data */
function parseTransactionsSheet(workbook: WorkBook, result: ParseResult): void {
  const sheet = workbook.Sheets['transactions']
  if (!sheet) return
  const rows = getSheetRows(sheet)
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i] as unknown[]

    // índices sem coluna id: 0=type, 1=amount, 2=description, 3=date,
    // 4=account_name, 5=category_name, 6=is_paid, 7=payment_mode,
    // 8=installments_total, 9=notes
    const typeRaw     = cellStr(row, 0)
    const amountRaw   = cell(row, 1)
    const description = cellStr(row, 2)
    const date        = cellStr(row, 3)
    const account_name  = cellStr(row, 4)
    const category_name = cellStr(row, 5)
    const is_paid     = parseIsPaid(cell(row, 6))
    const notesRaw    = cellStr(row, 9)

    const amount = toNum(amountRaw)
    if (!description || amount <= 0 || Number.isNaN(amount)) continue

    const type = VALID_TYPES.includes(typeRaw as (typeof VALID_TYPES)[number])
      ? (typeRaw as (typeof VALID_TYPES)[number])
      : 'expense'

    result.transactions.push({
      id: genId(),
      type,
      date: date || new Date().toISOString().slice(0, 10),
      description,
      amount,
      is_paid,
      account_name: account_name || 'Conta',
      categoryHint: category_name || null,
      notes: notesRaw || null,
      _source: 'transactions',
    })
  }
}

/** transaction_groups sheet: row 0=title, 1=aviso, 2=headers, 3+=data */
function parseGroupsSheet(workbook: WorkBook, result: ParseResult): void {
  const sheet = workbook.Sheets['transaction_groups']
  if (!sheet) return
  const rows = getSheetRows(sheet)
  for (let i = 3; i < rows.length; i++) {
    const row = rows[i] as unknown[]

    // índices sem coluna id: 0=name, 1=type, 2=account_name, 3=category_name,
    // 4=payment_mode, 5=amount_per_installment, 6=amount_total,
    // 7=installments_total, 8=recurrence_period, 9=start_date, 10=recurrence_end_date
    const name                     = cellStr(row, 0)
    const typeRaw                  = cellStr(row, 1)
    const account_name             = cellStr(row, 2)
    const category_name            = cellStr(row, 3)
    const payment_modeRaw          = cellStr(row, 4)
    const amount_per_installmentRaw = cell(row, 5)
    const amount_totalRaw          = cell(row, 6)
    const installments_totalRaw    = cell(row, 7)
    const recurrence_periodRaw     = cellStr(row, 8)
    const start_date               = cellStr(row, 9)
    const recurrence_end_dateRaw   = cellStr(row, 10)

    if (!name) continue

    let amount_per_installment = toNum(amount_per_installmentRaw)
    let amount_total = toNum(amount_totalRaw)
    if (Number.isNaN(amount_per_installment)) amount_per_installment = 0
    if (Number.isNaN(amount_total)) amount_total = 0
    if (amount_per_installment <= 0 && amount_total <= 0) continue

    const type = VALID_TYPES.includes(typeRaw as (typeof VALID_TYPES)[number])
      ? (typeRaw as (typeof VALID_TYPES)[number])
      : 'expense'

    let payment_mode: 'single' | 'recurring' | 'installments' = 'single'
    if (VALID_PAYMENT_MODES.includes(payment_modeRaw as (typeof VALID_PAYMENT_MODES)[number])) {
      payment_mode = payment_modeRaw as (typeof VALID_PAYMENT_MODES)[number]
    } else if (payment_modeRaw) {
      result.warnings.push({
        sheet: 'transaction_groups',
        row: i + 1,
        reason: `payment_mode "${payment_modeRaw}" inválido; usando "single"`,
      })
    }

    let installments_total: number | null = null
    const installmentsNum = toNum(installments_totalRaw)
    if (!Number.isNaN(installmentsNum) && installmentsNum >= 1) {
      installments_total = Math.round(installmentsNum)
    }

    if (payment_mode === 'installments' && installments_total != null && installments_total >= 2) {
      if (amount_per_installment > 0 && amount_total <= 0) {
        amount_total = amount_per_installment * installments_total
      } else if (amount_total > 0 && amount_per_installment <= 0) {
        amount_per_installment = amount_total / installments_total
      }
    }

    let recurrence_period: 'monthly' | 'weekly' | 'yearly' | null = null
    if (recurrence_periodRaw && VALID_RECURRENCE.includes(recurrence_periodRaw as (typeof VALID_RECURRENCE)[number])) {
      recurrence_period = recurrence_periodRaw as (typeof VALID_RECURRENCE)[number]
    }

    result.groups.push({
      id: genId(),
      name,
      type,
      payment_mode,
      installments_total,
      amount_total: amount_total > 0 ? amount_total : null,
      amount_per_installment: amount_per_installment > 0 ? amount_per_installment : null,
      recurrence_period,
      recurrence_end_date: recurrence_end_dateRaw || null,
      start_date: start_date || new Date().toISOString().slice(0, 10),
      account_name: account_name || 'Conta',
      categoryHint: category_name || null,
      _source: 'transaction_groups',
    })
  }
}

export function parseSpreadsheet(workbook: WorkBook): ParseResult {
  const result: ParseResult = { transactions: [], groups: [], warnings: [] }
  try {
    parseTransactionsSheet(workbook, result)
    parseGroupsSheet(workbook, result)
  } catch (err) {
    result.warnings.push({
      sheet: '',
      row: 0,
      reason: err instanceof Error ? err.message : 'Erro ao interpretar',
    })
  }
  return result
}

export async function parseSpreadsheetFromFile(file: File): Promise<ParseResult> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  return parseSpreadsheet(workbook)
}