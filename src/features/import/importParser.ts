/**
 * Parser for spreadsheet format "controle_financeiro_leo_2026_v3.xlsx"
 * Uses SheetJS (xlsx) - workbook is read in browser and passed here.
 */

import type { WorkBook } from 'xlsx'
import * as XLSX from 'xlsx'
import { parseCurrency } from '../../lib/utils'

// ----- Parsed result types -----

export interface ParsedStandaloneTransaction {
  id: string
  type: 'income' | 'expense'
  date: string
  description: string
  amountCents: number
  is_paid: boolean
  categoryHint: string | null
  _source: string
}

export interface ParsedTransactionGroup {
  id: string
  name: string
  type: 'income' | 'expense'
  payment_mode: 'single' | 'installments' | 'recurring'
  installments_total: number | null
  amount_total: number | null
  amount_per_installment: number | null
  recurrence_period: 'monthly' | null
  recurrence_end_date: string | null
  start_date: string
  categoryHint: string | null
  /** For Premissas: already paid in March → one tx with is_paid=true for 2026-03 */
  already_paid_march?: boolean
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

function genId(): string {
  return `import_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function toNum(val: unknown): number {
  if (val == null) return NaN
  if (typeof val === 'number' && !Number.isNaN(val)) return val
  if (typeof val === 'string') return parseCurrency(val)
  return NaN
}

function toCents(val: unknown): number {
  const n = toNum(val)
  return Number.isNaN(n) ? 0 : Math.round(n * 100)
}

function cell(row: unknown[], index: number): unknown {
  return row[index] ?? ''
}

function cellStr(row: unknown[], index: number): string {
  const v = row[index]
  return v != null ? String(v).trim() : ''
}

/** Get row array from sheet (0-based row index). */
function getSheetRows(ws: XLSX.WorkSheet): unknown[][] {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
  return data
}

function parsePremissas(workbook: WorkBook, result: ParseResult): void {
  const sheet = workbook.Sheets['Premissas']
  if (!sheet) return
  const rows = getSheetRows(sheet)
  const premissasItemNames = new Set<string>()
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const bloco = cellStr(row, 0) // A - Bloco
    if (!bloco) continue
    const item = cellStr(row, 1)   // B - Item
    const valor = toCents(cell(row, 2))  // C - Valor
    const tipo = cellStr(row, 3).toLowerCase()   // D - Tipo
    void cellStr(row, 4)   // E - Observação
    const status = cellStr(row, 5).toLowerCase()  // F - Status
    if (!item) continue
    if (valor <= 0) {
      result.warnings.push({ sheet: 'Premissas', row: i + 1, reason: 'Valor inválido ou zero' })
      continue
    }
    premissasItemNames.add(item)
    const recurrence_period = tipo === 'mensal' ? 'monthly' as const : null
    const already_paid_march = status.includes('pago')
    let start_date = '2026-03-01'
    if (status.includes('abril')) start_date = '2026-04-01'
    else if (status.includes('ativo') || status.includes('março') || status.includes('marco')) start_date = '2026-03-01'
    const group: ParsedTransactionGroup = {
      id: genId(),
      name: item,
      type: 'expense',
      payment_mode: recurrence_period ? 'recurring' : 'single',
      installments_total: null,
      amount_total: valor,
      amount_per_installment: valor,
      recurrence_period,
      recurrence_end_date: null,
      start_date,
      categoryHint: bloco || null,
      already_paid_march,
      _source: 'Premissas',
    }
    result.groups.push(group)
  }
}

function parseMarco2026(workbook: WorkBook, result: ParseResult): void {
  const sheet = workbook.Sheets['Março_2026']
  if (!sheet) return
  const rows = getSheetRows(sheet)
  const março = '2026-03-01'
  let inJáPago = false
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const a0 = cellStr(row, 0).toLowerCase()
    if (a0.includes('já pago') || a0.includes('ja pago')) inJáPago = true
    if (a0.includes('falta pagar')) inJáPago = false
    const item = cellStr(row, 1) || cellStr(row, 0)
    const valor = toCents(cell(row, 2) ?? cell(row, 1))
    const status = cellStr(row, 3).toLowerCase() || cellStr(row, 2).toLowerCase()
    if (!item || valor <= 0) continue
    const isReceita = a0.includes('receita') || item.toLowerCase().includes('receita')
    const is_paid = status.includes('pago') || inJáPago
    const tx: ParsedStandaloneTransaction = {
      id: genId(),
      type: isReceita ? 'income' : 'expense',
      date: março,
      description: item,
      amountCents: valor,
      is_paid,
      categoryHint: null,
      _source: 'Março_2026',
    }
    result.transactions.push(tx)
  }
}

function inferStartDateFromPlano(plano: string): string {
  const p = (plano || '').toLowerCase()
  if (p.includes('abril')) return '2026-04-01'
  if (p.includes('maio')) return '2026-05-01'
  if (p.includes('junho')) return '2026-06-01'
  if (p.includes('julho')) return '2026-07-01'
  if (p.includes('agosto')) return '2026-08-01'
  if (p.includes('setembro')) return '2026-09-01'
  if (p.includes('outubro')) return '2026-10-01'
  if (p.includes('novembro')) return '2026-11-01'
  if (p.includes('dezembro')) return '2026-12-01'
  return '2026-03-01'
}

function parseDividasParcelas(workbook: WorkBook, result: ParseResult): void {
  const sheet = workbook.Sheets['Dividas_Parcelas']
  if (!sheet) return
  const rows = getSheetRows(sheet)
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    const tipo = cellStr(row, 0)
    const credor = cellStr(row, 1)
    const valor_estimado = toCents(cell(row, 2))
    const parcelas_restantes = toNum(cell(row, 3))
    void cellStr(row, 4) // situação
    const plano = cellStr(row, 5)
    if (!credor) continue
    if (valor_estimado <= 0) {
      result.warnings.push({ sheet: 'Dividas_Parcelas', row: i + 1, reason: 'Valor estimado inválido ou zero' })
      continue
    }
    const hasParcelas = !Number.isNaN(parcelas_restantes) && parcelas_restantes >= 1
    const installments_total = hasParcelas ? Math.round(parcelas_restantes) : 1
    const amount_per_installment = Math.floor(valor_estimado / installments_total)
    const group: ParsedTransactionGroup = {
      id: genId(),
      name: credor,
      type: 'expense',
      payment_mode: hasParcelas ? 'installments' : 'single',
      installments_total: hasParcelas ? installments_total : null,
      amount_total: valor_estimado,
      amount_per_installment: hasParcelas ? amount_per_installment : valor_estimado,
      recurrence_period: null,
      recurrence_end_date: null,
      start_date: inferStartDateFromPlano(plano),
      categoryHint: tipo || null,
      _source: 'Dividas_Parcelas',
    }
    result.groups.push(group)
  }
}

const MONTH_SHEETS = ['Abril_2026', 'Maio_2026', 'Junho_2026', 'Julho_2026', 'Agosto_2026', 'Setembro_2026', 'Outubro_2026', 'Novembro_2026', 'Dezembro_2026'] as const
const MONTH_DATES: Record<string, string> = {
  Abril_2026: '2026-04-01',
  Maio_2026: '2026-05-01',
  Junho_2026: '2026-06-01',
  Julho_2026: '2026-07-01',
  Agosto_2026: '2026-08-01',
  Setembro_2026: '2026-09-01',
  Outubro_2026: '2026-10-01',
  Novembro_2026: '2026-11-01',
  Dezembro_2026: '2026-12-01',
}

function parseMonthSheets(workbook: WorkBook, result: ParseResult, premissasItemNames: Set<string>): void {
  for (const sheetName of MONTH_SHEETS) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const rows = getSheetRows(sheet)
    const date = MONTH_DATES[sheetName] || '2026-04-01'
    let inSaidas = false
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[]
      const a0 = cellStr(row, 0).toLowerCase()
      if (a0.includes('saída') || a0.includes('saida')) inSaidas = true
      const item = cellStr(row, 1) || cellStr(row, 0)
      const valor = toCents(cell(row, 2) ?? cell(row, 1))
      const categoria = cellStr(row, 3) || cellStr(row, 2)
      if (!inSaidas || !item || valor <= 0) continue
      if (premissasItemNames.has(item)) continue
      const tx: ParsedStandaloneTransaction = {
        id: genId(),
        type: 'expense',
        date,
        description: item,
        amountCents: valor,
        is_paid: false,
        categoryHint: categoria || null,
        _source: sheetName,
      }
      result.transactions.push(tx)
    }
  }
}

/** Collect all item names from Premissas (for dedupe in month sheets). */
function getPremissasItemNames(workbook: WorkBook): Set<string> {
  const sheet = workbook.Sheets['Premissas']
  if (!sheet) return new Set()
  const rows = getSheetRows(sheet)
  const set = new Set<string>()
  for (const row of rows) {
    const r = row as unknown[]
    const bloco = cellStr(r, 0)
    if (!bloco) continue
    const item = cellStr(r, 1)
    if (item) set.add(item)
  }
  return set
}

/**
 * Parse the specific spreadsheet format into transactions and groups.
 * Call this after loading the file with XLSX.read() in the browser.
 */
export function parseSpreadsheet(workbook: WorkBook): ParseResult {
  const result: ParseResult = { transactions: [], groups: [], warnings: [] }
  try {
    parsePremissas(workbook, result)
    const premissasNames = getPremissasItemNames(workbook)
    parseMarco2026(workbook, result)
    parseDividasParcelas(workbook, result)
    parseMonthSheets(workbook, result, premissasNames)
  } catch (err) {
    result.warnings.push({
      sheet: '',
      row: 0,
      reason: err instanceof Error ? err.message : 'Erro ao interpretar planilha',
    })
  }
  return result
}

/**
 * Read file (File object) and return parsed result.
 * Use in browser after user selects file.
 */
export async function parseSpreadsheetFromFile(file: File): Promise<ParseResult> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  return parseSpreadsheet(workbook)
}
