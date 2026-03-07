import React from 'react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ProjectionResult } from '../projectionEngine'
import { formatCurrencyFromCents } from '../../../lib/utils'
import { toISODate } from '../../../lib/utils'

export interface ProjectionChartProps {
  result: ProjectionResult
  granularity: 'month' | 'day'
  onMonthClick?: (month: string) => void
}

function buildChartData(result: ProjectionResult, granularity: 'month' | 'day') {
  const todayStr = toISODate(new Date())
  const points: { date: string; balance: number; isToday?: boolean; isVirtual?: boolean }[] = []

  const starting = {
    date: result.metadata.fromDate,
    balance: result.metadata.startingBalance,
    isToday: result.metadata.fromDate === todayStr,
    isVirtual: false,
  }
  points.push(starting)

  if (granularity === 'day') {
    for (const e of result.dailyEntries) {
      points.push({
        date: e.date,
        balance: e.balanceAfter,
        isToday: e.date === todayStr,
        isVirtual: e.is_virtual,
      })
    }
  } else {
    for (const me of result.monthlyEntries) {
      const lastDay = me.month + '-28'
      points.push({
        date: lastDay,
        balance: me.closing_balance,
        isToday: me.month === todayStr.slice(0, 7),
        isVirtual: me.is_virtual,
      })
    }
  }

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export const ProjectionChart = React.memo(function ProjectionChart({
  result,
  granularity,
  onMonthClick,
}: ProjectionChartProps) {
  const data = React.useMemo(
    () => buildChartData(result, granularity),
    [result, granularity]
  )
  const todayStr = toISODate(new Date())

  const formatTick = (value: string) => {
    if (granularity === 'month') {
      const [y, m] = value.slice(0, 7).split('-').map(Number)
      return format(new Date(y, m - 1, 1), 'MMM/yy', { locale: ptBR })
    }
    return format(new Date(value + 'T12:00:00'), 'dd/MM', { locale: ptBR })
  }

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          onClick={(state) => {
            const idx = state?.activeTooltipIndex ?? state?.activeIndex
            if (typeof idx === 'number' && data[idx] && granularity === 'month' && onMonthClick) {
              onMonthClick(data[idx].date.slice(0, 7))
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-surface-200" />
          <XAxis
            dataKey="date"
            tickFormatter={formatTick}
            className="text-xs fill-surface-600"
          />
          <YAxis
            tickFormatter={(v) => formatCurrencyFromCents(v).replace(/\s/g, '\u00A0')}
            width={90}
            className="text-xs fill-surface-600"
          />
          <ReferenceArea y1={0} y2="dataMax" fill="#10b981" fillOpacity={0.12} />
          <ReferenceArea y1="dataMin" y2={0} fill="#ef4444" fillOpacity={0.12} />
          <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
          <ReferenceLine
            x={todayStr}
            stroke="#64748b"
            strokeDasharray="4 4"
            strokeWidth={1.5}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const p = payload[0].payload
              const monthEntry = result.monthlyEntries.find(
                (me) => me.month === p.date.slice(0, 7)
              )
              return (
                <div className="rounded-lg border border-surface-200 bg-white p-3 shadow-lg text-sm">
                  <p className="font-medium text-surface-900">
                    {format(new Date(p.date + 'T12:00:00'), "dd 'de' MMMM 'de' yyyy", {
                      locale: ptBR,
                    })}
                  </p>
                  <p className="text-surface-600">
                    Saldo: {formatCurrencyFromCents(p.balance)}
                  </p>
                  {monthEntry && (
                    <>
                      <p className="text-green-600">
                        Receitas: {formatCurrencyFromCents(monthEntry.income)}
                      </p>
                      <p className="text-red-600">
                        Despesas: {formatCurrencyFromCents(monthEntry.expenses)}
                      </p>
                    </>
                  )}
                </div>
              )
            }}
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
})
