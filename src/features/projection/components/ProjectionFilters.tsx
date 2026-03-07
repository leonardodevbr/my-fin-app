import React from 'react'
import { cn } from '../../../lib/utils'

export type PeriodPreset = '3m' | '6m' | '1y' | '2y' | 'custom'
export type Granularity = 'month' | 'day'

export interface ProjectionFiltersProps {
  periodPreset: PeriodPreset
  onPeriodPresetChange: (p: PeriodPreset) => void
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
  accountPills: { id: string; name: string; selected: boolean }[]
  onAccountToggle: (id: string) => void
  scenario?: 'default' | 'conservative' | 'optimistic'
  onScenarioChange?: (s: 'default' | 'conservative' | 'optimistic') => void
}

export const ProjectionFilters = React.memo(function ProjectionFilters({
  periodPreset,
  onPeriodPresetChange,
  granularity,
  onGranularityChange,
  accountPills,
  onAccountToggle,
  scenario = 'default',
  onScenarioChange,
}: ProjectionFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-surface-700">Período:</span>
        {(['3m', '6m', '1y', '2y', 'custom'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPeriodPresetChange(p)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              periodPreset === p
                ? 'bg-primary-600 text-white'
                : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
            )}
          >
            {p === '3m' && '3 meses'}
            {p === '6m' && '6 meses'}
            {p === '1y' && '1 ano'}
            {p === '2y' && '2 anos'}
            {p === 'custom' && 'Personalizado'}
          </button>
        ))}
      </div>

      <div>
        <span className="text-sm font-medium text-surface-700 block mb-2">
          Contas
        </span>
        <div className="flex flex-wrap gap-2">
          {accountPills.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => onAccountToggle(acc.id)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                acc.selected
                  ? 'bg-primary-100 text-primary-800'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              )}
            >
              {acc.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-surface-700">Exibir:</span>
        <div className="flex rounded-lg bg-surface-100 p-0.5">
          <button
            type="button"
            onClick={() => onGranularityChange('month')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              granularity === 'month' ? 'bg-white shadow text-surface-900' : 'text-surface-600'
            )}
          >
            Por mês
          </button>
          <button
            type="button"
            onClick={() => onGranularityChange('day')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium',
              granularity === 'day' ? 'bg-white shadow text-surface-900' : 'text-surface-600'
            )}
          >
            Por dia
          </button>
        </div>
      </div>

      {onScenarioChange && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-surface-700">Cenário:</span>
          {(
            [
              { value: 'default' as const, label: 'Padrão' },
              { value: 'conservative' as const, label: 'Conservador' },
              { value: 'optimistic' as const, label: 'Otimista' },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onScenarioChange(value)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium',
                scenario === value
                  ? 'bg-primary-600 text-white'
                  : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
