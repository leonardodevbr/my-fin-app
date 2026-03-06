import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Transaction } from '../../db'
import { useTransactions } from '../../hooks/useTransactions'
import { updateTransaction, deleteTransaction, deleteTransactionGroup, getTransactionsByGroupId } from '../../hooks/useTransactions'
import { useDebounce } from '../../hooks/useDebounce'
import { monthRange, toMonthKey } from '../../lib/utils'
import { TransactionFilters, type TransactionFilter } from './TransactionFilters'
import { TransactionList } from './TransactionList'
import { TransactionFormModal } from './TransactionFormModal'
import { Button } from '../../components/ui/Button'
import toast from 'react-hot-toast'

function TransactionsMonthNavigator({
  monthKey,
  onPrev,
  onNext,
}: {
  monthKey: string
  onPrev: () => void
  onNext: () => void
}) {
  const label = (() => {
    try {
      const [y, m] = monthKey.split('-').map(Number)
      return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: ptBR })
    } catch {
      return monthKey
    }
  })()
  const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-surface-200 bg-white px-3 py-2 shadow-sm">
      <button
        type="button"
        onClick={onPrev}
        className="rounded-lg p-1.5 text-surface-600 hover:bg-surface-100"
        aria-label="Mês anterior"
      >
        ‹
      </button>
      <span className="min-w-[120px] text-center text-sm font-semibold text-surface-900">
        {capFirst(label)}
      </span>
      <button
        type="button"
        onClick={onNext}
        className="rounded-lg p-1.5 text-surface-600 hover:bg-surface-100"
        aria-label="Mês seguinte"
      >
        ›
      </button>
    </div>
  )
}

export function TransactionsPage() {
  const [searchParams] = useSearchParams()
  const accountIdParam = searchParams.get('account') ?? undefined

  const [transactionMonth, setTransactionMonth] = useState(() => toMonthKey(new Date()))
  const [filter, setFilter] = useState<TransactionFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)

  const [formOpen, setFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const [deleteState, setDeleteState] = useState<{
    open: boolean
    transaction: Transaction
    hasGroup: boolean
  } | null>(null)

  const [from, to] = monthRange(transactionMonth)
  const rawTransactions = useTransactions({
    from,
    to,
    accountId: accountIdParam,
  })

  const transactions = useMemo(() => {
    let list = rawTransactions

    if (filter !== 'all') {
      if (filter === 'unpaid') {
        list = list.filter((t) => !t.is_paid)
      } else {
        list = list.filter((t) => t.type === filter)
      }
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter((t) => t.description.toLowerCase().includes(q))
    }

    return list
  }, [rawTransactions, filter, debouncedSearch])

  const handleEdit = (t: Transaction) => {
    setEditingTransaction(t)
    setFormOpen(true)
  }

  const handleNew = () => {
    setEditingTransaction(null)
    setFormOpen(true)
  }

  const handleSaved = () => {
    setFormOpen(false)
    setEditingTransaction(null)
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
    setDeleteState({
      open: true,
      transaction: t,
      hasGroup: group.length > 1,
    })
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

  const addMonth = (delta: number) => {
    const [y, m] = transactionMonth.split('-').map(Number)
    const d = new Date(y, m - 1, 1)
    d.setMonth(d.getMonth() + delta)
    setTransactionMonth(toMonthKey(d))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TransactionsMonthNavigator
          monthKey={transactionMonth}
          onPrev={() => addMonth(-1)}
          onNext={() => addMonth(1)}
        />
        <Button
          onClick={handleNew}
          className="hidden sm:inline-flex"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova transação
        </Button>
      </div>

      <TransactionFilters value={filter} onChange={setFilter} />

      <input
        type="search"
        placeholder="Buscar por descrição..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-surface-900 placeholder:text-surface-400"
      />

      <TransactionList
        transactions={transactions}
        onEdit={handleEdit}
        onTogglePaid={handleTogglePaid}
        onDelete={handleDeleteClick}
      />

      <TransactionFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingTransaction(null)
        }}
        transaction={editingTransaction}
        onSaved={handleSaved}
      />

      {/* FAB mobile */}
      <button
        type="button"
        onClick={handleNew}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg sm:hidden hover:bg-primary-600"
        aria-label="Nova transação"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Delete confirm */}
      {deleteState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-surface-900">Excluir transação?</h3>
            <p className="mt-2 text-sm text-surface-600">
              {deleteState.hasGroup
                ? 'Esta transação faz parte de um parcelamento. Deseja excluir só esta parcela ou todas as parcelas?'
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
