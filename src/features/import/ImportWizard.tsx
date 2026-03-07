import { useState, useMemo, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { useAuth } from '../../hooks/useAuth'
import type { ParseResult } from './importParser'
import type { CategoryMapping, AccountMapping } from './importRunner'
import { StepUpload } from './steps/StepUpload'
import { StepPreview } from './steps/StepPreview'
import { StepMapping } from './steps/StepMapping'
import { StepConfirm } from './steps/StepConfirm'

const STEPS = ['upload', 'preview', 'mapping', 'confirm'] as const

export function ImportWizard() {
  const { user } = useAuth()
  const [stepIndex, setStepIndex] = useState(0)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set())
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set())
  const [categoryMapping, setCategoryMapping] = useState<CategoryMapping>({})
  const [accountMapping, setAccountMapping] = useState<AccountMapping>({})
  const [defaultAccountId, setDefaultAccountId] = useState('')

  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? []
  const accounts = useLiveQuery(
    () => db.accounts.toArray().then((arr) => arr.filter((a) => a.is_active)),
    []
  ) ?? []

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ id: a.id, name: a.name })),
    [accounts]
  )

  const firstAccountId = accountOptions[0]?.id ?? ''
  const effectiveAccountId = defaultAccountId || firstAccountId
  useEffect(() => {
    if (!defaultAccountId && firstAccountId) setDefaultAccountId(firstAccountId)
  }, [firstAccountId, defaultAccountId])

  const newCategoryNames = useMemo(() => {
    const names: string[] = []
    for (const v of Object.values(categoryMapping)) {
      if (v?.type === 'new' && !names.includes(v.name)) names.push(v.name)
    }
    return names
  }, [categoryMapping])

  const step = STEPS[stepIndex]
  const canNext =
    step === 'upload' ? !!parseResult :
    step === 'preview' ? (selectedTxIds.size > 0 || selectedGroupIds.size > 0) :
    step === 'mapping' ? true :
    false
  const canPrev = stepIndex > 0

  const goNext = () => {
    if (step === 'upload' && parseResult) {
      setSelectedTxIds(new Set(parseResult.transactions.map((t) => t.id)))
      setSelectedGroupIds(new Set(parseResult.groups.map((g) => g.id)))
    }
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1)
  }

  const goPrev = () => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`flex items-center gap-1 ${i <= stepIndex ? 'text-primary-600' : 'text-surface-400'}`}
          >
            <span
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < stepIndex ? 'bg-primary-100' : i === stepIndex ? 'bg-primary-600 text-white' : 'bg-surface-100'
              }`}
            >
              {i + 1}
            </span>
            {i < STEPS.length - 1 && <span className="w-6 h-0.5 bg-surface-200" />}
          </div>
        ))}
      </div>

      {step === 'upload' && (
        <StepUpload
          onParsed={(result) => {
            setParseResult(result)
            setSelectedTxIds(new Set(result.transactions.map((t) => t.id)))
            setSelectedGroupIds(new Set(result.groups.map((g) => g.id)))
          }}
        />
      )}

      {step === 'preview' && parseResult && (
        <StepPreview
          result={parseResult}
          selectedTxIds={selectedTxIds}
          selectedGroupIds={selectedGroupIds}
          onSelectedTxIdsChange={setSelectedTxIds}
          onSelectedGroupIdsChange={setSelectedGroupIds}
        />
      )}

      {step === 'mapping' && parseResult && (
        <StepMapping
          result={parseResult}
          categories={categories}
          defaultAccountId={effectiveAccountId}
          accountOptions={accountOptions}
          categoryMapping={categoryMapping}
          accountMapping={accountMapping}
          onCategoryMappingChange={setCategoryMapping}
          onAccountMappingChange={setAccountMapping}
          onDefaultAccountIdChange={setDefaultAccountId}
        />
      )}

      {step === 'confirm' && parseResult && (
        <StepConfirm
          result={parseResult}
          selectedTxIds={selectedTxIds}
          selectedGroupIds={selectedGroupIds}
          categoryMapping={categoryMapping}
          accountMapping={accountMapping}
          newCategoryNames={newCategoryNames}
          defaultAccountId={effectiveAccountId}
          userId={user?.id ?? ''}
        />
      )}

      <div className="flex justify-between pt-4 border-t border-surface-200">
        <button
          type="button"
          onClick={goPrev}
          disabled={!canPrev}
          className="px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 rounded-lg disabled:opacity-50 disabled:pointer-events-none"
        >
          Voltar
        </button>
        {step !== 'confirm' && (
          <button
            type="button"
            onClick={goNext}
            disabled={!canNext}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 disabled:pointer-events-none"
          >
            Próximo
          </button>
        )}
      </div>
    </div>
  )
}
