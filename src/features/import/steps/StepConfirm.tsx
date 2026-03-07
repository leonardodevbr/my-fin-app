import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { runImport } from '../importRunner'
import type { ParseResult } from '../importParser'
import type { CategoryMapping } from '../importRunner'

export interface StepConfirmProps {
  result: ParseResult
  selectedTxIds: Set<string>
  selectedGroupIds: Set<string>
  categoryMapping: CategoryMapping
  newCategoryNames: string[]
  defaultAccountId: string
  userId: string
}

export interface ImportSummary {
  transactionsCreated: number
  groupsCreated: number
  installmentsCreated: number
  categoriesCreated: number
}

export function StepConfirm({
  result,
  selectedTxIds,
  selectedGroupIds,
  categoryMapping,
  newCategoryNames,
  defaultAccountId,
  userId,
}: StepConfirmProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [progress, setProgress] = useState({ current: 0, total: 1 })

  const selectedTxs = result.transactions.filter((t) => selectedTxIds.has(t.id))
  const selectedGroups = result.groups.filter((g) => selectedGroupIds.has(g.id))
  const totalSteps =
    newCategoryNames.length +
    selectedGroups.length +
    selectedGroups.reduce(
      (acc, g) =>
        acc + (g.payment_mode === 'single' ? 1 : g.installments_total ?? 1),
      0
    ) +
    selectedTxs.length

  const handleRun = async () => {
    setError(null)
    setLoading(true)
    setProgress({ current: 0, total: totalSteps })
    const newCategories = newCategoryNames.map((name) => ({
      name,
      type: 'expense' as const,
    }))
    try {
      const res = await runImport({
        userId,
        defaultAccountId,
        categoryMapping,
        newCategories,
        transactions: selectedTxs,
        groups: selectedGroups,
        onProgress: (current, total) => setProgress({ current, total }),
      })
      setSummary(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao importar')
    } finally {
      setLoading(false)
    }
  }

  if (summary) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-lg font-medium text-surface-900">
          Importação concluída
        </p>
        <p className="text-sm text-surface-600">
          {summary.transactionsCreated} transações criadas, {summary.groupsCreated} grupos,{' '}
          {summary.installmentsCreated} parcelas
          {summary.categoriesCreated > 0 && `, ${summary.categoriesCreated} categorias novas`}.
        </p>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          Ver Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-surface-600">
        Serão criados: <strong>{selectedTxs.length}</strong> transações únicas,{' '}
        <strong>{selectedGroups.length}</strong> grupos e as parcelas correspondentes.
        {newCategoryNames.length > 0 && (
          <> <strong>{newCategoryNames.length}</strong> nova(s) categoria(s).</>
        )}
      </p>
      {loading && (
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-surface-200 overflow-hidden">
            <div
              className="h-full bg-primary-600 transition-all duration-300"
              style={{
                width: `${progress.total ? (100 * progress.current) / progress.total : 0}%`,
              }}
            />
          </div>
          <p className="text-sm text-surface-500">
            Processando {progress.current} de {progress.total}…
          </p>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleRun}
        disabled={loading}
        className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
      >
        {loading ? 'Importando…' : 'Confirmar e importar'}
      </button>
    </div>
  )
}
