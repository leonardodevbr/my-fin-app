// Registra o webhook PIX na Efi via proxy (mTLS). Chamar manualmente uma vez por ambiente.
// Secrets: EFI_PROXY_URL, EFI_PROXY_SECRET

const EFI_PROXY_URL = Deno.env.get('EFI_PROXY_URL')!
const EFI_PROXY_SECRET = Deno.env.get('EFI_PROXY_SECRET')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const json = (body: object, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  try {
    const proxyBase = new URL(EFI_PROXY_URL).origin
    const webhookUrl = `${proxyBase}/efi-webhook`
    console.log('[efi-register-webhook] Chamando proxy para registrar:', webhookUrl)

    const res = await fetch(`${proxyBase}/register-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${EFI_PROXY_SECRET}`,
      },
      body: JSON.stringify({ webhookUrl }),
    })

    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; webhookUrl?: string; raw?: string; error?: unknown }

    if (!res.ok) {
      return json({ error: data.error ?? `Proxy retornou ${res.status}` }, 500)
    }

    return json({ ok: data.ok, webhookUrl: data.webhookUrl, raw: data.raw }, 200)
  } catch (e) {
    console.error('[efi-register-webhook] Erro:', e)
    return json(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      500
    )
  }
})
