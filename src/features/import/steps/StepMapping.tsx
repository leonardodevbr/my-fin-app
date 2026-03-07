import { useMemo, useEffect, useRef } from 'react'
import type { Category } from '../../../db'
import type { ParseResult } from '../importParser'
import type { CategoryMapping, AccountMapping } from '../importRunner'

export interface StepMappingProps {
  result: ParseResult
  categories: Category[]
  defaultAccountId: string
  accountOptions: { id: string; name: string }[]
  categoryMapping: CategoryMapping
  accountMapping: AccountMapping
  onCategoryMappingChange: (m: CategoryMapping) => void
  onAccountMappingChange: (m: AccountMapping) => void
  onDefaultAccountIdChange: (id: string) => void
}

const CREATE_NEW = '__create_new__'

export function StepMapping({
  result,
  categories,
  defaultAccountId,
  accountOptions,
  categoryMapping,
  accountMapping,
  onCategoryMappingChange,
  onAccountMappingChange,
  onDefaultAccountIdChange,
}: StepMappingProps) {
  const uniqueCategoryHints = useMemo(() => {
    const set = new Set<string>()
    for (const t of result.transactions) {
      if (t.categoryHint?.trim()) set.add(t.categoryHint.trim())
    }
    for (const g of result.groups) {
      if (g.categoryHint?.trim()) set.add(g.categoryHint.trim())
    }
    return Array.from(set).sort()
  }, [result])

  const uniqueAccountNames = useMemo(() => {
    const set = new Set<string>()
    for (const t of result.transactions) {
      if (t.account_name?.trim()) set.add(t.account_name.trim())
    }
    for (const g of result.groups) {
      if (g.account_name?.trim()) set.add(g.account_name.trim())
    }
    return Array.from(set).sort()
  }, [result])

  const hasAutoFilledAccounts = useRef(false)
  useEffect(() => {
    if (hasAutoFilledAccounts.current || accountOptions.length !== 1 || uniqueAccountNames.length === 0) return
    hasAutoFilledAccounts.current = true
    const singleId = accountOptions[0].id
    const next: AccountMapping = {}
    for (const name of uniqueAccountNames) next[name] = singleId
    onAccountMappingChange(next)
  }, [accountOptions, uniqueAccountNames, onAccountMappingChange])

  const updateCategoryMapping = (hint: string, value: string) => {
    const next = { ...categoryMapping }
    if (value === CREATE_NEW) {
      next[hint] = { type: 'new', name: hint }
    } else {
      next[hint] = { type: 'existing', category_id: value }
    }
    onCategoryMappingChange(next)
  }

  const updateAccountMapping = (accountName: string, accountId: string) => {
    const next = { ...accountMapping, [accountName]: accountId }
    onAccountMappingChange(next)
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">
          Conta padrão (quando não mapeada)
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

      {uniqueAccountNames.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-surface-800 mb-2">
            Mapeamento de contas
          </h3>
          <p className="text-xs text-surface-500 mb-3">
            Vincule cada conta da planilha a uma conta existente no app.
          </p>
          <div className="space-y-3">
            {uniqueAccountNames.map((name) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-sm text-surface-700 w-40 truncate" title={name}>
                  {name}
                </span>
                <select
                  value={accountMapping[name] ?? ''}
                  onChange={(e) => updateAccountMapping(name, e.target.value)}
                  className="flex-1 rounded-lg border border-surface-300 px-3 py-2 text-sm text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="">— Usar conta padrão —</option>
                  {accountOptions.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-surface-800 mb-2">
          Mapear categorias da planilha
        </h3>
        <p className="text-xs text-surface-500 mb-3">
          Cada categoria da planilha pode ser vinculada a uma categoria existente ou criada como nova.
        </p>
        <div className="space-y-3">
          {uniqueCategoryHints.map((hint) => {
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
                  onChange={(e) => updateCategoryMapping(hint, e.target.value || CREATE_NEW)}
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
        {uniqueCategoryHints.length === 0 && (
          <p className="text-sm text-surface-500">Nenhuma categoria da planilha para mapear.</p>
        )}
      </div>
    </div>
  )
}
