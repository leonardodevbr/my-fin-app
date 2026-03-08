// Supabase Edge Function: dispara um evento no Pusher (para notificações server-side).
// Útil para cron ou outro serviço avisar o app sobre transações a vencer.
// Configurar: PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER (dashboard Pusher).

// @deno-types="npm:@types/pusher"
import Pusher from 'npm:pusher@5.2.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const appId = Deno.env.get('PUSHER_APP_ID')
    const key = Deno.env.get('PUSHER_KEY')
    const secret = Deno.env.get('PUSHER_SECRET')
    const cluster = Deno.env.get('PUSHER_CLUSTER') ?? 'sa1'

    if (!appId || !key || !secret) {
      return jsonResponse({ error: 'Pusher não configurado (PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET)' }, 500)
    }

    const body = (await req.json().catch(() => ({}))) as {
      userId?: string
      channel?: string
      event?: string
      data?: { message?: string; count?: number; type?: string }
    }
    const userId = body.userId
    const channelName = body.channel ?? (userId ? `user-${userId}` : 'my-channel')
    const eventName = body.event ?? 'due-transactions'
    const data = body.data ?? {}

    const pusher = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    })

    await pusher.trigger(channelName, eventName, {
      type: eventName,
      message: data.message ?? 'Você tem transações a vencer.',
      count: data.count,
      data: data,
    })

    return jsonResponse({ ok: true, channel: channelName, event: eventName }, 200)
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Erro ao disparar Pusher' },
      500
    )
  }
})
