// Supabase Edge Function: scheduler-due-notifications
// Chamada pelo pg_cron todo dia às 8h (BRT).
// Para cada usuário com transações a vencer nos próximos 14 dias:
//   1. Dispara notificação Pusher (tempo real no app)
//   2. Envia Web Push (notificação no celular com app fechado)
//   3. Envia email via Resend
//
// Secrets: RESEND_API_KEY, FROM_EMAIL, PUSHER_*, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (opcional)
// Chamada com: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'NunFi <onboarding@resend.dev>'
const PUSHER_APP_ID = Deno.env.get('PUSHER_APP_ID')!
const PUSHER_KEY = Deno.env.get('PUSHER_KEY')!
const PUSHER_SECRET = Deno.env.get('PUSHER_SECRET')!
const PUSHER_CLUSTER = Deno.env.get('PUSHER_CLUSTER') ?? 'sa1'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@nunfi.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

const DAYS_AHEAD = 14

interface Transaction {
  description: string
  date: string
  amount: number
  type: string
}

interface UserReport {
  userId: string
  email: string
  items: Transaction[]
}

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Pusher auth (HMAC-SHA256 + MD5) ─────────────────────────────────────────

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function md5Hex(message: string): Promise<string> {
  const { createHash } = await import('https://deno.land/std@0.224.0/crypto/mod.ts')
  const hash = createHash('md5')
  hash.update(message)
  return hash.toString()
}

async function triggerPusher(userId: string, count: number): Promise<void> {
  const channel = `user-${userId}`
  const eventName = 'due-transactions'
  const bodyObj = {
    channel,
    name: eventName,
    data: JSON.stringify({
      type: 'due-transactions',
      message: `Você tem ${count} transação(ões) a vencer nos próximos ${DAYS_AHEAD} dias.`,
      count,
    }),
  }
  const bodyStr = JSON.stringify(bodyObj)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const path = `/apps/${PUSHER_APP_ID}/events`
  const bodyMd5 = await md5Hex(bodyStr)
  const queryParams = `auth_key=${PUSHER_KEY}&auth_timestamp=${timestamp}&auth_version=1.0&body_md5=${bodyMd5}`
  const toSign = `POST\n${path}\n${queryParams}`
  const signature = await hmacSha256(PUSHER_SECRET, toSign)

  const url = `https://api-${PUSHER_CLUSTER}.pusher.com${path}?${queryParams}&auth_signature=${signature}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyStr,
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[Pusher] Falha user=${userId}: ${err}`)
  } else {
    console.log(`[Pusher] Notificado user=${userId} (${count} transações)`)
  }
}

// ─── Email via Resend ─────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function buildEmailHtml(items: Transaction[]): string {
  const rows = items
    .map(
      (t) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(t.description)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0">${t.date}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:${t.type === 'expense' ? '#dc2626' : '#16a34a'}">
          ${t.type === 'expense' ? '-' : '+'}${formatCents(t.amount)}
        </td>
      </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>NunFi - Transações a vencer</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:16px">
  <h1 style="color:#0f172a">Transações a vencer</h1>
  <p style="color:#475569">Você tem <strong>${items.length}</strong> transação(ões) com vencimento nos próximos ${DAYS_AHEAD} dias.</p>
  <table style="width:100%;border-collapse:collapse;margin-top:16px">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="padding:8px;text-align:left">Descrição</th>
        <th style="padding:8px;text-align:left">Data</th>
        <th style="padding:8px;text-align:right">Valor</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:24px;color:#64748b;font-size:13px">Enviado automaticamente pelo NunFi.</p>
</body>
</html>`
}

// ─── Web Push ────────────────────────────────────────────────────────────────

async function sendWebPush(
  userId: string,
  count: number,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[WebPush] VAPID não configurado, pulando.')
    return
  }

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('subscription, endpoint')
    .eq('user_id', userId)

  if (error || !subs?.length) {
    console.log(`[WebPush] Sem subscriptions para user=${userId}`)
    return
  }

  const payload = JSON.stringify({
    title: 'NunFi — Contas a pagar',
    body: `Você tem ${count} conta(s) a vencer nos próximos ${DAYS_AHEAD} dias.`,
    url: '/#/transactions',
  })

  await Promise.all(
    subs.map(async (row: { subscription: Record<string, unknown>; endpoint: string }) => {
      try {
        await webpush.sendNotification(row.subscription, payload)
        console.log(`[WebPush] Enviado para endpoint=${row.endpoint.slice(0, 40)}...`)
      } catch (e: unknown) {
        const err = e as { statusCode?: number; body?: string; message?: string }
        console.error(`[WebPush] Falha endpoint=${row.endpoint.slice(0, 40)}: ${err.body ?? err}`)
        if (err.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', row.endpoint)
        }
      }
    })
  )
}

async function sendEmail(email: string, items: Transaction[]): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      subject: `NunFi: ${items.length} transação(ões) a vencer nos próximos dias`,
      html: buildEmailHtml(items),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    console.error(`[Resend] Falha email=${email}: ${err.message ?? res.status}`)
  } else {
    console.log(`[Resend] Email enviado para ${email}`)
  }
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const today = new Date()
    const ahead = new Date()
    ahead.setDate(today.getDate() + DAYS_AHEAD)
    const todayStr = today.toISOString().split('T')[0]
    const aheadStr = ahead.toISOString().split('T')[0]

    // 1. Busca transações a vencer — sem JOIN com auth.users (não suportado pelo PostgREST)
    const { data: rows, error } = await supabase
      .from('transactions')
      .select('user_id, description, date, amount, type')
      .eq('is_paid', false)
      .gte('date', todayStr)
      .lte('date', aheadStr)

    if (error) {
      console.error('[DB] Erro ao buscar transações:', error.message)
      return jsonResponse({ error: error.message }, 500)
    }

    if (!rows || rows.length === 0) {
      console.log('[Scheduler] Nenhuma transação a vencer encontrada.')
      return jsonResponse({ ok: true, usersNotified: 0 }, 200)
    }

    // 2. Busca emails dos usuários únicos via admin API
    const userIds = [...new Set(rows.map((r: any) => r.user_id as string))]
    const emailMap = new Map<string, string>()

    await Promise.all(
      userIds.map(async (uid) => {
        const { data } = await supabase.auth.admin.getUserById(uid)
        if (data?.user?.email) emailMap.set(uid, data.user.email)
      })
    )

    // 3. Agrupa transações por usuário
    const byUser = new Map<string, UserReport>()
    for (const row of rows as any[]) {
      const userId: string = row.user_id
      const email = emailMap.get(userId) ?? ''
      if (!email) continue

      if (!byUser.has(userId)) {
        byUser.set(userId, { userId, email, items: [] })
      }
      byUser.get(userId)!.items.push({
        description: row.description,
        date: row.date,
        amount: row.amount,
        type: row.type,
      })
    }

    console.log(`[Scheduler] ${byUser.size} usuário(s) com transações a vencer.`)

    // 4. Dispara Pusher + Web Push + Email para cada usuário
    const results = await Promise.allSettled(
      Array.from(byUser.values()).map(async ({ userId, email, items }) => {
        await triggerPusher(userId, items.length)
        await sendWebPush(userId, items.length, supabase)
        await sendEmail(email, items)
        return { userId, count: items.length }
      })
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    return jsonResponse({ ok: true, usersNotified: succeeded, failed }, 200)

  } catch (e) {
    console.error('[Scheduler] Erro inesperado:', e)
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      500
    )
  }
})