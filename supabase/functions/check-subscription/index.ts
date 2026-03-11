import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Pro grátis para dono/lista de e-mails ou IDs (secret PRO_FREE_EMAILS ou PRO_FREE_USER_IDS, separados por vírgula)
  const freeEmails = (Deno.env.get('PRO_FREE_EMAILS') ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const freeUserIds = (Deno.env.get('PRO_FREE_USER_IDS') ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean)
  const isFreePro =
    (user.email && freeEmails.includes(user.email.toLowerCase())) ||
    freeUserIds.includes(user.id)

  if (isFreePro) {
    const farFuture = new Date()
    farFuture.setFullYear(farFuture.getFullYear() + 10)
    const endIso = farFuture.toISOString()
    return new Response(
      JSON.stringify({
        plan: 'pro',
        status: 'active',
        hasAccess: true,
        isTrialActive: false,
        isProActive: true,
        trialEndsAt: null,
        currentPeriodEnd: endIso,
        daysRemaining: 3650,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const now = new Date()
  const isTrialActive = sub?.status === 'trial' && sub?.trial_ends_at && new Date(sub.trial_ends_at) > now
  const isProActive = sub?.status === 'active' && sub?.current_period_end && new Date(sub.current_period_end) > now
  const hasAccess = isTrialActive || isProActive

  const endsAt = isProActive ? sub?.current_period_end : sub?.trial_ends_at
  const daysRemaining = endsAt
    ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - now.getTime()) / 86_400_000))
    : 0

  return new Response(JSON.stringify({
    plan: sub?.plan ?? 'free',
    status: sub?.status ?? 'expired',
    hasAccess,
    isTrialActive,
    isProActive,
    trialEndsAt: sub?.trial_ends_at ?? null,
    currentPeriodEnd: sub?.current_period_end ?? null,
    daysRemaining,
  }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
})

