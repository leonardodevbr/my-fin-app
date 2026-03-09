// Deploy com: supabase functions deploy efi-webhook --no-verify-jwt
// URL para configurar no painel Efi Bank:
//   https://<project-ref>.supabase.co/functions/v1/efi-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'NunFi <noreply@nunfi.com>'

Deno.serve(async (req) => {
  // Efi Bank faz GET para validar o endpoint ao cadastrar
  if (req.method === 'GET') return new Response('OK', { status: 200 })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  try {
    const body = await req.json() as {
      pix?: Array<{ txid: string; valor: string; horario: string; endToEndId: string }>
    }

    for (const pix of body.pix ?? []) {
      console.log(`[Webhook] PIX recebido txid=${pix.txid} valor=R$${pix.valor}`)

      const { data: payment } = await supabase
        .from('payment_history')
        .update({ status: 'paid', paid_at: pix.horario })
        .eq('efi_txid', pix.txid)
        .eq('status', 'pending')
        .select('user_id')
        .single()

      if (!payment) {
        console.warn(`[Webhook] txid não encontrado ou já processado: ${pix.txid}`)
        continue
      }

      // Ativa o plano Pro por 30 dias
      const now = new Date()
      const periodEnd = new Date(now)
      periodEnd.setDate(periodEnd.getDate() + 30)

      await supabase.from('user_subscriptions').update({
        plan: 'pro',
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      }).eq('user_id', payment.user_id)

      console.log(`[Webhook] Assinatura ativada user=${payment.user_id} até ${periodEnd.toISOString()}`)

      // Email de confirmação
      const { data: { user } } = await supabase.auth.admin.getUserById(payment.user_id)
      if (user?.email) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [user.email],
            subject: '✅ NunFi Pro ativado!',
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                <h1 style="color:#10b981">Pagamento confirmado!</h1>
                <p>Seu plano <strong>NunFi Pro</strong> está ativo até
                   <strong>${periodEnd.toLocaleDateString('pt-BR')}</strong>.</p>
                <p style="color:#64748b;font-size:14px">Valor: R$ ${parseFloat(pix.valor).toFixed(2)}</p>
                <p>Obrigado por assinar o NunFi! 🎉</p>
              </div>
            `,
          }),
        })
        console.log(`[Webhook] Email enviado para ${user.email}`)
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    console.error('[Webhook] Erro:', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro' }), { status: 500 })
  }
})

