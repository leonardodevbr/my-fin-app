import { useRef, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import type { Transaction } from '../../db'
import { formatCurrency, formatDate } from '../../lib/utils'
import { cn } from '../../lib/utils'

const SWIPE_THRESHOLD = 60

export interface TransactionItemProps {
  transaction: Transaction
  accountName: string
  categoryColor: string
  categoryName: string
  onEdit: () => void
  onTogglePaid: () => void
  onDelete: () => void
}

export function TransactionItem({
  transaction,
  accountName,
  categoryColor,
  categoryName,
  onEdit,
  onTogglePaid,
  onDelete,
}: TransactionItemProps) {
  const [dragX, setDragX] = useState(0)
  const startX = useRef(0)

  const amountColor =
    transaction.type === 'income'
      ? 'text-[var(--color-income)]'
      : transaction.type === 'expense'
        ? 'text-[var(--color-expense)]'
        : 'text-[var(--color-transfer)]'

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const x = e.touches[0].clientX
    const diff = startX.current - x
    if (diff > 0) {
      setDragX(Math.min(diff, 80))
    } else {
      setDragX(Math.max(diff, -80))
    }
  }

  const handleTouchEnd = () => {
    if (dragX > SWIPE_THRESHOLD) {
      setDragX(80)
    } else {
      setDragX(0)
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-white border border-surface-200">
      <div
        className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-red-500"
        aria-hidden
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setDragX(0)
            onDelete()
          }}
          className="p-3 text-white"
          aria-label="Excluir"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
      <div
        className="relative flex items-center gap-3 p-3 bg-white transition-transform"
        style={{ transform: `translateX(-${dragX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={onEdit}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTogglePaid()
          }}
          className="shrink-0 rounded-full p-1 hover:bg-surface-100"
          aria-label={transaction.is_paid ? 'Marcar como não pago' : 'Marcar como pago'}
        >
          <div
            className={cn(
              'h-6 w-6 rounded-full border-2 flex items-center justify-center',
              transaction.is_paid
                ? 'border-primary-500 bg-primary-500 text-white'
                : 'border-surface-300'
            )}
          >
            {transaction.is_paid && <Check className="h-3.5 w-3.5" />}
          </div>
        </button>
        <div
          className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-medium"
          style={{ backgroundColor: categoryColor }}
        >
          {categoryName?.charAt(0) ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-surface-900 truncate">{transaction.description}</p>
          <p className="text-xs text-surface-500 truncate">{accountName}</p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-surface-500 lg:hidden">{formatDate(transaction.date)}</span>
            {transaction.tags?.length > 0 &&
              transaction.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-surface-200 text-surface-600"
                >
                  {tag}
                </span>
              ))}
          </div>
        </div>
        <p className={cn('shrink-0 font-semibold', amountColor)}>
          {transaction.type === 'expense' ? '-' : '+'}
          {formatCurrency(transaction.amount)}
        </p>
      </div>
    </div>
  )
}
