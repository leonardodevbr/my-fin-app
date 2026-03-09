// Supabase Edge Function para registrar/atualizar o webhook PIX na Efí.
// Uso recomendado: chamar manualmente (uma vez por ambiente) via supabase functions invoke
// depois de configurar os secrets EFI_CLIENT_ID, EFI_CLIENT_SECRET, EFI_PIX_KEY, EFI_SANDBOX.
//
// Exemplo de chamada (frontend autenticado):
// const { data, error } = await supabase.functions.invoke('efi-register-webhook')

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

  // Pode ser chamada sem Authorization (uso administrativo/manual via painel/CLI)
  // Apenas garante que os secrets estão configurados e registra o webhook.
  createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  try {
    const accessToken = await getToken()

    const webhookUrl = `${SUPABASE_URL}/functions/v1/efi-webhook`

    const res = await fetch(`${EFI_BASE}/v2/webhook/${encodeURIComponent(EFI_PIX_KEY)}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ webhookUrl }),
    })

    const body = await res.text()

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, status: res.status, body }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, webhookUrl, raw: body }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('[EFI webhook register] Erro:', e)
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Erro interno' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})

