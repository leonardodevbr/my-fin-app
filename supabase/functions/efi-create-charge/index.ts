// Chama o microserviço Node no Railway (mTLS com Efi). Secrets: EFI_PROXY_URL, EFI_PROXY_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EFI_PROXY_URL = Deno.env.get('EFI_PROXY_URL')!
const EFI_PROXY_SECRET = Deno.env.get('EFI_PROXY_SECRET')!

const AMOUNT_CENTS = 990 // R$ 9,90

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

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

  try {
    console.log(`[efi-create-charge] Gerando PIX para user=${user.id}`)

    const proxyRes = await fetch(`${EFI_PROXY_URL}/charge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EFI_PROXY_SECRET}`,
      },
      body: JSON.stringify({
        userId: user.id,
        amountCents: AMOUNT_CENTS,
        description: 'NunFí Pro — Assinatura mensal',
      }),
    })

    if (!proxyRes.ok) {
      const err = (await proxyRes.json().catch(() => ({}))) as { error?: string }
      throw new Error(err.error ?? `Proxy retornou ${proxyRes.status}`)
    }

    const data = (await proxyRes.json()) as {
      txid: string
      pixCopiaECola: string
      qrCodeImage: string | null
      amountCents: number
      expiresAt: string
    }

    console.log(`[efi-create-charge] PIX gerado txid=${data.txid}`)

    await supabase.from('payment_history').insert({
      user_id: user.id,
      amount_cents: AMOUNT_CENTS,
      status: 'pending',
      payment_method: 'pix',
      efi_txid: data.txid,
      pix_copia_e_cola: data.pixCopiaECola,
      expires_at: data.expiresAt,
    })

    await supabase.from('user_subscriptions').upsert(
      { user_id: user.id, efi_txid: data.txid },
      { onConflict: 'user_id' }
    )

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[efi-create-charge] Erro:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
