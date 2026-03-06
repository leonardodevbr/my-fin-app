import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatCurrencyFromCents } from '../../../lib/utils'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const COLORS = [
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#6366f1',
]

export interface TrendSeries {
  categoryId: string | null
  name: string
  points: { month: string; amount: number }[]
  projected: number | null
}

export interface TrendLineChartProps {
  series: TrendSeries[]
  months: string[]
  categoryFilter: Set<string | null>
  empty?: boolean
}

export function TrendLineChart({
  series,
  months,
  categoryFilter,
  empty,
}: TrendLineChartProps) {
  if (empty || !months.length) return null

  const filteredSeries = series.filter((s) =>
    categoryFilter.has(s.categoryId)
  )
  if (!filteredSeries.length) return null

  const chartData = months.map((month) => {
    const label = format(parseISO(month + '-01'), 'MMM yy', { locale: ptBR })
    const point: Record<string, string | number> = { month: label, _monthKey: month }
    filteredSeries.forEach((s) => {
      const pt = s.points.find((p) => p.month === month)
      point[s.name] = pt?.amount ?? 0
    })
    return point
  })

  const projectedPoint: Record<string, string | number> = {
    month: 'Projeção',
    _monthKey: '_proj',
  }
  filteredSeries.forEach((s) => {
    projectedPoint[s.name] = s.projected ?? 0
  })
  const dataWithProjection = [...chartData, projectedPoint]

  return (
    <div className="h-80 w-full min-w-[320px] overflow-x-auto">
      <ResponsiveContainer width="100%" height="100%" minWidth={320}>
        <LineChart data={dataWithProjection} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={(v) => formatCurrencyFromCents(Number(v))}
            tick={{ fontSize: 11 }}
            width={72}
          />
          <Tooltip
            formatter={(v: number | undefined) => (v != null ? formatCurrencyFromCents(v) : '')}
            labelFormatter={(label) => label}
          />
          <Legend />
          {filteredSeries.map((s) => (
            <Line
              key={s.categoryId ?? s.name}
              type="monotone"
              dataKey={s.name}
              name={s.name}
              stroke={COLORS[filteredSeries.indexOf(s) % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
