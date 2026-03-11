import { useState, useMemo } from 'react'
import { Plus, CheckSquare, SlidersHorizontal } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Transaction } from '../../db'
import { useTransactions } from '../../hooks/useTransactions'
import { updateTransaction, deleteTransaction, deleteTransactionGroup, getTransactionsByGroupId } from '../../hooks/useTransactions'
import { useDebounce } from '../../hooks/useDebounce'
import { monthRange, toMonthKey, formatCurrencyFromCents } from '../../lib/utils'
import { TransactionFilters, type TransactionFilter } from './TransactionFilters'
import { TransactionList } from './TransactionList'
import { TransactionFormModal } from './TransactionFormModal'
import { Button } from '../../components/ui/Button'
import { cn } from '../../lib/utils'
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
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)

  const [formOpen, setFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)

  const [deleteState, setDeleteState] = useState<{
    open: boolean
    transaction: Transaction
    hasGroup: boolean
  } | null>(null)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const defaultTypeForNew: 'income' | 'expense' | 'transfer' =
    filter === 'income' || filter === 'expense' || filter === 'transfer' ? filter : 'expense'

  const [from, to] = monthRange(transactionMonth)
  const rawTransactions = useTransactions({
    from,
    to,
    accountId: accountIdParam,
  })

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of rawTransactions) {
      for (const tag of t.tags ?? []) {
        if (tag.trim()) set.add(tag)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [rawTransactions])

  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (paidFilter !== 'all') count += 1
    count += tagFilter.length
    return count
  }, [paidFilter, tagFilter])

  const transactions = useMemo(() => {
    let list = rawTransactions

    if (filter !== 'all') {
      list = list.filter((t) => t.type === filter)
    }

    if (paidFilter === 'paid') {
      list = list.filter((t) => t.is_paid)
    } else if (paidFilter === 'unpaid') {
      list = list.filter((t) => !t.is_paid)
    }

    if (tagFilter.length > 0) {
      list = list.filter((t) => (t.tags ?? []).some((tag) => tagFilter.includes(tag)))
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      list = list.filter((t) => t.description.toLowerCase().includes(q))
    }

    return list
  }, [rawTransactions, filter, debouncedSearch])

  const periodTotals = useMemo(() => {
    let income = 0
    let expense = 0
    let transfer = 0
    for (const t of transactions) {
      if (t.type === 'income') income += t.amount
      else if (t.type === 'expense') expense += t.amount
      else transfer += t.amount
    }
    return { income, expense, transfer }
  }, [transactions])

  const periodNet = useMemo(() => {
    let projected = 0
    let consolidated = 0
    for (const t of transactions) {
      const delta = t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0
      projected += delta
      if (t.is_paid) consolidated += delta
    }
    return { projected, consolidated }
  }, [transactions])

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

  const handleToggleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const handleBulkMarkPaid = async () => {
    const ids = Array.from(selectedIds)
    try {
      for (const id of ids) {
        await updateTransaction(id, { is_paid: true })
      }
      toast.success(ids.length === 1 ? 'Marcada como paga' : `${ids.length} transações marcadas como pagas`)
      setSelectedIds(new Set())
      setSelectionMode(false)
    } catch {
      toast.error('Erro ao atualizar')
    }
  }

  const handleBulkDeleteClick = () => {
    setBulkDeleteOpen(true)
  }

  const confirmBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    try {
      for (const id of ids) {
        await deleteTransaction(id)
      }
      toast.success(ids.length === 1 ? 'Transação excluída' : `${ids.length} transações excluídas`)
      setSelectedIds(new Set())
      setSelectionMode(false)
      setBulkDeleteOpen(false)
    } catch {
      toast.error('Erro ao excluir')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TransactionsMonthNavigator
          monthKey={transactionMonth}
          onPrev={() => addMonth(-1)}
          onNext={() => addMonth(1)}
        />
        <div className="flex items-center gap-2">
          {!selectionMode ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectionMode(true)}
              className="inline-flex outline-none focus:outline-none focus:ring-0"
              aria-label="Selecionar transações"
            >
              <CheckSquare className="h-4 w-4 mr-1.5" />
              Selecionar
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => { setSelectionMode(false); setSelectedIds(new Set()) }}>
              Cancelar seleção
            </Button>
          )}
          <Button
            onClick={handleNew}
            className={cn(
              'hidden sm:inline-flex text-white hover:opacity-90',
              defaultTypeForNew === 'income' && 'bg-[var(--color-income)]',
              defaultTypeForNew === 'expense' && 'bg-[var(--color-expense)]',
              defaultTypeForNew === 'transfer' && 'bg-[var(--color-transfer)]'
            )}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova transação
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <TransactionFilters value={filter} onChange={setFilter} />
        <button
          type="button"
          onClick={() => setFiltersOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-surface-300 bg-white px-3 py-1.5 text-xs font-medium text-surface-700 shadow-sm"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtros
          {activeFiltersCount > 0 && (
            <span className="ml-1 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-semibold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      <input
        type="search"
        placeholder="Buscar por descrição..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-surface-900 placeholder:text-surface-400"
      />

      <div className="flex flex-nowrap items-center gap-x-2 overflow-x-auto rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm min-w-0">
        <span className="font-medium text-surface-600 shrink-0">Receitas</span>
        <span className="font-semibold tabular-nums text-[var(--color-income)] shrink-0">
          {formatCurrencyFromCents(periodTotals.income)}
        </span>
        <span className="text-surface-400 shrink-0">/</span>
        <span className="font-medium text-surface-600 shrink-0">Despesas</span>
        <span className="font-semibold tabular-nums text-[var(--color-expense)] shrink-0">
          {formatCurrencyFromCents(periodTotals.expense)}
        </span>
        {periodTotals.transfer !== 0 && (
          <>
            <span className="text-surface-400 shrink-0">/</span>
            <span className="font-medium text-surface-600 shrink-0">Transferências</span>
            <span className="font-semibold tabular-nums text-[var(--color-transfer)] shrink-0">
              {formatCurrencyFromCents(periodTotals.transfer)}
            </span>
          </>
        )}
      </div>

      <div className="flex flex-nowrap items-center gap-x-2 overflow-x-auto rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-xs min-w-0">
        <span className="font-medium text-surface-600 shrink-0">Resultado consolidado</span>
        <span
          className={cn(
            'font-semibold tabular-nums shrink-0',
            periodNet.consolidated >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
          )}
        >
          {periodNet.consolidated >= 0 ? '+' : ''}
          {formatCurrencyFromCents(periodNet.consolidated)}
        </span>
        <span className="text-surface-400 shrink-0">/</span>
        <span className="font-medium text-surface-600 shrink-0">Resultado previsto</span>
        <span
          className={cn(
            'font-semibold tabular-nums shrink-0',
            periodNet.projected >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
          )}
        >
          {periodNet.projected >= 0 ? '+' : ''}
          {formatCurrencyFromCents(periodNet.projected)}
        </span>
      </div>

      <TransactionList
        transactions={transactions}
        onEdit={handleEdit}
        onTogglePaid={handleTogglePaid}
        onDelete={handleDeleteClick}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
        onToggleSelect={selectionMode ? handleToggleSelect : undefined}
        onBulkMarkPaid={selectionMode && selectedIds.size > 0 ? handleBulkMarkPaid : undefined}
        onBulkDelete={selectionMode && selectedIds.size > 0 ? handleBulkDeleteClick : undefined}
        onCancelSelection={selectionMode ? () => { setSelectionMode(false); setSelectedIds(new Set()) } : undefined}
        onLongPressSelect={(id) => {
          setSelectionMode(true)
          setSelectedIds(new Set([id]))
        }}
      />

      <TransactionFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingTransaction(null)
        }}
        transaction={editingTransaction}
        defaultType={defaultTypeForNew}
        onSaved={handleSaved}
      />

      {/* FAB mobile: cor conforme tipo (despesa=vermelho, receita=verde, transferência=azul) */}
      <button
        type="button"
        onClick={handleNew}
        className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg sm:hidden hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
        style={{
          backgroundColor:
            defaultTypeForNew === 'income'
              ? 'var(--color-income)'
              : defaultTypeForNew === 'expense'
                ? 'var(--color-expense)'
                : 'var(--color-transfer)',
        }}
        aria-label="Nova transação"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Bulk delete confirm */}
      {bulkDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-surface-900">Excluir transações?</h3>
            <p className="mt-2 text-sm text-surface-600">
              {selectedIds.size} {selectedIds.size === 1 ? 'transação será excluída' : 'transações serão excluídas'}. Esta ação não pode ser desfeita.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button variant="danger" onClick={confirmBulkDelete} className="w-full">
                Excluir
              </Button>
              <Button variant="ghost" onClick={() => setBulkDeleteOpen(false)} className="w-full">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm (single) */}
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

      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-lg font-semibold text-surface-900">Filtros</h3>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-surface-600 mb-1">Pagamento</p>
                <div className="flex gap-2">
                  {[
                    { value: 'all', label: 'Todos' },
                    { value: 'paid', label: 'Pagos' },
                    { value: 'unpaid', label: 'Pendentes' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaidFilter(opt.value as 'all' | 'paid' | 'unpaid')}
                      className={cn(
                        'flex-1 rounded-full px-3 py-1.5 text-xs font-medium border',
                        paidFilter === opt.value
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-surface-300 bg-surface-100 text-surface-700'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {allTags.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-surface-600 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map((tag) => {
                      const active = tagFilter.includes(tag)
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setTagFilter((prev) =>
                              prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                            )
                          }
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-medium border',
                            active
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-surface-300 bg-surface-100 text-surface-700'
                          )}
                        >
                          {tag}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setPaidFilter('all')
                  setTagFilter([])
                }}
                className="w-full"
              >
                Limpar filtros
              </Button>
              <Button
                onClick={() => setFiltersOpen(false)}
                className="w-full"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
