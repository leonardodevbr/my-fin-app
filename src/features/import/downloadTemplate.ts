/**
 * Gera e faz download da planilha modelo finapp_import_v3.xlsx
 */
import * as XLSX from 'xlsx'

const TRANSACTIONS_HEADERS = [
  'type',
  'amount',
  'description',
  'date',
  'account_name',
  'category_name',
  'is_paid',
  'payment_mode',
  'installments_total',
  'notes',
]
const GROUPS_HEADERS = [
  'name',
  'type',
  'account_name',
  'category_name',
  'payment_mode',
  'amount_per_installment',
  'amount_total',
  'installments_total',
  'recurrence_period',
  'start_date',
  'recurrence_end_date',
]

export function downloadTemplate(): void {
  const wb = XLSX.utils.book_new()

  const transactionsData = [
    ['Transações'],
    ['Preencha a partir da linha 4. Colunas: type (income/expense/transfer), amount, description, date, account_name, category_name, is_paid (true/false), payment_mode, installments_total, notes'],
    TRANSACTIONS_HEADERS,
  ]
  const wsTransactions = XLSX.utils.aoa_to_sheet(transactionsData)
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'transactions')

  const groupsData = [
    ['Grupos / Parcelamentos'],
    ['Preencha a partir da linha 4. Colunas: name, type, account_name, category_name, payment_mode (single/recurring/installments), amount_per_installment, amount_total, installments_total, recurrence_period, start_date, recurrence_end_date'],
    GROUPS_HEADERS,
  ]
  const wsGroups = XLSX.utils.aoa_to_sheet(groupsData)
  XLSX.utils.book_append_sheet(wb, wsGroups, 'transaction_groups')

  XLSX.writeFile(wb, 'finapp_import_v3.xlsx')
}
