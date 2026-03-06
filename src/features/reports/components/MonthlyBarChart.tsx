import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatCurrencyFromCents } from '../../../lib/utils'

const INCOME = '#10b981'
const EXPENSE = '#ef4444'

export interface WeeklyDatum {
  week: string
  income: number
  expense: number
}

export interface MonthlyBarChartProps {
  data: WeeklyDatum[]
  empty?: boolean
}

export function MonthlyBarChart({ data, empty }: MonthlyBarChartProps) {
  if (empty || !data.length) return null
  return (
    <div className="h-64 w-full min-w-[280px] overflow-x-auto">
      <ResponsiveContainer width="100%" height="100%" minWidth={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="week" tick={{ fontSize: 12 }} />
          <YAxis
            tickFormatter={(v) => formatCurrencyFromCents(Number(v))}
            tick={{ fontSize: 12 }}
            width={72}
          />
          <Tooltip
            formatter={(v: number | undefined) => (v != null ? formatCurrencyFromCents(v) : '')}
            labelFormatter={(label) => label}
          />
          <Legend />
          <Bar dataKey="income" name="Receitas" fill={INCOME} radius={[4, 4, 0, 0]} />
          <Bar dataKey="expense" name="Despesas" fill={EXPENSE} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
