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
    <div className={`flex items-center justify-between gap-2 px-4 py-2 text-sm
      ${isExpired ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
      <div className="flex items-center gap-2">
        <Crown className="h-4 w-4 shrink-0" />
        {isExpired
          ? 'Seu acesso expirou. Assine o NunFi Pro para continuar.'
          : `Trial expira em ${daysRemaining} dia${daysRemaining !== 1 ? 's' : ''}.`}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/subscription')}
          className="rounded bg-white/20 px-2 py-0.5 text-xs font-semibold hover:bg-white/30"
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

