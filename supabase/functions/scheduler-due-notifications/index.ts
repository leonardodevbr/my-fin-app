// Supabase Edge Function: scheduler-due-notifications
// Chamada pelo pg_cron todo dia às 8h (BRT).
// Para cada usuário com transações a vencer nos próximos 14 dias:
//   1. Dispara notificação Pusher (tempo real no app)
//   2. Envia Web Push via VAPID nativo (sem npm:web-push)
//   3. Envia email via Resend

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'NunFi <onboarding@resend.dev>'
const PUSHER_APP_ID = Deno.env.get('PUSHER_APP_ID')!
const PUSHER_KEY = Deno.env.get('PUSHER_KEY')!
const PUSHER_SECRET = Deno.env.get('PUSHER_SECRET')!
const PUSHER_CLUSTER = Deno.env.get('PUSHER_CLUSTER') ?? 'sa1'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contato@nunfi.com'

const DAYS_AHEAD = 14

interface Transaction { description: string; date: string; amount: number; type: string }
interface UserReport { userId: string; email: string; items: Transaction[] }

function jsonResponse(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Helpers crypto ───────────────────────────────────────────────────────────

function base64UrlToUint8Array(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - base64url.length % 4) % 4)
  const b64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// MD5 puro em JS (sem dependências externas)
function md5Hex(message: string): string {
  function safeAdd(x: number, y: number) { const lsw=(x&0xFFFF)+(y&0xFFFF); return (((x>>16)+(y>>16)+(lsw>>16))<<16)|(lsw&0xFFFF) }
  function bitRotateLeft(num: number, cnt: number) { return (num<<cnt)|(num>>>(32-cnt)) }
  function md5cmn(q:number,a:number,b:number,x:number,s:number,t:number){return safeAdd(bitRotateLeft(safeAdd(safeAdd(a,q),safeAdd(x,t)),s),b)}
  function md5ff(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn((b&c)|((~b)&d),a,b,x,s,t)}
  function md5gg(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn((b&d)|(c&(~d)),a,b,x,s,t)}
  function md5hh(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn(b^c^d,a,b,x,s,t)}
  function md5ii(a:number,b:number,c:number,d:number,x:number,s:number,t:number){return md5cmn(c^(b|(~d)),a,b,x,s,t)}
  const bytes = new TextEncoder().encode(message)
  const len8 = bytes.length
  const len32 = Math.ceil((len8+9)/64)*16
  const M = new Int32Array(len32)
  for(let i=0;i<len8;i++) M[i>>2]|=bytes[i]<<((i%4)*8)
  M[len8>>2]|=0x80<<((len8%4)*8)
  M[len32-2]=len8*8
  let a=1732584193,b=-271733879,c=-1732584194,d=271733878
  for(let i=0;i<len32;i+=16){
    const [A,B,C,D]=[a,b,c,d]
    a=md5ff(a,b,c,d,M[i],7,-680876936);d=md5ff(d,a,b,c,M[i+1],12,-389564586);c=md5ff(c,d,a,b,M[i+2],17,606105819);b=md5ff(b,c,d,a,M[i+3],22,-1044525330)
    a=md5ff(a,b,c,d,M[i+4],7,-176418897);d=md5ff(d,a,b,c,M[i+5],12,1200080426);c=md5ff(c,d,a,b,M[i+6],17,-1473231341);b=md5ff(b,c,d,a,M[i+7],22,-45705983)
    a=md5ff(a,b,c,d,M[i+8],7,1770035416);d=md5ff(d,a,b,c,M[i+9],12,-1958414417);c=md5ff(c,d,a,b,M[i+10],17,-42063);b=md5ff(b,c,d,a,M[i+11],22,-1990404162)
    a=md5ff(a,b,c,d,M[i+12],7,1804603682);d=md5ff(d,a,b,c,M[i+13],12,-40341101);c=md5ff(c,d,a,b,M[i+14],17,-1502002290);b=md5ff(b,c,d,a,M[i+15],22,1236535329)
    a=md5gg(a,b,c,d,M[i+1],5,-165796510);d=md5gg(d,a,b,c,M[i+6],9,-1069501632);c=md5gg(c,d,a,b,M[i+11],14,643717713);b=md5gg(b,c,d,a,M[i],20,-373897302)
    a=md5gg(a,b,c,d,M[i+5],5,-701558691);d=md5gg(d,a,b,c,M[i+10],9,38016083);c=md5gg(c,d,a,b,M[i+15],14,-660478335);b=md5gg(b,c,d,a,M[i+4],20,-405537848)
    a=md5gg(a,b,c,d,M[i+9],5,568446438);d=md5gg(d,a,b,c,M[i+14],9,-1019803690);c=md5gg(c,d,a,b,M[i+3],14,-187363961);b=md5gg(b,c,d,a,M[i+8],20,1163531501)
    a=md5gg(a,b,c,d,M[i+13],5,-1444681467);d=md5gg(d,a,b,c,M[i+2],9,-51403784);c=md5gg(c,d,a,b,M[i+7],14,1735328473);b=md5gg(b,c,d,a,M[i+12],20,-1926607734)
    a=md5hh(a,b,c,d,M[i+5],4,-378558);d=md5hh(d,a,b,c,M[i+8],11,-2022574463);c=md5hh(c,d,a,b,M[i+11],16,1839030562);b=md5hh(b,c,d,a,M[i+14],23,-35309556)
    a=md5hh(a,b,c,d,M[i+1],4,-1530992060);d=md5hh(d,a,b,c,M[i+4],11,1272893353);c=md5hh(c,d,a,b,M[i+7],16,-155497632);b=md5hh(b,c,d,a,M[i+10],23,-1094730640)
    a=md5hh(a,b,c,d,M[i+13],4,681279174);d=md5hh(d,a,b,c,M[i],11,-358537222);c=md5hh(c,d,a,b,M[i+3],16,-722521979);b=md5hh(b,c,d,a,M[i+6],23,76029189)
    a=md5hh(a,b,c,d,M[i+9],4,-640364487);d=md5hh(d,a,b,c,M[i+12],11,-421815835);c=md5hh(c,d,a,b,M[i+15],16,530742520);b=md5hh(b,c,d,a,M[i+2],23,-995338651)
    a=md5ii(a,b,c,d,M[i],6,-198630844);d=md5ii(d,a,b,c,M[i+7],10,1126891415);c=md5ii(c,d,a,b,M[i+14],15,-1416354905);b=md5ii(b,c,d,a,M[i+5],21,-57434055)
    a=md5ii(a,b,c,d,M[i+12],6,1700485571);d=md5ii(d,a,b,c,M[i+3],10,-1894986606);c=md5ii(c,d,a,b,M[i+10],15,-1051523);b=md5ii(b,c,d,a,M[i+1],21,-2054922799)
    a=md5ii(a,b,c,d,M[i+8],6,1873313359);d=md5ii(d,a,b,c,M[i+15],10,-30611744);c=md5ii(c,d,a,b,M[i+6],15,-1560198380);b=md5ii(b,c,d,a,M[i+13],21,1309151649)
    a=md5ii(a,b,c,d,M[i+4],6,-145523070);d=md5ii(d,a,b,c,M[i+11],10,-1120210379);c=md5ii(c,d,a,b,M[i+2],15,718787259);b=md5ii(b,c,d,a,M[i+9],21,-343485551)
    a=safeAdd(a,A);b=safeAdd(b,B);c=safeAdd(c,C);d=safeAdd(d,D)
  }
  return [a,b,c,d].map(n=>(n>>>0).toString(16).padStart(8,'0').match(/../g)!.reverse().join('')).join('')
}

// ─── VAPID JWT para Web Push ──────────────────────────────────────────────────

async function buildVapidJwt(audience: string): Promise<string> {
  const header = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  )
  const now = Math.floor(Date.now() / 1000)
  const payload = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify({
      aud: audience,
      exp: now + 12 * 3600,
      sub: VAPID_SUBJECT,
    }))
  )
  const signingInput = `${header}.${payload}`

  // Public key VAPID é um ponto EC não-comprimido: 0x04 + X(32 bytes) + Y(32 bytes) = 65 bytes
  // Decodifica e extrai X e Y para montar o JWK
  const pubKeyBytes = base64UrlToUint8Array(VAPID_PUBLIC_KEY)
  // pubKeyBytes[0] == 0x04 (uncompressed point marker)
  const x = uint8ArrayToBase64Url(pubKeyBytes.slice(1, 33))
  const y = uint8ArrayToBase64Url(pubKeyBytes.slice(33, 65))

  const key = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: VAPID_PRIVATE_KEY,
      x,
      y,
      key_ops: ['sign'],
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  )
  const sig = uint8ArrayToBase64Url(new Uint8Array(signature))
  return `${signingInput}.${sig}`
}

// ─── Web Push ─────────────────────────────────────────────────────────────────

async function sendWebPush(userId: string, count: number, supabase: ReturnType<typeof createClient>): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log('[WebPush] VAPID não configurado, pulando.')
    return
  }

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('subscription, endpoint')
    .eq('user_id', userId)

  if (error) { console.error('[WebPush] Erro ao buscar subs:', error.message); return }
  if (!subs?.length) { console.log(`[WebPush] Sem subscriptions para user=${userId}`); return }

  const payload = JSON.stringify({
    title: 'NunFi — Contas a pagar',
    body: `Você tem ${count} conta(s) a vencer nos próximos ${DAYS_AHEAD} dias.`,
    url: '/#/transactions',
  })

  for (const row of subs as { subscription: { endpoint: string; keys: { p256dh: string; auth: string } }; endpoint: string }[]) {
    try {
      const sub = row.subscription
      const endpoint = sub.endpoint
      const p256dh = sub.keys.p256dh
      const auth = sub.keys.auth

      // Cifra o payload usando ECDH + AES-128-GCM (RFC 8291)
      const encrypted = await encryptWebPush(payload, p256dh, auth)

      const url = new URL(endpoint)
      const audience = `${url.protocol}//${url.host}`
      const jwt = await buildVapidJwt(audience)

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
          'TTL': '86400',
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
        },
        body: encrypted,
      })

      if (res.ok || res.status === 201) {
        console.log(`[WebPush] Enviado user=${userId}`)
      } else {
        const body = await res.text()
        console.error(`[WebPush] Falha ${res.status}: ${body}`)
        if (res.status === 410) {
          await supabase.from('push_subscriptions').delete()
            .eq('user_id', userId).eq('endpoint', endpoint)
        }
      }
    } catch (e) {
      console.error(`[WebPush] Erro: ${e instanceof Error ? e.message : e}`)
    }
  }
}

// ─── RFC 8291: Web Push payload encryption (aes128gcm) ───────────────────────

async function encryptWebPush(payload: string, p256dhBase64: string, authBase64: string): Promise<Uint8Array> {
  const encoder = new TextEncoder()
  const payloadBytes = encoder.encode(payload)

  // 1. Decodifica chaves do receptor
  const receiverPublicKey = base64UrlToUint8Array(p256dhBase64)
  const authSecret = base64UrlToUint8Array(authBase64)

  // 2. Gera par de chaves efêmero (sender)
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
  )

  // 3. Importa chave pública do receptor para ECDH
  const receiverKey = await crypto.subtle.importKey(
    'raw', receiverPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )

  // 4. Deriva shared secret via ECDH
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: receiverKey }, senderKeyPair.privateKey, 256
  )

  // 5. Exporta chave pública efêmera (65 bytes, uncompressed)
  const senderPublicKeyRaw = await crypto.subtle.exportKey('raw', senderKeyPair.publicKey)
  const senderPublicKey = new Uint8Array(senderPublicKeyRaw)

  // 6. Gera salt aleatório (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // 7. HKDF para derivar IKM (RFC 8291 section 3.3)
  const prk = await hkdf(
    new Uint8Array(sharedSecret),
    authSecret,
    concat(encoder.encode('WebPush: info '), receiverPublicKey, senderPublicKey),
    32
  )

  // 8. HKDF para derivar CEK e NONCE
  const cek = await hkdf(prk, salt, encoder.encode('Content-Encoding: aes128gcm '), 16)
  const nonce = await hkdf(prk, salt, encoder.encode('Content-Encoding: nonce '), 12)

  // 9. Cifra com AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const paddedPayload = concat(payloadBytes, new Uint8Array([0x02])) // padding delimiter
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload
  )

  // 10. Monta o record (RFC 8291): salt(16) + rs(4) + keyid_len(1) + keyid(65) + ciphertext
  const rs = new Uint8Array(4)
  new DataView(rs.buffer).setUint32(0, paddedPayload.length + 16 + 1, false) // record size
  const keyIdLen = new Uint8Array([senderPublicKey.length])
  return concat(salt, rs, keyIdLen, senderPublicKey, new Uint8Array(ciphertext))
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8)
  return new Uint8Array(bits)
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) { result.set(a, offset); offset += a.length }
  return result
}

// ─── Pusher ───────────────────────────────────────────────────────────────────

async function triggerPusher(userId: string, count: number): Promise<void> {
  const channel = `user-${userId}`
  const eventName = 'due-transactions'
  const bodyObj = {
    channel, name: eventName,
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
  const signature = await hmacSha256(PUSHER_SECRET, `POST\n${path}\n${queryParams}`)
  const url = `https://api-${PUSHER_CLUSTER}.pusher.com${path}?${queryParams}&auth_signature=${signature}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: bodyStr,
  })
  if (!res.ok) console.error(`[Pusher] Falha: ${await res.text()}`)
  else console.log(`[Pusher] Notificado user=${userId} (${count} transações)`)
}

// ─── Email ────────────────────────────────────────────────────────────────────

function escapeHtml(s: string) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}
function formatCents(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function buildEmailHtml(items: Transaction[]) {
  const rows = items.map(t => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(t.description)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0">${t.date}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;color:${t.type==='expense'?'#dc2626':'#16a34a'}">
        ${t.type==='expense'?'-':'+'}${formatCents(t.amount)}
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:16px">
  <h1 style="color:#0f172a">Transações a vencer</h1>
  <p>Você tem <strong>${items.length}</strong> transação(ões) nos próximos ${DAYS_AHEAD} dias.</p>
  <table style="width:100%;border-collapse:collapse;margin-top:16px">
    <thead><tr style="background:#f1f5f9">
      <th style="padding:8px;text-align:left">Descrição</th>
      <th style="padding:8px;text-align:left">Data</th>
      <th style="padding:8px;text-align:right">Valor</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="margin-top:24px;color:#64748b;font-size:13px">Enviado automaticamente pelo NunFi.</p>
</body></html>`
}

async function sendEmail(email: string, items: Transaction[]) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      subject: `NunFi: ${items.length} transação(ões) a vencer nos próximos dias`,
      html: buildEmailHtml(items),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    console.error(`[Resend] Falha: ${err.message ?? res.status}`)
  } else {
    console.log(`[Resend] Email enviado para ${email}`)
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

    const today = new Date()
    const ahead = new Date()
    ahead.setDate(today.getDate() + DAYS_AHEAD)
    const todayStr = today.toISOString().split('T')[0]
    const aheadStr = ahead.toISOString().split('T')[0]

    console.log(`[Scheduler] Buscando transações de ${todayStr} até ${aheadStr}`)

    const { data: rows, error } = await supabase
      .from('transactions')
      .select('user_id, description, date, amount, type')
      .eq('is_paid', false)
      .gte('date', todayStr)
      .lte('date', aheadStr)

    if (error) { console.error('[DB] Erro:', error.message); return jsonResponse({ error: error.message }, 500) }
    if (!rows?.length) { console.log('[Scheduler] Nenhuma transação encontrada.'); return jsonResponse({ ok: true, usersNotified: 0 }, 200) }

    console.log(`[Scheduler] ${rows.length} transação(ões) encontrada(s).`)

    const userIds = [...new Set(rows.map((r: any) => r.user_id as string))]
    const emailMap = new Map<string, string>()
    await Promise.all(userIds.map(async uid => {
      const { data } = await supabase.auth.admin.getUserById(uid)
      if (data?.user?.email) emailMap.set(uid, data.user.email)
    }))

    const byUser = new Map<string, UserReport>()
    for (const row of rows as any[]) {
      const userId = row.user_id as string
      const email = emailMap.get(userId) ?? ''
      if (!email) continue
      if (!byUser.has(userId)) byUser.set(userId, { userId, email, items: [] })
      byUser.get(userId)!.items.push({ description: row.description, date: row.date, amount: row.amount, type: row.type })
    }

    console.log(`[Scheduler] ${byUser.size} usuário(s) para notificar.`)

    const results = await Promise.allSettled(
      Array.from(byUser.values()).map(async ({ userId, email, items }) => {
        console.log(`[Scheduler] Processando user=${userId}`)

        try { await triggerPusher(userId, items.length) }
        catch (e) { console.error(`[Pusher] Excecao: ${e instanceof Error ? e.message : e}`) }

        try { await sendWebPush(userId, items.length, supabase) }
        catch (e) { console.error(`[WebPush] Excecao: ${e instanceof Error ? e.message : e}`) }

        try { await sendEmail(email, items) }
        catch (e) { console.error(`[Resend] Excecao: ${e instanceof Error ? e.message : e}`) }

        return { userId, count: items.length }
      })
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    console.log(`[Scheduler] Concluído. Sucesso: ${succeeded}, Falhas: ${failed}`)

    return jsonResponse({ ok: true, usersNotified: succeeded, failed }, 200)
  } catch (e) {
    console.error('[Scheduler] Erro inesperado:', e)
    return jsonResponse({ error: e instanceof Error ? e.message : 'Erro interno' }, 500)
  }
})