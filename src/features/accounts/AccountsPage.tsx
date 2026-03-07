import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAccounts, useTotalBalance, updateAccount } from '../../hooks/useAccounts'
import { formatCurrencyFromCents } from '../../lib/utils'
import { AccountCard } from './AccountCard'
import { AccountFormModal } from './AccountFormModal'
import type { Account } from '../../db'
import { cn } from '../../lib/utils'

type Segment = 'all' | 'checking' | 'cash' | 'investment'

const SEGMENTS: { id: Segment; label: string; types: Account['type'][] }[] = [
  { id: 'all', label: 'Todas', types: ['checking', 'savings', 'credit', 'cash', 'investment'] },
  { id: 'checking', label: 'Corrente/Digital', types: ['checking', 'savings', 'credit'] },
  { id: 'cash', label: 'Carteira', types: ['cash'] },
  { id: 'investment', label: 'Investimento', types: ['investment'] },
]

export function AccountsPage() {
  const [segment, setSegment] = useState<Segment>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const accounts = useAccounts(false)
  const totalBalance = useTotalBalance()

  const filteredAccounts = useMemo(() => {
    const seg = SEGMENTS.find((s) => s.id === segment)
    if (!seg || seg.id === 'all') return accounts
    return accounts.filter((a) => seg.types.includes(a.type))
  }, [accounts, segment])

  const handleEdit = (account: Account) => {
    setEditingAccount(account)
    setFormOpen(true)
  }

  const handleArchive = async (account: Account) => {
    try {
      await updateAccount(account.id, { is_active: false })
      toast.success('Conta arquivada')
    } catch {
      toast.error('Erro ao arquivar')
    }
  }

  const handleNew = () => {
    setEditingAccount(null)
    setFormOpen(true)
  }

  const handleSaved = () => {
    setFormOpen(false)
    setEditingAccount(null)
  }

  return (
    <div className="space-y-6 pb-20">
      <h1 className="text-2xl font-bold text-surface-900">Contas</h1>

      <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-surface-500">Saldo total (contas ativas)</p>
        <p
          className={cn(
            'text-2xl font-bold tabular-nums',
            totalBalance >= 0 ? 'text-[var(--color-income)]' : 'text-[var(--color-expense)]'
          )}
        >
          {formatCurrencyFromCents(totalBalance)}
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-surface-200">
        {SEGMENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSegment(s.id)}
            className={cn(
              'rounded-t-lg px-3 py-2 text-sm font-medium whitespace-nowrap',
              segment === s.id
                ? 'bg-white border border-surface-200 border-b-0 -mb-px text-primary-700'
                : 'text-surface-600 hover:bg-surface-100'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {filteredAccounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50/50 py-12 text-center">
          <p className="text-surface-600 font-medium">
            {accounts.length === 0 ? 'Nenhuma conta cadastrada.' : 'Nenhuma conta neste filtro.'}
          </p>
          <p className="text-sm text-surface-500 mt-1">
            Toque em &quot;+ Nova conta&quot; para começar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={handleEdit}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      <AccountFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        account={editingAccount}
        onSaved={handleSaved}
      />

      <button
        type="button"
        onClick={handleNew}
        className="fixed bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
        aria-label="Nova conta"
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  )
}
