import { useState, useEffect, useMemo } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useAccountsWithLoading } from '../../hooks/useAccounts'
import { useTransactions } from '../../hooks/useTransactions'
import { formatCurrency, monthRange } from '../../lib/utils'
import { useAppStore } from '../../store/appStore'
import { Skeleton } from '../../components/ui/Skeleton'

const DURATION_MS = 600

function useCountUp(value: number, enabled: boolean, visible: boolean): number {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    if (!enabled || !visible) {
      setDisplay(value)
      return
    }
    let start: number | null = null
    const step = (ts: number) => {
      if (start === null) start = ts
      const elapsed = ts - start
      const t = Math.min(elapsed / DURATION_MS, 1)
      const eased = 1 - (1 - t) * (1 - t)
      setDisplay(Math.round(eased * value * 100) / 100)
      if (t < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [value, enabled, visible])
  return display
}

export function BalanceHeader() {
  const { selectedMonth } = useAppStore()
  const { accounts, isLoading: accountsLoading } = useAccountsWithLoading(true)
  const transactions = useTransactions({
    from: monthRange(selectedMonth)[0],
    to: monthRange(selectedMonth)[1],
  })

  const [balanceVisible, setBalanceVisible] = useState(true)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const totalBalance = useMemo(
    () => accounts.reduce((sum, a) => sum + a.balance, 0),
    [accounts]
  )
  const monthIncome = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0),
    [transactions]
  )
  const monthExpense = useMemo(
    () =>
      transactions
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0),
    [transactions]
  )

  const displayBalance = useCountUp(totalBalance, mounted, balanceVisible)
  const displayIncome = useCountUp(monthIncome, mounted, balanceVisible)
  const displayExpense = useCountUp(monthExpense, mounted, balanceVisible)

  const masked = !balanceVisible

  const isLoading = accountsLoading

  if (isLoading) {
    return (
      <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
        <Skeleton className="mt-2 h-10 w-48" />
        <div className="mt-3 flex gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-24" />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-surface-200 bg-white p-6 shadow-sm transition-opacity duration-200">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-surface-500">Saldo total</span>
        <button
          type="button"
          onClick={() => setBalanceVisible((v) => !v)}
          className="rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 hover:text-surface-700"
          aria-label={balanceVisible ? 'Ocultar valores' : 'Mostrar valores'}
        >
          {balanceVisible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </button>
      </div>
      <p className="mt-1 text-2xl font-bold text-surface-900 md:text-3xl">
        {masked ? '••••••' : formatCurrency(displayBalance)}
      </p>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="text-[var(--color-income)]">
          Receitas: {masked ? '••••' : formatCurrency(displayIncome)}
        </span>
        <span className="text-[var(--color-expense)]">
          Despesas: {masked ? '••••' : formatCurrency(displayExpense)}
        </span>
      </div>
    </div>
  )
}
