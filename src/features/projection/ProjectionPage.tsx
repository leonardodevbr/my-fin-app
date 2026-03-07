import { useState, useMemo, useCallback, useEffect } from 'react'
import { addMonths } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { computeProjection } from './projectionEngine'
import type { ProjectionResult } from './projectionEngine'
import type { PeriodPreset, Granularity } from './components/ProjectionFilters'
import { ProjectionFilters } from './components/ProjectionFilters'
import { BalanceAlertBanner } from './components/BalanceAlertBanner'
import { ProjectionChart } from './components/ProjectionChart'
import { ProjectionTable } from './components/ProjectionTable'
import { toISODate, formatCurrencyFromCents } from '../../lib/utils'

function getDateRange(preset: PeriodPreset): { from: string; to: string } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const from = toISODate(today)
  let to: Date
  switch (preset) {
    case '3m':
      to = addMonths(today, 3)
      break
    case '6m':
      to = addMonths(today, 6)
      break
    case '1y':
      to = addMonths(today, 12)
      break
    case '2y':
      to = addMonths(today, 24)
      break
    default:
      to = addMonths(today, 24)
  }
  return { from, to: toISODate(to) }
}

export function ProjectionPage() {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('1y')
  const [granularity, setGranularity] = useState<Granularity>('month')
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set())
  const [filterMonth, setFilterMonth] = useState<string | null>(null)
  const [scenario, setScenario] = useState<'default' | 'conservative' | 'optimistic'>('default')

  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? []
  const activeAccounts = useMemo(() => accounts.filter((a) => a.is_active), [accounts])

  const accountPills = useMemo(
    () =>
      activeAccounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        selected: selectedAccountIds.size === 0 || selectedAccountIds.has(acc.id),
      })),
    [activeAccounts, selectedAccountIds]
  )

  const { from, to } = useMemo(() => getDateRange(periodPreset), [periodPreset])
  const accountIdsFilter =
    selectedAccountIds.size > 0 ? Array.from(selectedAccountIds) : undefined

  const [result, setResult] = useState<ProjectionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const runProjection = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await computeProjection(from, to, accountIdsFilter)
      if (scenario === 'conservative') {
        data.monthlyEntries.forEach((me) => {
          me.income = 0
          me.net = -me.expenses
        })
        let bal = data.metadata.startingBalance
        data.monthlyEntries.forEach((me) => {
          bal += me.net
          me.closing_balance = bal
          me.has_negative = bal < 0
        })
        data.metadata.monthsNegative = data.monthlyEntries
          .filter((me) => me.closing_balance < 0)
          .map((me) => me.month)
        data.alerts = data.monthlyEntries
          .filter((me) => me.has_negative)
          .map((me) => ({
            type: 'negative_balance' as const,
            date: `${me.month}-01`,
            message: `Saldo negativo previsto em ${me.month} (${formatCurrencyFromCents(me.closing_balance)})`,
            severity: 'danger' as const,
          }))
      } else if (scenario === 'optimistic') {
        const growth = 1.05
        let prevIncome = 0
        data.monthlyEntries.forEach((me) => {
          const newIncome = Math.round(me.income * (prevIncome ? growth : 1))
          prevIncome = newIncome
          me.income = newIncome
          me.net = me.income - me.expenses
        })
        let bal = data.metadata.startingBalance
        data.monthlyEntries.forEach((me) => {
          bal += me.net
          me.closing_balance = bal
          me.has_negative = bal < 0
        })
      }
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao calcular projeção')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [from, to, accountIdsFilter, scenario])

  const onAccountToggle = useCallback((id: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  useEffect(() => {
    runProjection()
  }, [runProjection])

  const accountNames = useMemo(
    () => new Map(accounts.map((a) => [a.id, a.name])),
    [accounts]
  )

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-surface-900">Projeção financeira</h1>

      <ProjectionFilters
        periodPreset={periodPreset}
        onPeriodPresetChange={setPeriodPreset}
        granularity={granularity}
        onGranularityChange={setGranularity}
        accountPills={accountPills}
        onAccountToggle={onAccountToggle}
        scenario={scenario}
        onScenarioChange={setScenario}
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-surface-500">
          Calculando projeção…
        </div>
      )}

      {result && !loading && (
        <>
          {result.alerts.length > 0 && (
            <BalanceAlertBanner alerts={result.alerts} />
          )}

          <section className="rounded-xl border border-surface-200 bg-white p-4">
            <h2 className="mb-4 text-lg font-semibold text-surface-900">Saldo projetado</h2>
            <ProjectionChart
              result={result}
              granularity={granularity}
              onMonthClick={setFilterMonth}
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-surface-900">Detalhes</h2>
              {filterMonth && (
                <button
                  type="button"
                  onClick={() => setFilterMonth(null)}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Limpar filtro (mês)
                </button>
              )}
            </div>
            <ProjectionTable
              result={result}
              accountNames={accountNames}
              filterMonth={filterMonth}
            />
          </section>
        </>
      )}
    </div>
  )
}
