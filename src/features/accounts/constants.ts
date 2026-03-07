import type { AccountType } from '../../db'

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Poupança',
  credit: 'Cartão de crédito',
  cash: 'Dinheiro',
  investment: 'Investimento',
}

export type AccountTypeOptionValue = AccountType | 'checking_digital'

/** Form options: value (unique for select), label, and schema type for DB. */
export const ACCOUNT_TYPE_OPTIONS: { value: AccountTypeOptionValue; label: string; schemaType: AccountType }[] = [
  { value: 'checking', label: 'Conta corrente', schemaType: 'checking' },
  { value: 'checking_digital', label: 'Conta digital', schemaType: 'checking' },
  { value: 'cash', label: 'Dinheiro', schemaType: 'cash' },
  { value: 'savings', label: 'Poupança', schemaType: 'savings' },
  { value: 'investment', label: 'Investimento', schemaType: 'investment' },
  { value: 'credit', label: 'Cartão de crédito', schemaType: 'credit' },
]

export const PRESET_COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#64748b',
]

export const ICON_OPTIONS = [
  'wallet',
  'landmark',
  'credit-card',
  'banknote',
  'trending-up',
  'piggy-bank',
  'briefcase',
  'home',
  'car',
  'shopping-cart',
  '💳',
  '🏦',
  '💰',
  '📈',
  '🐷',
  '💵',
  '🪙',
  '📱',
  '✈️',
  '🎯',
]

export const CURRENCY_OPTIONS = [
  { value: 'BRL', label: 'BRL (R$)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
]
