import { type ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-200 bg-white shadow-sm surface-50',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardProps) {
  return <div className={cn('px-4 py-3 border-b border-surface-200', className)}>{children}</div>
}

export function CardTitle({ children, className }: CardProps) {
  return <h3 className={cn('text-base font-semibold text-surface-900', className)}>{children}</h3>
}

export function CardContent({ children, className }: CardProps) {
  return <div className={cn('p-4', className)}>{children}</div>
}
