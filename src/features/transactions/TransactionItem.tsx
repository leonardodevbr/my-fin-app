import { useRef, useState } from 'react'
import { Check, Trash2, Repeat, Package } from 'lucide-react'
import type { Transaction } from '../../db'
import type { PaymentMode } from '../../db/schema'
import { formatCurrencyFromCents, formatDate } from '../../lib/utils'
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
  /** Modo seleção múltipla: exibe checkbox para selecionar a linha */
  selectionMode?: boolean
  selected?: boolean
  onToggleSelect?: () => void
  /** Tipo de transação (do grupo): exibe indicador Fixo / Parcelado 1/3 */
  paymentMode?: PaymentMode | null
  installmentsTotal?: number | null
}

export function TransactionItem({
  transaction,
  accountName,
  categoryColor,
  categoryName,
  onEdit,
  onTogglePaid,
  onDelete,
  selectionMode,
  selected,
  onToggleSelect,
  paymentMode,
  installmentsTotal,
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
        {selectionMode && onToggleSelect && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect()
            }}
            className={cn(
              'shrink-0 flex items-center justify-center h-5 w-5 rounded border-2 transition-colors',
              selected ? 'border-primary-500 bg-primary-500 text-white' : 'border-surface-300'
            )}
            aria-label={selected ? 'Desmarcar' : 'Selecionar'}
          >
            {selected && <Check className="h-3 w-3" />}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTogglePaid()
          }}
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
            transaction.is_paid
              ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
              : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
          )}
          aria-label={transaction.is_paid ? 'Marcar como não pago' : 'Marcar como pago'}
        >
          {transaction.is_paid ? 'Pago' : 'A pagar'}
        </button>
        <div
          className="h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-white text-sm font-medium"
          style={{ backgroundColor: categoryColor }}
        >
          {categoryName?.charAt(0) ?? '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap gap-y-0.5">
            <p className="font-semibold text-surface-900 truncate">{transaction.description}</p>
            {paymentMode === 'recurring' && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-surface-100 px-1.5 py-0.5 text-[10px] font-medium text-surface-500" title="Recorrente">
                <Repeat className="h-2.5 w-2.5" />
                Fixo
              </span>
            )}
            {paymentMode === 'installments' && installmentsTotal != null && installmentsTotal >= 1 && transaction.installment_number != null && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-surface-100 px-1.5 py-0.5 text-[10px] font-medium text-surface-500" title="Parcelado">
                <Package className="h-2.5 w-2.5" />
                {transaction.installment_number}/{installmentsTotal}
              </span>
            )}
          </div>
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
          {formatCurrencyFromCents(transaction.amount)}
        </p>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="shrink-0 hidden sm:flex p-2 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50"
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
