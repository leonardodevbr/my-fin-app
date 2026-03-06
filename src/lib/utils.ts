import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value)
}

/** Parse "R$ 1.234,56" to 1234.56 */
export function parseCurrency(value: string): number {
  if (!value || typeof value !== 'string') return 0
  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return Number.isNaN(num) ? 0 : num
}

export function formatDate(dateStr: string, pattern = 'dd/MM/yyyy'): string {
  if (!dateStr) return ''
  if (ISO_DATE.test(dateStr)) {
    return format(parseISO(dateStr), pattern, { locale: ptBR })
  }
  return dateStr
}

export function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function toMonthKey(date: Date): string {
  return format(date, 'yyyy-MM')
}

/** Returns [firstDay, lastDay] of the month in YYYY-MM-DD for a given month key (YYYY-MM). */
export function monthRange(monthKey: string): [string, string] {
  const [y, m] = monthKey.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  return [format(startOfMonth(date), 'yyyy-MM-dd'), format(endOfMonth(date), 'yyyy-MM-dd')]
}

export function addMonthToKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  const next = delta >= 0 ? addMonths(date, delta) : subMonths(date, -delta)
  return format(next, 'yyyy-MM')
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function cn(
  ...classes: (string | undefined | false | Record<string, boolean>)[]
): string {
  return classes
    .flatMap((c) => {
      if (typeof c === 'object' && c !== null) {
        return Object.entries(c).filter(([, v]) => v).map(([k]) => k)
      }
      return typeof c === 'string' ? c : []
    })
    .filter(Boolean)
    .join(' ')
}
