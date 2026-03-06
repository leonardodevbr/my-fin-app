import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrencyFromCents } from '../../../lib/utils'

const DEFAULT_COLORS = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
]

export interface CategorySlice {
  categoryId: string | null
  name: string
  value: number
  color?: string
}

export interface CategoryPieChartProps {
  data: CategorySlice[]
  empty?: boolean
}

export function CategoryPieChart({ data, empty }: CategoryPieChartProps) {
  if (empty || !data.length) return null
  const chartData = data.map((d, i) => ({
    ...d,
    fill: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }))
  return (
    <div className="h-72 w-full min-w-[280px] overflow-x-auto">
      <ResponsiveContainer width="100%" height="100%" minWidth={280}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.categoryId ?? index} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number | undefined) => (v != null ? formatCurrencyFromCents(v) : '')} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
