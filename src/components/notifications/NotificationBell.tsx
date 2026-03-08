import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Mail, ChevronRight } from 'lucide-react'
import { useDueTransactions } from '../../hooks/useDueTransactions'
import { usePusher } from '../../hooks/usePusher'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrencyFromCents, formatDate } from '../../lib/utils'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

const DAYS_AHEAD = 14

export function NotificationBell() {
  const dueTransactions = useDueTransactions({ daysAhead: DAYS_AHEAD, unpaidOnly: true })
  const { user } = useAuth()
  const { lastNotification, clearNotification } = usePusher(user?.id ?? undefined)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const count = dueTransactions.length
  const hasPusherAlert = lastNotification != null

  useEffect(() => {
    if (hasPusherAlert && lastNotification?.message) {
      toast(lastNotification.message, { icon: '🔔' })
      clearNotification()
    }
  }, [hasPusherAlert, lastNotification?.message, clearNotification])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [open])

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-surface-100 text-surface-600"
        aria-label={count > 0 ? `${count} transações a vencer` : 'Notificações'}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-[80vh] overflow-hidden rounded-xl border border-surface-200 bg-white shadow-lg z-50 flex flex-col">
          <div className="p-3 border-b border-surface-200">
            <h3 className="font-semibold text-surface-900">
              {count > 0 ? `${count} a vencer (${DAYS_AHEAD} dias)` : 'Notificações'}
            </h3>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0">
            {count === 0 ? (
              <p className="p-4 text-sm text-surface-500">Nenhuma transação a vencer nos próximos dias.</p>
            ) : (
              <ul className="divide-y divide-surface-100">
                {dueTransactions.slice(0, 15).map((t) => (
                  <li key={t.id}>
                    <Link
                      to="/transactions"
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-surface-50 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-surface-900 truncate">{t.description}</p>
                        <p className="text-xs text-surface-500">{formatDate(t.date)}</p>
                      </div>
                      <span
                        className={cn(
                          'text-sm font-medium shrink-0',
                          t.type === 'expense' && 'text-[var(--color-expense)]',
                          t.type === 'income' && 'text-[var(--color-income)]'
                        )}
                      >
                        {t.type === 'expense' ? '-' : '+'}
                        {formatCurrencyFromCents(t.amount)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-surface-400 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {count > 15 && (
              <p className="px-3 py-2 text-xs text-surface-500">
                +{count - 15} mais. <Link to="/transactions" onClick={() => setOpen(false)} className="text-primary-600 underline">Ver todas</Link>
              </p>
            )}
          </div>
          <div className="p-2 border-t border-surface-200">
            <SendReportButton onSent={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  )
}

function SendReportButton({ onSent }: { onSent: () => void }) {
  const [sending, setSending] = useState(false)
  const { session } = useAuth()
  const dueTransactions = useDueTransactions({ daysAhead: 14, unpaidOnly: true })

  const handleSend = async () => {
    if (!session?.access_token) {
      toast.error('Faça login para enviar relatório por e-mail.')
      return
    }
    setSending(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
      const fnUrl = `${supabaseUrl}/functions/v1/send-report-email`
      const items = dueTransactions.map((t) => ({
        description: t.description,
        date: t.date,
        amount: t.amount,
        type: t.type,
        is_paid: t.is_paid,
      }))
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reportType: 'due', items }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error((data as { error?: string }).error ?? 'Falha ao enviar e-mail')
        return
      }
      toast.success('Relatório enviado para seu e-mail.')
      onSent()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar')
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleSend}
      disabled={sending}
      className="w-full flex items-center justify-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 disabled:opacity-50"
    >
      <Mail className="h-4 w-4" />
      {sending ? 'Enviando...' : 'Enviar relatório por e-mail'}
    </button>
  )
}
