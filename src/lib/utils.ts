import { format, parseISO, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

export function formatCurrency(value: number, currency = 'BRL'): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(value)
}

/** Valor no banco é inteiro em centavos. Exibe em reais: 525 → "R$ 5,25" */
export function formatCurrencyFromCents(cents: number, currency = 'BRL'): string {
  return formatCurrency(cents / 100, currency)
}

/** Parse "R$ 1.234,56" ou "1.234,56" para número em reais (1234.56). */
export function parseCurrency(value: string): number {
  if (!value || typeof value !== 'string') return 0
  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return Number.isNaN(num) ? 0 : num
}

/** Converte string formatada (reais) para centavos (inteiro). Ex: "R$ 5,25" → 525 */
export function parseCurrencyToCents(value: string): number {
  return Math.round(parseCurrency(value) * 100)
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

/** Returns [startDate, endDate] for the last N months (end = last day of current month). */
export function lastNMonthsRange(n: number): [string, string] {
  const end = new Date()
  const start = subMonths(end, n - 1)
  const startMonth = startOfMonth(start)
  const endMonth = endOfMonth(end)
  return [format(startMonth, 'yyyy-MM-dd'), format(endMonth, 'yyyy-MM-dd')]
}

export function addMonthToKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  const next = delta >= 0 ? addMonths(date, delta) : subMonths(date, -delta)
  return format(next, 'yyyy-MM')
}

/** Retorna texto de diferença relativa em pt-BR: "Há X seg", "Há X min", "Há X h", "Há X dias" */
export function formatRelativeTime(iso: string | null): string {
  if (!iso || !iso.trim()) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffH = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffH / 24)
  if (diffSec < 60) return `Há ${diffSec} seg`
  if (diffMin < 60) return `Há ${diffMin} min`
  if (diffH < 24) return `Há ${diffH} h`
  return `Há ${diffDays} dias`
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
