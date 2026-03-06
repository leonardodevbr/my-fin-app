import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { formatCurrency } from '../../lib/utils'

export function BudgetsPage() {
  const budgets = useLiveQuery(() => db.budgets.orderBy('month').reverse().toArray(), [])

  const list = budgets ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-surface-900">Orçamentos</h1>
      <Card>
        <CardHeader>
          <CardTitle>Orçamentos por mês</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-surface-500 py-4">Nenhum orçamento cadastrado.</p>
          ) : (
            <ul className="divide-y divide-surface-200">
              {list.map((b) => (
                <li key={b.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                  <span className="text-surface-700">Categoria {b.category_id} — {b.month}</span>
                  <span className="font-semibold text-surface-900">{formatCurrency(b.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
