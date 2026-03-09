import { Crown, X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSubscription } from '../../hooks/useSubscription'

export function TrialBanner() {
  const { isTrialActive, isProActive, daysRemaining, loading, hasAccess } = useSubscription()
  const [dismissed, setDismissed] = useState(false)
  const navigate = useNavigate()

  if (loading || isProActive || dismissed) return null

  const isExpired = !hasAccess
  const isUrgent = isTrialActive && daysRemaining <= 7

  if (!isExpired && !isUrgent) return null

  return (
    <div className={`flex items-center justify-between gap-2 px-4 py-2.5 text-sm rounded-xl mx-4
      ${isExpired ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 shrink-0" />
        {isExpired
          ? 'Seu acesso expirou. Assine o NunFi Pro para continuar.'
          : `Trial expira em ${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''}.`}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/subscription')}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${isExpired ? 'bg-red-200 text-red-900 hover:bg-red-300' : 'bg-amber-200 text-amber-900 hover:bg-amber-300'}`}
        >
          Assinar agora
        </button>
        {!isExpired && (
          <button onClick={() => setDismissed(true)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

