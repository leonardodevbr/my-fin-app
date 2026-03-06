import { useTransactions } from '../../hooks/useTransactions'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '../../lib/utils'
import { useMemo } from 'react'

export function ReportsPage() {
  const transactions = useTransactions()

  const byType = useMemo(() => {
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const transfer = transactions.filter((t) => t.type === 'transfer').reduce((s, t) => s + t.amount, 0)
    return [
      { name: 'Receitas', value: income, fill: 'var(--color-income)' },
      { name: 'Despesas', value: expense, fill: 'var(--color-expense)' },
      { name: 'Transferências', value: transfer, fill: 'var(--color-transfer)' },
    ]
  }, [transactions])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-surface-900">Relatórios</h1>
      <Card>
        <CardHeader>
          <CardTitle>Resumo por tipo</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-surface-500 py-4">Adicione transações para ver os relatórios.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byType} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => (v != null ? formatCurrency(Number(v)) : '')} />
                  <Bar dataKey="value" name="Total" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
