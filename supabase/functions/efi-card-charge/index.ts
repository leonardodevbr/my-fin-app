// Cobra o NunFi Pro (R$ 9,90) no cartão de crédito via API de Cobranças da Efí.
// Fluxo: front gera payment_token com payment-token-efi → chama esta função → esta função cria a cobrança one-step.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// API de Cobranças (cartão): base URL por ambiente (Efí usa cobranças.api / cobrancas-h.api)
const EFI_BILLING_BASE_URL =
  Deno.env.get('EFI_BILLING_BASE_URL') ??
  (Deno.env.get('EFI_BILLING_ENV') === 'production'
    ? 'https://cobrancas.api.efipay.com.br'
    : 'https://cobrancas-h.api.efipay.com.br')
const EFI_BILLING_CLIENT_ID = Deno.env.get('EFI_BILLING_CLIENT_ID')!
const EFI_BILLING_CLIENT_SECRET = Deno.env.get('EFI_BILLING_CLIENT_SECRET')!

const AMOUNT_CENTS = 990 // R$ 9,90

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getBillingToken(): Promise<string> {
  const creds = btoa(`${EFI_BILLING_CLIENT_ID}:${EFI_BILLING_CLIENT_SECRET}`)
  const url = `${EFI_BILLING_BASE_URL}/oauth/token`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${creds}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
  })

  const raw = await res.text()

  if (!res.ok) {
    console.error('[efi-card-charge] Erro ao obter token. URL=', url, 'status=', res.status, 'body=', raw.slice(0, 500))
    throw new Error(
      `Falha ao autenticar na Efí (cartão). Ambiente/URL usada: ${EFI_BILLING_BASE_URL}. ` +
        'Sandbox = cobrancas-h.api.efipay.com.br (credenciais de homologação). Produção = cobrancas.api.efipay.com.br (credenciais de produção). Defina EFI_BILLING_BASE_URL ou EFI_BILLING_ENV nas secrets da função.'
    )
  }

  if (raw.trimStart().startsWith('<')) {
    console.error('[efi-card-charge] Resposta da Efí veio em HTML (URL errada?). Base:', EFI_BILLING_BASE_URL, 'Body:', raw.slice(0, 300))
    throw new Error('Configuração da API Efí incorreta. Verifique EFI_BILLING_BASE_URL (use cobrancas-h.api.efipay.com.br para sandbox e cobrancas.api.efipay.com.br para produção).')
  }

  let data: { access_token?: string }
  try {
    data = JSON.parse(raw) as { access_token: string }
  } catch {
    console.error('[efi-card-charge] Resposta não é JSON:', raw.slice(0, 300))
    throw new Error('Resposta inválida da Efí ao obter token')
  }

  if (!data?.access_token) {
    console.error('[efi-card-charge] Token não veio na resposta:', raw.slice(0, 300))
    throw new Error('Efí não retornou access_token')
  }

  return data.access_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

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

  const body = (await req.json().catch(() => ({}))) as {
    paymentToken?: string
    cardMask?: string
    customer?: { name?: string; cpf?: string; email?: string }
  }

  if (!body.paymentToken) {
    return new Response(JSON.stringify({ error: 'paymentToken é obrigatório' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const cpf = body.customer?.cpf?.replace(/\D/g, '')
  if (!cpf || cpf.length !== 11) {
    return new Response(JSON.stringify({ error: 'CPF do titular é obrigatório para pagamento com cartão (11 dígitos).' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const accessToken = await getBillingToken()

    const billingWebhookUrl = Deno.env.get('EFI_BILLING_WEBHOOK_URL') ?? `${Deno.env.get('SUPABASE_URL')}/functions/v1/efi-billing-webhook`

    // One-step: cria a cobrança e já associa ao cartão. notification_url = notificações de estorno/cancelamento no cartão.
    const chargeRes = await fetch(`${EFI_BILLING_BASE_URL}/v1/charge/one-step`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            name: 'NunFi Pro – Assinatura mensal',
            value: AMOUNT_CENTS,
            amount: 1,
          },
        ],
        metadata: {
          notification_url: billingWebhookUrl,
        },
        payment: {
          credit_card: {
            customer: {
              name: body.customer?.name ?? user.email ?? 'Cliente NunFi',
              cpf,
              email: body.customer?.email ?? user.email ?? '',
            },
            installments: 1,
            payment_token: body.paymentToken,
          },
        },
      }),
    })

    const raw = await chargeRes.json().catch(() => ({} as any))

    if (!chargeRes.ok || (raw as any).code !== 200) {
      const reason =
        (raw as { error_description?: string; error?: string }).error_description ??
        (raw as { error?: string }).error ??
        'Transação não aprovada'
      console.error('[efi-card-charge] Falha na cobrança:', raw)
      return new Response(JSON.stringify({ error: reason }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const data = raw.data as {
      charge_id: string
      status: string
      total: number
    }

    if (data.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Transação não aprovada.', status: data.status }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } },
      )
    }

    const now = new Date()
    const periodEnd = new Date(now)
    periodEnd.setDate(periodEnd.getDate() + 30)

    await supabase.from('payment_history').insert({
      user_id: user.id,
      amount_cents: AMOUNT_CENTS,
      status: 'paid',
      payment_method: 'card',
      efi_txid: data.charge_id,
      paid_at: now.toISOString(),
    })

    await supabase.from('user_subscriptions').upsert(
      {
        user_id: user.id,
        plan: 'pro',
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      },
      { onConflict: 'user_id' },
    )

    return new Response(
      JSON.stringify({
        ok: true,
        chargeId: data.charge_id,
        status: data.status,
      }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('[efi-card-charge] Erro:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})

