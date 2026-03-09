// Deploy com: supabase functions deploy efi-webhook --no-verify-jwt
// URL para configurar no painel Efi Bank:
//   https://<project-ref>.supabase.co/functions/v1/efi-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'NunFi <noreply@nunfi.com>'
const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') ?? ''
const REFUND_ALERT_DAYS = Math.max(0, parseInt(Deno.env.get('REFUND_ALERT_DAYS') ?? '7', 10))

const PROXY_SECRET = Deno.env.get('EFI_PROXY_SECRET')!

Deno.serve(async (req) => {
  if (req.method === 'GET') return new Response('OK', { status: 200 })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const auth = req.headers.get('Authorization')
  if (!PROXY_SECRET || auth !== `Bearer ${PROXY_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  try {
    const body = await req.json() as {
      pix?: Array<{
        txid: string
        valor: string
        horario: string
        endToEndId?: string
        devolucoes?: Array<{ id?: string; valor?: string; status?: string }>
      }>
    }

    for (const pix of body.pix ?? []) {
      const devolucoes = Array.isArray(pix.devolucoes) ? pix.devolucoes : []
      const totalDevolvido = devolucoes
        .filter((d) => d.status === 'DEVOLVIDO')
        .reduce((s, d) => s + (parseFloat(String(d.valor ?? 0)) || 0), 0)
      const isRefund = devolucoes.some((d) => d.status === 'DEVOLVIDO')

      if (isRefund) {
        // Só cancela se o valor total devolvido >= valor da cobrança (evita cancelar em devolução parcial/taxa)
        const { data: payment } = await supabase
          .from('payment_history')
          .select('user_id, amount_cents, paid_at')
          .eq('efi_txid', pix.txid)
          .eq('status', 'paid')
          .single()

        if (!payment) {
          console.warn(`[Webhook] txid não encontrado ou já processado para devolução: ${pix.txid}`)
          continue
        }

        const valorCobrancaReais = (payment.amount_cents ?? 0) / 100
        const tolerancia = 0.01
        if (totalDevolvido < valorCobrancaReais - tolerancia) {
          console.log(`[Webhook] Devolução parcial ignorada txid=${pix.txid} devolvido=R$${totalDevolvido.toFixed(2)} cobrança=R$${valorCobrancaReais.toFixed(2)}`)
          continue
        }

        console.log(`[Webhook] Devolução PIX txid=${pix.txid} valor=R$${pix.valor} devolvido=R$${totalDevolvido.toFixed(2)}`)

        await supabase
          .from('payment_history')
          .update({ status: 'refunded' })
          .eq('efi_txid', pix.txid)
          .eq('status', 'paid')

        const now = new Date().toISOString()
        await supabase.from('user_subscriptions').update({
          plan: 'free',
          status: 'canceled',
          current_period_end: now,
          canceled_at: now,
        }).eq('user_id', payment!.user_id)

        console.log(`[Webhook] Assinatura cancelada por devolução (total) user=${payment!.user_id}`)

        const pusherUrl = `${SUPABASE_URL}/functions/v1/trigger-pusher`
        await fetch(pusherUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            userId: payment!.user_id,
            event: 'subscription-canceled',
            data: { message: 'Assinatura cancelada (devolução PIX).', type: 'subscription-canceled' },
          }),
        }).catch((e) => console.warn('[Webhook] Pusher:', e))

        const { data: { user } } = await supabase.auth.admin.getUserById(payment!.user_id)
        if (user?.email && RESEND_API_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [user.email],
              subject: 'NunFi Pro – Assinatura cancelada (devolução)',
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
                  <h1 style="color:#0f172a">Assinatura cancelada</h1>
                  <p>O pagamento referente ao seu plano <strong>NunFi Pro</strong> foi devolvido/estornado.</p>
                  <p>Sua assinatura foi cancelada e o acesso ao Pro foi encerrado.</p>
                  <p style="color:#64748b;font-size:14px">Para assinar novamente, acesse o app e gere um novo PIX.</p>
                </div>
              `,
            }),
          }).catch((e) => console.warn('[Webhook] Email devolução:', e))
        }

        // Alerta interno: reembolso de assinatura recente = você paga taxa PIX em 2 operações (entrada + saída)
        const paidAt = payment.paid_at ? new Date(payment.paid_at) : null
        const diasDesdePagamento = paidAt ? (Date.now() - paidAt.getTime()) / (1000 * 60 * 60 * 24) : 999
        if (SUPPORT_EMAIL && RESEND_API_KEY && REFUND_ALERT_DAYS > 0 && diasDesdePagamento < REFUND_ALERT_DAYS) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: [SUPPORT_EMAIL],
              subject: `[NunFi] Atenção: reembolso de assinatura recente (${Math.round(diasDesdePagamento)} dias)`,
              html: `
                <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
                  <h2 style="color:#b45309">Reembolso de assinatura recente</h2>
                  <p>Um reembolso foi processado para um pagamento com <strong>menos de ${REFUND_ALERT_DAYS} dias</strong>. Você paga taxa PIX na entrada e na saída (~R$0,12 cada).</p>
                  <ul style="line-height:1.8;color:#334155">
                    <li><strong>E-mail do usuário:</strong> ${user?.email ?? '—'}</li>
                    <li><strong>User ID:</strong> ${payment.user_id}</li>
                    <li><strong>Pagou em:</strong> ${paidAt ? paidAt.toLocaleString('pt-BR') : '—'}</li>
                    <li><strong>Valor:</strong> R$ ${valorCobrancaReais.toFixed(2)}</li>
                    <li><strong>Dias desde o pagamento:</strong> ${Math.round(diasDesdePagamento)}</li>
                  </ul>
                  <p style="color:#64748b;font-size:14px">Considere política de &quot;não reembolso nos primeiros ${REFUND_ALERT_DAYS} dias&quot; para evitar perda com taxas em assinaturas que cancelam em seguida.</p>
                </div>
              `,
            }),
          }).catch((e) => console.warn('[Webhook] Email alerta suporte:', e))
        }
        continue
      }

      // Pagamento recebido (sem devolução)
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

      const pusherUrl = `${SUPABASE_URL}/functions/v1/trigger-pusher`
      await fetch(pusherUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          userId: payment.user_id,
          event: 'subscription-activated',
          data: { message: 'Assinatura Pro ativada!', type: 'subscription-activated' },
        }),
      }).catch((e) => console.warn('[Webhook] Pusher:', e))

      if (RESEND_API_KEY) {
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
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    console.error('[Webhook] Erro:', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro' }), { status: 500 })
  }
})

