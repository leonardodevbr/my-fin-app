// Envia e-mail para processamento manual de cancelamento da assinatura NunFí Pro.
// Configurar: RESEND_API_KEY, FROM_EMAIL, SUPPORT_EMAIL (destino do pedido de cancelamento).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'NunFí <noreply@NunFí.com>'
  const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL')

  if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY não configurada' }, 500)
  if (!SUPPORT_EMAIL) return json({ error: 'SUPPORT_EMAIL não configurada (destino do pedido de cancelamento)' }, 500)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return json({ error: 'Unauthorized' }, 401)

  const { data: sub } = await supabase
    .from('user_subscriptions')
    .select('plan, status, current_period_start, current_period_end')
    .eq('user_id', user.id)
    .single()

  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('pt-BR')
    : 'N/A'

  const periodStart = sub?.current_period_start ? new Date(sub.current_period_start) : null
  const diasComoPro = periodStart ? (Date.now() - periodStart.getTime()) / (1000 * 60 * 60 * 24) : 999
  const assinaturaRecente = diasComoPro < 7
  const alertaTaxa =
    assinaturaRecente
      ? `<p style="background:#fef3c7;color:#92400e;padding:12px;border-radius:8px;font-weight:600;">⚠️ Assinatura recente (${Math.round(diasComoPro)} dias). Se devolver o PIX, você paga taxa em duas operações (~R$0,24). Considere política de não reembolso nos primeiros 7 dias.</p>`
      : ''

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [SUPPORT_EMAIL],
      subject: `[NunFí] Pedido de cancelamento - ${user.email ?? user.id}${assinaturaRecente ? ' (assinatura recente!)' : ''}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
          <h2 style="color:#0f172a">Pedido de cancelamento de assinatura</h2>
          ${alertaTaxa}
          <p>O usuário solicitou o cancelamento do NunFí Pro.</p>
          <ul style="line-height:1.8;color:#334155">
            <li><strong>E-mail:</strong> ${user.email ?? '—'}</li>
            <li><strong>User ID:</strong> ${user.id}</li>
            <li><strong>Plano atual:</strong> ${sub?.plan ?? '—'}</li>
            <li><strong>Status:</strong> ${sub?.status ?? '—'}</li>
            <li><strong>Válido até:</strong> ${periodEnd}</li>
            <li><strong>Dias como Pro:</strong> ${Math.round(diasComoPro)}</li>
            <li><strong>Data do pedido:</strong> ${new Date().toLocaleString('pt-BR')}</li>
          </ul>
          <p style="color:#64748b;font-size:14px">Processar manualmente: não renovar na data de vencimento e, se desejar, enviar confirmação ao usuário.</p>
        </div>
      `,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[request-subscription-cancel] Resend error:', err)
    return json({ error: 'Falha ao enviar e-mail' }, 500)
  }

  return json({ ok: true, message: 'Pedido de cancelamento enviado. Nossa equipe processará em breve.' }, 200)
})
