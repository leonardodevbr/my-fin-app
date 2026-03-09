import { useState, useEffect, useCallback } from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'

export interface SubscriptionInfo {
  plan: 'free' | 'pro'
  status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired'
  hasAccess: boolean
  isTrialActive: boolean
  isProActive: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  daysRemaining: number
  loading: boolean
  error: string | null
}

const DEFAULT: SubscriptionInfo = {
  plan: 'free',
  status: 'trial',
  hasAccess: false,
  isTrialActive: false,
  isProActive: false,
  trialEndsAt: null,
  currentPeriodEnd: null,
  daysRemaining: 0,
  loading: true,
  error: null,
}

export function useSubscription() {
  const [info, setInfo] = useState<SubscriptionInfo>(DEFAULT)

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) return
    const supabase = getSupabase()
    if (!supabase) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setInfo(prev => ({ ...prev, loading: false }))
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke('check-subscription')
      if (error || !data) throw error
      setInfo({ ...data, loading: false, error: null })
    } catch {
      setInfo(prev => ({ ...prev, loading: false, error: 'Erro ao verificar assinatura' }))
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  return { ...info, refresh }
}

