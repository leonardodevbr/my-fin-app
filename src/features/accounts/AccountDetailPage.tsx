import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart3, List, ArrowLeft } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Transaction } from '../../db'
import { useAccount } from '../../hooks/useAccounts'
import { useAccountBalance } from '../../hooks/useAccounts'
import { useTransactions } from '../../hooks/useTransactions'
import { updateTransaction, deleteTransaction, deleteTransactionGroup, getTransactionsByGroupId } from '../../hooks/useTransactions'
import { useAccountMonthlySummary } from './useAccountMonthlySummary'
import { formatCurrencyFromCents, monthRange, toMonthKey } from '../../lib/utils'
import { ACCOUNT_TYPE_LABELS } from './constants'
import { TransactionList } from '../transactions/TransactionList'
import { TransactionFormModal } from '../transactions/TransactionFormModal'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

const INCOME = '#10b981'
const EXPENSE = '#ef4444'

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const accountId = id ?? null
  const account = useAccount(accountId)
  const { balancePaid, balanceProjected } = useAccountBalance(accountId)
  const monthlyData = useAccountMonthlySummary(accountId, 6)

  const [tab, setTab] = useState<'transactions' | 'summary'>('transactions')
  const [transactionMonth, setTransactionMonth] = useState(() => toMonthKey(new Date()))
  const [formOpen, setFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [deleteState, setDeleteState] = useState<{
    open: boolean
    transaction: Transaction
    hasGroup: boolean
  } | null>(null)

  const [from, to] = monthRange(transactionMonth)
  const rawTransactions = useTransactions({ from, to, accountId: accountId ?? undefined })
  const transactions = useMemo(() => rawTransactions, [rawTransactions])

  const handleEdit = (t: Transaction) => {
    setEditingTransaction(t)
    setFormOpen(true)
  }

  const handleTogglePaid = async (t: Transaction) => {
    try {
      await updateTransaction(t.id, { is_paid: !t.is_paid })
      toast.success(t.is_paid ? 'Marcada como a pagar' : 'Marcada como paga')
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  const handleDeleteClick = async (t: Transaction) => {
    const group = t.group_id ? await getTransactionsByGroupId(t.group_id) : []
    setDeleteState({ open: true, transaction: t, hasGroup: group.length > 1 })
  }

  const confirmDeleteOne = async () => {
    if (!deleteState) return
    try {
      await deleteTransaction(deleteState.transaction.id)
      toast.success('Transação excluída')
    } catch {
      toast.error('Erro ao excluir')
    }
    setDeleteState(null)
  }

  const confirmDeleteAll = async () => {
    if (!deleteState?.transaction.group_id) return
    try {
      await deleteTransactionGroup(deleteState.transaction.group_id)
      toast.success('Parcelas excluídas')
    } catch {
      toast.error('Erro ao excluir')
    }
    setDeleteState(null)
  }

  if (!accountId || (!account && accountId)) {
    return (
      <div className="space-y-4">
        <p className="text-surface-500">Conta não encontrada.</p>
        <Link to="/accounts" className="text-primary-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Voltar às contas
        </Link>
      </div>
    )
  }

  const currency = account?.currency ?? 'BRL'

  return (
    <div className="space-y-6">
      <Link
        to="/accounts"
        className="inline-flex items-center gap-1 text-sm text-surface-600 hover:text-surface-900"
      >
        <ArrowLeft className="h-4 w-4" /> Contas
      </Link>

      <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
        <h1 className="text-xl font-bold text-surface-900">{account?.name ?? '—'}</h1>
        <p className="text-sm text-surface-500 mt-0.5">
          {account ? ACCOUNT_TYPE_LABELS[account.type] : '—'}
        </p>
        <div className="mt-3 flex flex-col gap-1">
          <p className="text-sm text-surface-600">
            Saldo atual:{' '}
            <span
              className={cn(
                'font-semibold tabular-nums',
                balancePaid >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
              )}
            >
              {formatCurrencyFromCents(balancePaid, currency)}
            </span>
          </p>
          <p className="text-sm text-surface-600">
            Saldo previsto:{' '}
            <span
              className={cn(
                'font-semibold tabular-nums',
                balanceProjected >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
              )}
            >
              {formatCurrencyFromCents(balanceProjected, currency)}
            </span>
          </p>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-200">
        <button
          type="button"
          onClick={() => setTab('transactions')}
          className={cn(
            'flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium',
            tab === 'transactions'
              ? 'bg-white border border-surface-200 border-b-0 -mb-px text-primary-700'
              : 'text-surface-600 hover:bg-surface-100'
          )}
        >
          <List className="h-4 w-4" />
          Lançamentos
        </button>
        <button
          type="button"
          onClick={() => setTab('summary')}
          className={cn(
            'flex items-center gap-2 rounded-t-lg px-3 py-2 text-sm font-medium',
            tab === 'summary'
              ? 'bg-white border border-surface-200 border-b-0 -mb-px text-primary-700'
              : 'text-surface-600 hover:bg-surface-100'
          )}
        >
          <BarChart3 className="h-4 w-4" />
          Resumo mensal
        </button>
      </div>

      {tab === 'transactions' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={transactionMonth}
              onChange={(e) => setTransactionMonth(e.target.value || toMonthKey(new Date()))}
              className="rounded-lg border border-surface-300 px-2 py-1.5 text-sm"
            />
          </div>
          <TransactionList
            transactions={transactions}
            onEdit={handleEdit}
            onTogglePaid={handleTogglePaid}
            onDelete={handleDeleteClick}
          />
        </>
      )}

      {tab === 'summary' && (
        <div className="rounded-xl border border-surface-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-surface-700 mb-4">Receitas x Despesas por mês</h2>
          {monthlyData.length === 0 ? (
            <p className="text-surface-500 py-6 text-center">Nenhum lançamento no período.</p>
          ) : (
            <div className="h-64 w-full min-w-[280px] overflow-x-auto">
              <ResponsiveContainer width="100%" height="100%" minWidth={280}>
                <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) => formatCurrencyFromCents(Number(v))}
                    tick={{ fontSize: 11 }}
                    width={72}
                  />
                  <Tooltip
                    formatter={(v: number | undefined) => (v != null ? formatCurrencyFromCents(v) : '')}
                  />
                  <Bar dataKey="income" name="Receitas" fill={INCOME} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Despesas" fill={EXPENSE} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <TransactionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        transaction={editingTransaction}
        onSaved={() => setFormOpen(false)}
      />

      {deleteState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-surface-900">Excluir transação?</h3>
            <p className="mt-2 text-sm text-surface-600">
              {deleteState.hasGroup
                ? 'Excluir só esta parcela ou todas as parcelas?'
                : 'Esta ação não pode ser desfeita.'}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {deleteState.hasGroup && (
                <Button variant="danger" onClick={confirmDeleteAll} className="w-full">
                  Excluir todas as parcelas
                </Button>
              )}
              <Button
                variant={deleteState.hasGroup ? 'secondary' : 'danger'}
                onClick={confirmDeleteOne}
                className="w-full"
              >
                {deleteState.hasGroup ? 'Excluir só esta' : 'Excluir'}
              </Button>
              <Button variant="ghost" onClick={() => setDeleteState(null)} className="w-full">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
