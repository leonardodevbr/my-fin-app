// Supabase Edge Function: envia relatório por e-mail (transações a vencer, etc.) via Resend.
// Configurar: RESEND_API_KEY, opcional FROM_EMAIL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'NunFi <onboarding@resend.dev>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-jwt',
}

interface ReportItem {
  description: string
  date: string
  amount: number
  type: string
  is_paid?: boolean
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function buildDueReportHtml(items: ReportItem[]): string {
  const rows = items
    .map(
      (t) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0">${escapeHtml(t.description)}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0">${t.date}</td>
      <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right">${t.type === 'expense' ? '-' : '+'}${formatCents(t.amount)}</td>
    </tr>`
    )
    .join('')
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Relatório - Transações a vencer</title></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:16px">
  <h1 style="color:#0f172a">Transações a vencer</h1>
  <p>Segue o relatório de transações com vencimento nos próximos dias (não pagas).</p>
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
  <p style="margin-top:24px;color:#64748b;font-size:14px">Enviado pelo NunFi.</p>
</body>
</html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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
    if (!RESEND_API_KEY) {
      return jsonResponse({ error: 'RESEND_API_KEY não configurada' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    const customJwt = req.headers.get('X-Client-JWT')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : customJwt?.trim() ?? null
    if (!token) {
      return jsonResponse({ error: 'Não autorizado' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    })
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user?.email) {
      return jsonResponse({ error: 'Usuário não encontrado' }, 401)
    }

    const body = await req.json().catch(() => ({})) as { reportType?: string; items?: ReportItem[] }
    const reportType = body.reportType ?? 'due'
    const items = Array.isArray(body.items) ? body.items : []

    let subject: string
    let html: string

    if (reportType === 'due') {
      subject = items.length > 0
        ? `NunFi: ${items.length} transação(ões) a vencer`
        : 'NunFi: Relatório de transações a vencer'
      html = buildDueReportHtml(items)
    } else {
      return jsonResponse({ error: 'reportType não suportado' }, 400)
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [user.email],
        subject,
        html,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return jsonResponse(
        { error: (data as { message?: string }).message ?? 'Falha ao enviar e-mail' },
        res.status
      )
    }
    return jsonResponse({ ok: true, id: (data as { id?: string }).id }, 200)
  } catch (e) {
    return jsonResponse(
      { error: e instanceof Error ? e.message : 'Erro interno' },
      500
    )
  }
})
