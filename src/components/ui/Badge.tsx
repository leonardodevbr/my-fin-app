import { type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'income' | 'expense' | 'transfer' | 'success' | 'warning'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        {
          'bg-surface-200 text-surface-800': variant === 'default',
          'bg-emerald-100 text-emerald-800': variant === 'income',
          'bg-red-100 text-red-800': variant === 'expense',
          'bg-indigo-100 text-indigo-800': variant === 'transfer',
          'bg-green-100 text-green-800': variant === 'success',
          'bg-amber-100 text-amber-800': variant === 'warning',
        },
        className
      )}
    >
      {children}
    </span>
  )
}
