// Secrets necessários no Supabase:
// EFI_CLIENT_ID, EFI_CLIENT_SECRET, EFI_PIX_KEY, EFI_SANDBOX (true/false)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const EFI_CLIENT_ID = Deno.env.get('EFI_CLIENT_ID')!
const EFI_CLIENT_SECRET = Deno.env.get('EFI_CLIENT_SECRET')!
const EFI_PIX_KEY = Deno.env.get('EFI_PIX_KEY')!
const IS_SANDBOX = Deno.env.get('EFI_SANDBOX') === 'true'

const EFI_BASE = IS_SANDBOX
  ? 'https://pix-h.api.efipay.com.br'
  : 'https://pix.api.efipay.com.br'

const AMOUNT_CENTS = 990 // R$ 9,90

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getToken(): Promise<string> {
  const creds = btoa(`${EFI_CLIENT_ID}:${EFI_CLIENT_SECRET}`)
  const res = await fetch(`${EFI_BASE}/oauth/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) throw new Error(`Efi auth: ${await res.text()}`)
  const json = await res.json() as { access_token: string }
  return json.access_token
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
    const accessToken = await getToken()

    // txid: identificador único, máx 35 chars alfanumérico
    const uid = user.id.replace(/-/g, '')
    const txid = `nf${uid.slice(0, 20)}${Date.now().toString(36).slice(-8)}`

    // Cria cobrança PIX
    const cobRes = await fetch(`${EFI_BASE}/v2/cob/${txid}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        calendario: { expiracao: 3600 },
        valor: { original: (AMOUNT_CENTS / 100).toFixed(2) },
        chave: EFI_PIX_KEY,
        solicitacaoPagador: 'NunFi Pro — Assinatura mensal',
        infoAdicionais: [{ nome: 'Plano', valor: 'NunFi Pro' }],
      }),
    })

    if (!cobRes.ok) throw new Error(`Efi cob: ${await cobRes.text()}`)
    const cob = await cobRes.json() as { txid: string; pixCopiaECola: string; loc: { id: number } }

    // Busca QR Code
    let qrCodeImage: string | null = null
    const qrRes = await fetch(`${EFI_BASE}/v2/loc/${cob.loc.id}/qrcode`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (qrRes.ok) {
      const qr = await qrRes.json() as { imagemQrcode: string }
      qrCodeImage = qr.imagemQrcode // base64 PNG
    }

    // Salva no histórico com status pending
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
    await supabase.from('payment_history').insert({
      user_id: user.id,
      amount_cents: AMOUNT_CENTS,
      status: 'pending',
      payment_method: 'pix',
      efi_txid: txid,
      pix_copia_e_cola: cob.pixCopiaECola,
      expires_at: expiresAt,
    })

    await supabase.from('user_subscriptions')
      .upsert({ user_id: user.id, efi_txid: txid }, { onConflict: 'user_id' })

    return new Response(JSON.stringify({
      txid,
      pixCopiaECola: cob.pixCopiaECola,
      qrCodeImage,
      amountCents: AMOUNT_CENTS,
      expiresAt,
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[EFI] Erro:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})

