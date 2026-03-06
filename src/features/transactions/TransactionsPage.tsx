import { useSearchParams } from 'react-router-dom'
import { useTransactions } from '../../hooks/useTransactions'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { formatCurrency, formatDate } from '../../lib/utils'

export function TransactionsPage() {
  const [searchParams] = useSearchParams()
  const accountId = searchParams.get('account') ?? undefined
  const transactions = useTransactions(accountId ? { accountId } : undefined)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-surface-900">Transações</h1>
      <Card>
        <CardHeader>
          <CardTitle>Lista de transações</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-surface-500 py-4">Nenhuma transação cadastrada.</p>
          ) : (
            <ul className="divide-y divide-surface-200">
              {transactions.map((t) => (
                <li key={t.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-surface-900">{t.description}</p>
                    <p className="text-sm text-surface-500">{formatDate(t.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.type === 'income' ? 'income' : t.type === 'expense' ? 'expense' : 'transfer'}>
                      {t.type}
                    </Badge>
                    <span
                      className={
                        t.type === 'income'
                          ? 'text-[var(--color-income)]'
                          : t.type === 'expense'
                            ? 'text-[var(--color-expense)]'
                            : 'text-[var(--color-transfer)]'
                      }
                    >
                      {t.type === 'expense' ? '-' : '+'}
                      {formatCurrency(t.amount)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
