import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts'
import { formatCurrencyFromCents } from '../../../lib/utils'

const INCOME = '#10b981'
const EXPENSE = '#ef4444'
const BALANCE = '#6366f1'

export interface CashFlowDatum {
  month: string
  monthLabel: string
  income: number
  expense: number
  balance: number
  running: number
}

export interface CashFlowChartProps {
  data: CashFlowDatum[]
  empty?: boolean
}

export function CashFlowChart({ data, empty }: CashFlowChartProps) {
  if (empty || !data.length) return null
  return (
    <div className="h-80 w-full min-w-[320px] overflow-x-auto">
      <ResponsiveContainer width="100%" height="100%" minWidth={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={(v) => formatCurrencyFromCents(Number(v))}
            tick={{ fontSize: 11 }}
            width={72}
          />
          <Tooltip
            formatter={(v: number | undefined) => (v != null ? formatCurrencyFromCents(v) : '')}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.monthLabel ?? ''}
          />
          <Area
            type="monotone"
            dataKey="income"
            name="Receitas"
            fill={INCOME}
            fillOpacity={0.4}
            stroke={INCOME}
            strokeWidth={1}
          />
          <Area
            type="monotone"
            dataKey="expense"
            name="Despesas"
            fill={EXPENSE}
            fillOpacity={0.4}
            stroke={EXPENSE}
            strokeWidth={1}
          />
          <Line
            type="monotone"
            dataKey="running"
            name="Saldo acumulado"
            stroke={BALANCE}
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
