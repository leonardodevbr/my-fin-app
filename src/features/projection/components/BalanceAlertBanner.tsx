import React, { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { ProjectionAlert } from '../projectionEngine'
import { cn } from '../../../lib/utils'

export interface BalanceAlertBannerProps {
  alerts: ProjectionAlert[]
}

export const BalanceAlertBanner = React.memo(function BalanceAlertBanner({
  alerts,
}: BalanceAlertBannerProps) {
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const visible = alerts.filter((_, i) => !dismissed.has(i))
  if (visible.length === 0) return null

  const hasDanger = visible.some((a) => a.severity === 'danger')

  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        hasDanger
          ? 'border-red-200 bg-red-50'
          : 'border-amber-200 bg-amber-50'
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={cn(
            'h-5 w-5 shrink-0 mt-0.5',
            hasDanger ? 'text-red-600' : 'text-amber-600'
          )}
        />
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'font-medium',
              hasDanger ? 'text-red-900' : 'text-amber-900'
            )}
          >
            {hasDanger
              ? 'Saldo negativo previsto no período'
              : 'Atenção na projeção'}
          </p>
          <ul className="mt-2 space-y-1">
            {visible.map((alert) => {
              const originalIndex = alerts.indexOf(alert)
              return (
                <li
                  key={`${alert.date}-${alert.type}`}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span
                    className={cn(
                      alert.severity === 'danger'
                        ? 'text-red-800'
                        : 'text-amber-800'
                    )}
                  >
                    {alert.message}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setDismissed((s) => new Set(s).add(originalIndex))
                    }
                    className="p-1 rounded hover:bg-black/10"
                    aria-label="Dispensar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
})
