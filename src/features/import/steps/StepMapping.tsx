import { useMemo, useEffect, useRef } from 'react'
import type { Category } from '../../../db'
import type { ParseResult } from '../importParser'
import type { CategoryMapping, AccountMapping } from '../importRunner'
import { SearchableSelect } from '../../../components/ui/SearchableSelect'

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

  const defaultAccountOptions = useMemo(
    () => accountOptions.map((acc) => ({ value: acc.id, label: acc.name })),
    [accountOptions]
  )

  const accountMappingOptions = useMemo(
    () => [
      { value: '', label: '— Usar conta padrão —' },
      ...accountOptions.map((acc) => ({ value: acc.id, label: acc.name })),
    ],
    [accountOptions]
  )

  const categoryOptions = useMemo(
    () => [
      { value: '', label: '— Escolher —' },
      { value: CREATE_NEW, label: 'Criar nova categoria' },
      ...categories.map((c) => ({ value: c.id, label: `${c.name} (${c.type})` })),
    ],
    [categories]
  )

  return (
    <div className="space-y-6">
      <div>
        <SearchableSelect
          label="Conta padrão (quando não mapeada)"
          value={defaultAccountId}
          onChange={onDefaultAccountIdChange}
          options={defaultAccountOptions}
          placeholder="Selecione a conta"
          searchPlaceholder="Buscar conta..."
        />
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
                <span className="text-sm text-surface-700 w-40 shrink-0 truncate" title={name}>
                  {name}
                </span>
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={accountMapping[name] ?? ''}
                    onChange={(v) => updateAccountMapping(name, v)}
                    options={accountMappingOptions}
                    placeholder="— Usar conta padrão —"
                    searchPlaceholder="Buscar conta..."
                  />
                </div>
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
                <span className="text-sm text-surface-700 w-40 shrink-0 truncate" title={hint}>
                  {hint}
                </span>
                <div className="flex-1 min-w-0">
                  <SearchableSelect
                    value={value || ''}
                    onChange={(v) => updateCategoryMapping(hint, v)}
                    options={categoryOptions}
                    placeholder="— Escolher —"
                    searchPlaceholder="Buscar categoria..."
                  />
                </div>
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
