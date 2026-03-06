import { useState, useMemo, useEffect } from 'react'
import { BarChart3, PieChart, TrendingUp, Activity } from 'lucide-react'
import Papa from 'papaparse'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { formatCurrencyFromCents, toMonthKey } from '../../lib/utils'
import { useCategories } from '../../hooks/useCategories'
import {
  useReportsDataMonth,
  useReportsDataByCategory,
  useReportsDataRange,
  useReportsDataTrends,
} from './useReportsData'
import { MonthlyBarChart } from './components/MonthlyBarChart'
import { CategoryPieChart } from './components/CategoryPieChart'
import { CashFlowChart } from './components/CashFlowChart'
import { CategoryBreakdownTable } from './components/CategoryBreakdownTable'
import { TrendLineChart } from './components/TrendLineChart'
import { cn } from '../../lib/utils'

const TABS = [
  { id: 'mensal', label: 'Mensal', icon: BarChart3 },
  { id: 'categoria', label: 'Por Categoria', icon: PieChart },
  { id: 'fluxo', label: 'Fluxo de Caixa', icon: Activity },
  { id: 'tendencias', label: 'Tendências', icon: TrendingUp },
] as const

type TabId = (typeof TABS)[number]['id']

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-300 bg-surface-50/50 py-12 px-4 text-center">
      <BarChart3 className="h-12 w-12 text-surface-400 mb-3" />
      <p className="text-surface-600 font-medium">Sem dados no período</p>
      <p className="text-sm text-surface-500 mt-1">{message}</p>
    </div>
  )
}

function MonthYearPicker({
  monthKey,
  onChange,
}: {
  monthKey: string
  onChange: (key: string) => void
}) {
  const [y, m] = monthKey.split('-').map(Number)
  const months = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
  ]
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={m}
        onChange={(e) => onChange(`${y}-${String(Number(e.target.value)).padStart(2, '0')}`)}
        className="rounded-lg border border-surface-300 bg-white px-2 py-1.5 text-sm"
      >
        {months.map((month, i) => (
          <option key={month} value={i + 1}>
            {month}
          </option>
        ))}
      </select>
      <select
        value={y}
        onChange={(e) => onChange(`${e.target.value}-${String(m).padStart(2, '0')}`)}
        className="rounded-lg border border-surface-300 bg-white px-2 py-1.5 text-sm"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </div>
  )
}

function downloadCSV(data: unknown[], filename: string) {
  const csv = Papa.unparse(data)
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  const [tab, setTab] = useState<TabId>('mensal')
  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()))
  const [categoryType, setCategoryType] = useState<'income' | 'expense'>('expense')
  const [fluxoMonths, setFluxoMonths] = useState<3 | 6 | 12>(6)
  const [trendCategoryFilter, setTrendCategoryFilter] = useState<Set<string | null>>(new Set())

  const categories = useCategories()
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  )

  const monthData = useReportsDataMonth(monthKey)
  const categoryData = useReportsDataByCategory(monthKey, categoryType)
  const rangeData = useReportsDataRange(fluxoMonths)
  const trendsData = useReportsDataTrends(monthKey)

  const trendSeriesWithNames = useMemo(
    () =>
      trendsData.series.map((s) => ({
        ...s,
        name: (s.categoryId && categoryMap.get(s.categoryId)) ?? 'Sem categoria',
      })),
    [trendsData.series, categoryMap]
  )
  useEffect(() => {
    if (trendsData.series.length > 0 && trendCategoryFilter.size === 0) {
      setTrendCategoryFilter(new Set(trendsData.series.map((s) => s.categoryId)))
    }
  }, [trendsData.series.length])
  const trendFilter = trendCategoryFilter.size > 0
    ? trendCategoryFilter
    : new Set(trendSeriesWithNames.map((s) => s.categoryId))

  const categoryRows = useMemo(
    () =>
      categoryData.byCategory.map((b) => ({
        ...b,
        categoryName: (b.categoryId && categoryMap.get(b.categoryId)) ?? 'Sem categoria',
      })),
    [categoryData.byCategory, categoryMap]
  )
  const transactionsByCategoryKey: Record<string, typeof categoryData.transactions> = useMemo(() => {
    const map: Record<string, typeof categoryData.transactions> = {}
    for (const t of categoryData.transactions) {
      const key = t.category_id ?? '_none'
      if (!map[key]) map[key] = []
      map[key].push(t)
    }
    return map
  }, [categoryData.transactions])

  const pieData = useMemo(
    () =>
      categoryRows.map((row) => ({
        categoryId: row.categoryId,
        name: row.categoryName,
        value: row.amount,
      })),
    [categoryRows]
  )

  const top5WithNames = useMemo(() => {
    return monthData.topExpenseCategories
      .map((t) => ({
        name: (t.categoryId && categoryMap.get(t.categoryId)) ?? 'Sem categoria',
        amount: t.amount,
      }))
      .filter((r) => r.amount > 0)
  }, [monthData.topExpenseCategories, categoryMap])

  const emptyMonth = monthData.transactions.length === 0
  const emptyCategory = categoryData.transactions.length === 0
  const emptyFluxo = rangeData.transactions.length === 0
  const emptyTrends = trendsData.transactions.length === 0

  const handleExportMensal = () => {
    const rows = [
      { Métrica: 'Total Receitas', Valor: monthData.income },
      { Métrica: 'Total Despesas', Valor: monthData.expense },
      { Métrica: 'Saldo do Mês', Valor: monthData.balance },
      { Métrica: 'Maior despesa', Valor: monthData.maxExpenseDescription },
      ...monthData.byWeek.map((w) => ({
        Semana: w.week,
        Receitas: w.income,
        Despesas: w.expense,
      })),
    ]
    downloadCSV(rows, `relatorio-mensal-${monthKey}.csv`)
  }

  const handleExportCategoria = () => {
    const rows = categoryRows.map((r) => ({
      Categoria: r.categoryName,
      Valor: r.amount,
      ' % do total': `${r.pct.toFixed(1)}%`,
      'Vs mês anterior': r.delta,
    }))
    downloadCSV(rows, `relatorio-categoria-${monthKey}-${categoryType}.csv`)
  }

  const handleExportFluxo = () => {
    const rows = rangeData.byMonth.map((m) => ({
      Mês: m.monthLabel,
      Receitas: m.income,
      Despesas: m.expense,
      Saldo: m.balance,
      Acumulado: m.running,
    }))
    downloadCSV(rows, `relatorio-fluxo-${fluxoMonths}-meses.csv`)
  }

  const handleExportTendencias = () => {
    const months = [...trendsData.months, 'Projeção']
    const rows = months.map((month) => {
      const row: Record<string, string | number> = { Mês: month }
      trendSeriesWithNames.forEach((s) => {
        if (month === 'Projeção') row[s.name] = s.projected ?? 0
        else row[s.name] = s.points.find((p) => p.month === month)?.amount ?? 0
      })
      return row
    })
    downloadCSV(rows, `relatorio-tendencias-${monthKey}.csv`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-surface-900">Relatórios</h1>

      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-surface-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium whitespace-nowrap',
              tab === t.id
                ? 'bg-white border border-surface-200 border-b-0 -mb-px text-primary-700'
                : 'text-surface-600 hover:bg-surface-100'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'mensal' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MonthYearPicker monthKey={monthKey} onChange={setMonthKey} />
            <Button variant="secondary" size="sm" onClick={handleExportMensal}>
              Exportar CSV
            </Button>
          </div>
          {emptyMonth ? (
            <EmptyState message="Adicione transações neste mês para ver o resumo e os gráficos." />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-surface-500">Total Receitas</p>
                    <p className="text-lg font-bold text-[var(--color-income)]">
                      {formatCurrencyFromCents(monthData.income)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-surface-500">Total Despesas</p>
                    <p className="text-lg font-bold text-[var(--color-expense)]">
                      {formatCurrencyFromCents(monthData.expense)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-surface-500">Saldo do Mês</p>
                    <p
                      className={cn(
                        'text-lg font-bold',
                        monthData.balance >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
                      )}
                    >
                      {formatCurrencyFromCents(monthData.balance)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs font-medium text-surface-500">Maior despesa</p>
                    <p className="text-sm font-semibold text-surface-900 truncate" title={monthData.maxExpenseDescription}>
                      {monthData.maxExpenseDescription}
                    </p>
                    <p className="text-sm text-[var(--color-expense)]">
                      {formatCurrencyFromCents(monthData.maxExpense)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Receitas x Despesas por semana</CardTitle>
                </CardHeader>
                <CardContent>
                  <MonthlyBarChart data={monthData.byWeek} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Top 5 despesas por categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  {top5WithNames.length === 0 ? (
                    <p className="text-surface-500 py-4">Nenhuma despesa no período.</p>
                  ) : (
                    <div className="h-56 w-full min-w-[280px] overflow-x-auto">
                      <ResponsiveContainer width="100%" height="100%" minWidth={280}>
                        <BarChart
                          layout="vertical"
                          data={top5WithNames}
                          margin={{ left: 80, right: 16, top: 8, bottom: 8 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                          <XAxis type="number" tickFormatter={(v) => formatCurrencyFromCents(Number(v))} />
                          <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: number | undefined) => (v != null ? formatCurrencyFromCents(v) : '')} />
                          <Bar dataKey="amount" fill="#ef4444" radius={[0, 4, 4, 0]} name="Valor" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {tab === 'categoria' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <MonthYearPicker monthKey={monthKey} onChange={setMonthKey} />
              <div className="flex rounded-lg border border-surface-300 p-0.5">
                <button
                  type="button"
                  onClick={() => setCategoryType('income')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md',
                    categoryType === 'income' ? 'bg-primary-600 text-white' : 'text-surface-600'
                  )}
                >
                  Receitas
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryType('expense')}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium rounded-md',
                    categoryType === 'expense' ? 'bg-primary-600 text-white' : 'text-surface-600'
                  )}
                >
                  Despesas
                </button>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleExportCategoria}>
              Exportar CSV
            </Button>
          </div>
          {emptyCategory ? (
            <EmptyState message={`Nenhuma ${categoryType === 'income' ? 'receita' : 'despesa'} neste mês.`} />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Distribuição por categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <CategoryPieChart data={pieData} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Detalhamento</CardTitle>
                </CardHeader>
                <CardContent>
                  <CategoryBreakdownTable
                    rows={categoryRows}
                    transactionsByCategory={transactionsByCategoryKey}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {tab === 'fluxo' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {([3, 6, 12] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFluxoMonths(n)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium',
                    fluxoMonths === n
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-surface-300 text-surface-600 hover:bg-surface-50'
                  )}
                >
                  {n} meses
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={handleExportFluxo}>
              Exportar CSV
            </Button>
          </div>
          {emptyFluxo ? (
            <EmptyState message="Nenhuma transação no período selecionado." />
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Fluxo de caixa</CardTitle>
                </CardHeader>
                <CardContent>
                  <CashFlowChart data={rangeData.byMonth} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Resumo por mês</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[400px] text-sm">
                      <thead>
                        <tr className="border-b border-surface-200 text-surface-600">
                          <th className="text-left py-2 px-2">Mês</th>
                          <th className="text-right py-2 px-2">Receitas</th>
                          <th className="text-right py-2 px-2">Despesas</th>
                          <th className="text-right py-2 px-2">Saldo</th>
                          <th className="text-right py-2 px-2">Acumulado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rangeData.byMonth.map((m) => (
                          <tr key={m.month} className="border-b border-surface-100">
                            <td className="py-2 px-2 font-medium">{m.monthLabel}</td>
                            <td className="text-right tabular-nums text-[var(--color-income)]">
                              {formatCurrencyFromCents(m.income)}
                            </td>
                            <td className="text-right tabular-nums text-[var(--color-expense)]">
                              {formatCurrencyFromCents(m.expense)}
                            </td>
                            <td className="text-right tabular-nums">
                              {formatCurrencyFromCents(m.balance)}
                            </td>
                            <td className="text-right tabular-nums">
                              {formatCurrencyFromCents(m.running)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {tab === 'tendencias' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <MonthYearPicker monthKey={monthKey} onChange={setMonthKey} />
            <Button variant="secondary" size="sm" onClick={handleExportTendencias}>
              Exportar CSV
            </Button>
          </div>
          {emptyTrends ? (
            <EmptyState message="Nenhuma despesa nos últimos 6 meses para exibir tendências." />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {trendSeriesWithNames.map((s) => (
                  <button
                    key={s.categoryId ?? '_none'}
                    type="button"
                    onClick={() => {
                      setTrendCategoryFilter((prev) => {
                        const next = new Set(prev)
                        if (next.has(s.categoryId)) next.delete(s.categoryId)
                        else next.add(s.categoryId)
                        return next
                      })
                    }}
                    className={cn(
                      'rounded-full px-3 py-1.5 text-sm font-medium border',
                      trendFilter.has(s.categoryId)
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-surface-300 text-surface-600'
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Evolução por categoria (últimos 6 meses)</CardTitle>
                  <p className="text-xs text-surface-500 mt-1">
                    Último ponto = projeção (média dos últimos 3 meses)
                  </p>
                </CardHeader>
                <CardContent>
                  <TrendLineChart
                    series={trendSeriesWithNames}
                    months={trendsData.months}
                    categoryFilter={trendFilter}
                  />
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  )
}
