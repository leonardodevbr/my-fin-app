// Webhook da API de Cobranças Efí (cartão). Recebe POST com token de notificação;
// consulta GET /v1/notification/:token e, se status = refunded/canceled, cancela assinatura.
// Deploy: supabase functions deploy efi-billing-webhook --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EFI_BILLING_BASE_URL =
  Deno.env.get('EFI_BILLING_BASE_URL') ??
  (Deno.env.get('EFI_BILLING_ENV') === 'production'
    ? 'https://cobrancas.api.efipay.com.br'
    : 'https://cobrancas-h.api.efipay.com.br')
const EFI_BILLING_CLIENT_ID = Deno.env.get('EFI_BILLING_CLIENT_ID')!
const EFI_BILLING_CLIENT_SECRET = Deno.env.get('EFI_BILLING_CLIENT_SECRET')!

async function getBillingToken(): Promise<string> {
  const creds = btoa(`${EFI_BILLING_CLIENT_ID}:${EFI_BILLING_CLIENT_SECRET}`)
  const res = await fetch(`${EFI_BILLING_BASE_URL}/v1/authorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${creds}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  })
  const raw = await res.text()
  if (!res.ok) throw new Error('Falha ao obter token Efí (billing)')
  if (raw.trimStart().startsWith('<')) throw new Error('Efí retornou HTML; verifique EFI_BILLING_BASE_URL')
  const data = JSON.parse(raw) as { access_token?: string }
  if (!data?.access_token) throw new Error('Efí não retornou access_token')
  return data.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  let token: string | null = null
  const contentType = req.headers.get('Content-Type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text()
    const params = new URLSearchParams(text)
    token = params.get('notification')
  } else {
    const body = await req.json().catch(() => ({})) as { notification?: string }
    token = body.notification ?? null
  }

  if (!token) {
    console.warn('[efi-billing-webhook] POST sem token notification')
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  try {
    const accessToken = await getBillingToken()
    const notifRes = await fetch(`${EFI_BILLING_BASE_URL}/v1/notification/${encodeURIComponent(token)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!notifRes.ok) {
      console.error('[efi-billing-webhook] Falha ao consultar notificação:', notifRes.status)
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const notif = (await notifRes.json()) as { code?: number; data?: Array<{
      type: string
      identifiers?: { charge_id?: number }
      status?: { current: string; previous?: string }
    }> }
    const list = notif?.data ?? []
    if (list.length === 0) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })

    const last = list[list.length - 1]
    if (last.type !== 'charge' || !last.identifiers?.charge_id) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const chargeId = String(last.identifiers.charge_id)
    const current = last.status?.current ?? ''

    if (current !== 'refunded' && current !== 'canceled') {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const { data: payment } = await supabase
      .from('payment_history')
      .select('user_id')
      .eq('efi_txid', chargeId)
      .eq('status', 'paid')
      .eq('payment_method', 'card')
      .single()

    if (!payment) {
      console.log('[efi-billing-webhook] Cobrança não encontrada ou já processada:', chargeId)
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    await supabase
      .from('payment_history')
      .update({ status: 'refunded' })
      .eq('efi_txid', chargeId)
      .eq('status', 'paid')

    const now = new Date().toISOString()
    await supabase.from('user_subscriptions').update({
      plan: 'free',
      status: 'canceled',
      current_period_end: now,
      canceled_at: now,
    }).eq('user_id', payment.user_id)

    console.log('[efi-billing-webhook] Assinatura cancelada por estorno/cancelamento cartão charge_id=', chargeId, 'user=', payment.user_id)
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[efi-billing-webhook] Erro:', e)
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
})
