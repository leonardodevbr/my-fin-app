import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { addMonths } from 'date-fns'
import { computeProjection } from '../projection/projectionEngine'
import { formatCurrencyFromCents } from '../../lib/utils'
import { toISODate } from '../../lib/utils'

export function QuickProjectionCard() {
  const [balances, setBalances] = useState<{ month: string; label: string; balance: number }[] | null>(null)

  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const from = toISODate(today)
    const to = toISODate(addMonths(today, 3))
    computeProjection(from, to)
      .then((result) => {
        const next3 = result.monthlyEntries.slice(0, 3).map((me) => {
          const [y, m] = me.month.split('-').map(Number)
          const label = format(new Date(y, m - 1, 1), 'MMM/yy', { locale: ptBR })
          return { month: me.month, label, balance: me.closing_balance }
        })
        setBalances(next3)
      })
      .catch(() => setBalances(null))
  }, [])

  return (
    <section className="rounded-xl border border-surface-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-surface-900">Projeção rápida</h2>
        <Link
          to="/projection"
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Ver projeção completa →
        </Link>
      </div>
      {balances == null ? (
        <p className="text-sm text-surface-500">Carregando…</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {balances.map(({ month, label, balance }) => (
            <div
              key={month}
              className="rounded-lg bg-surface-50 px-3 py-2 border border-surface-100"
            >
              <p className="text-xs text-surface-500 uppercase tracking-wide">{label}</p>
              <p
                className={`text-sm font-semibold ${
                  balance < 0 ? 'text-red-600' : 'text-surface-900'
                }`}
              >
                {formatCurrencyFromCents(balance)}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
