import { useAccounts } from '../../hooks/useAccounts'
import { useTransactions } from '../../hooks/useTransactions'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { formatCurrencyFromCents } from '../../lib/utils'

export function DashboardPage() {
  const accounts = useAccounts(false)
  const transactions = useTransactions()

  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0)
  const recentCount = transactions.length

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Saldo total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-primary-600">{formatCurrencyFromCents(totalBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Contas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-surface-700">{accounts.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Transações (total)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-surface-700">{recentCount}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
