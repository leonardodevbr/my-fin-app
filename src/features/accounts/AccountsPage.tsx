import { useAccounts } from '../../hooks/useAccounts'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { formatCurrency } from '../../lib/utils'

export function AccountsPage() {
  const accounts = useAccounts(false)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-surface-900">Contas</h1>
      <Card>
        <CardHeader>
          <CardTitle>Minhas contas</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-surface-500 py-4">Nenhuma conta cadastrada.</p>
          ) : (
            <ul className="divide-y divide-surface-200">
              {accounts.map((a) => (
                <li key={a.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: a.color }}
                    >
                      {a.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium text-surface-900">{a.name}</p>
                      <p className="text-sm text-surface-500">{a.type}</p>
                    </div>
                  </div>
                  <span className="font-semibold text-surface-900">{formatCurrency(a.balance, a.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
