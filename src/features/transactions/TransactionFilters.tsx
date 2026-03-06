import { cn } from '../../lib/utils'
import type { TransactionType } from '../../db'

export type TransactionFilter = 'all' | TransactionType | 'unpaid'

const FILTERS: { value: TransactionFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'income', label: 'Receitas' },
  { value: 'expense', label: 'Despesas' },
  { value: 'transfer', label: 'Transferências' },
  { value: 'unpaid', label: 'A pagar' },
]

export interface TransactionFiltersProps {
  value: TransactionFilter
  onChange: (value: TransactionFilter) => void
}

export function TransactionFilters({ value, onChange }: TransactionFiltersProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1">
      {FILTERS.map((f) => (
        <button
          key={f.value}
          type="button"
          onClick={() => onChange(f.value)}
          className={cn(
            'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors',
            value === f.value
              ? 'bg-primary-600 text-white'
              : 'bg-surface-200 text-surface-700 hover:bg-surface-300'
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
