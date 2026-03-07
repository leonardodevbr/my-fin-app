/**
 * Definição única do modelo de importação (planilha).
 * Usado pelo download no app e pela Edge Function send-template-email.
 * Para corrigir o template: edite só este arquivo.
 * Se usar o dashboard do Supabase (sem CLI), copie também este arquivo
 * para o projeto da função no dashboard.
 */

export const TRANSACTIONS_HEADERS = [
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
] as const

export const GROUPS_HEADERS = [
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
] as const

export const TRANSACTIONS_INSTRUCTION =
  'Preencha a partir da linha 4. Colunas: type (income/expense/transfer), amount, description, date, account_name, category_name, is_paid (true/false), payment_mode, installments_total, notes'

export const GROUPS_INSTRUCTION =
  'Preencha a partir da linha 4. Colunas: name, type, account_name, category_name, payment_mode (single/recurring/installments), amount_per_installment, amount_total, installments_total, recurrence_period, start_date, recurrence_end_date'
