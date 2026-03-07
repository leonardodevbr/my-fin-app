/**
 * Gera e faz download da planilha modelo finapp_import_v3.xlsx
 * Template definido em: supabase/functions/send-template-email/templateDefinition.ts
 */
import * as XLSX from 'xlsx'
import {
  TRANSACTIONS_HEADERS,
  GROUPS_HEADERS,
  TRANSACTIONS_INSTRUCTION,
  GROUPS_INSTRUCTION,
} from '../../../supabase/functions/send-template-email/templateDefinition'

export function downloadTemplate(): void {
  const wb = XLSX.utils.book_new()

  const transactionsData = [
    ['Transações'],
    [TRANSACTIONS_INSTRUCTION],
    [...TRANSACTIONS_HEADERS],
  ]
  const wsTransactions = XLSX.utils.aoa_to_sheet(transactionsData)
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'transactions')

  const groupsData = [
    ['Grupos / Parcelamentos'],
    [GROUPS_INSTRUCTION],
    [...GROUPS_HEADERS],
  ]
  const wsGroups = XLSX.utils.aoa_to_sheet(groupsData)
  XLSX.utils.book_append_sheet(wb, wsGroups, 'transaction_groups')

  XLSX.writeFile(wb, 'finapp_import_v3.xlsx')
}
