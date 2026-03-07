import { useMemo } from 'react'
import type { Category } from '../../../db'
import type { ParseResult } from '../importParser'
import type { CategoryMapping } from '../importRunner'

export interface StepMappingProps {
  result: ParseResult
  categories: Category[]
  defaultAccountId: string
  accountOptions: { id: string; name: string }[]
  categoryMapping: CategoryMapping
  onCategoryMappingChange: (m: CategoryMapping) => void
  onDefaultAccountIdChange: (id: string) => void
}

const CREATE_NEW = '__create_new__'

export function StepMapping({
  result,
  categories,
  defaultAccountId,
  accountOptions,
  categoryMapping,
  onCategoryMappingChange,
  onDefaultAccountIdChange,
}: StepMappingProps) {
  const uniqueHints = useMemo(() => {
    const set = new Set<string>()
    for (const t of result.transactions) {
      if (t.categoryHint?.trim()) set.add(t.categoryHint.trim())
    }
    for (const g of result.groups) {
      if (g.categoryHint?.trim()) set.add(g.categoryHint.trim())
    }
    return Array.from(set).sort()
  }, [result])

  const updateMapping = (hint: string, value: string) => {
    const next = { ...categoryMapping }
    if (value === CREATE_NEW) {
      next[hint] = { type: 'new', name: hint }
    } else {
      next[hint] = { type: 'existing', category_id: value }
    }
    onCategoryMappingChange(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Conta para as transações
        </label>
        <select
          value={defaultAccountId}
          onChange={(e) => onDefaultAccountIdChange(e.target.value)}
          className="w-full rounded-lg border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {accountOptions.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <h3 className="text-sm font-medium text-surface-800 mb-2">
          Mapear categorias da planilha
        </h3>
        <p className="text-xs text-surface-500 mb-3">
          Cada bloco/categoria da planilha pode ser vinculado a uma categoria existente ou criada como nova.
        </p>
        <div className="space-y-3">
          {uniqueHints.map((hint) => {
            const current = categoryMapping[hint]
            const value =
              current?.type === 'existing'
                ? current.category_id
                : current?.type === 'new'
                  ? CREATE_NEW
                  : ''
            return (
              <div key={hint} className="flex items-center gap-3">
                <span className="text-sm text-surface-700 w-40 truncate" title={hint}>
                  {hint}
                </span>
                <select
                  value={value || ''}
                  onChange={(e) => updateMapping(hint, e.target.value || CREATE_NEW)}
                  className="flex-1 rounded-lg border border-surface-300 px-3 py-2 text-sm text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">— Escolher —</option>
                  <option value={CREATE_NEW}>Criar nova categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.type})
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
        {uniqueHints.length === 0 && (
          <p className="text-sm text-surface-500">Nenhuma categoria da planilha para mapear.</p>
        )}
      </div>
    </div>
  )
}
