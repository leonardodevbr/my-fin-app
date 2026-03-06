import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative w-full max-w-md rounded-xl bg-white shadow-xl surface-50 max-h-[90vh] overflow-hidden flex flex-col',
          className
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200">
          {title ? <h2 id="modal-title" className="text-lg font-semibold text-surface-900">{title}</h2> : <span />}
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-auto px-4 py-3">{children}</div>
      </div>
    </div>,
    document.body
  )
}
