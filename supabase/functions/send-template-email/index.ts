// Supabase Edge Function: envia a planilha modelo por e-mail ao usuário logado (Resend).
// Configurar: supabase secrets set RESEND_API_KEY=re_xxx
// Opcional: FROM_EMAIL (ex: "My Fin App <noreply@seudominio.com>")
// Um único arquivo: pode colar direto no dashboard (sem templateDefinition.ts).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'My Fin App <onboarding@resend.dev>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-jwt',
}

const TRANSACTIONS_HEADERS = [
  'type', 'amount', 'description', 'date', 'account_name', 'category_name',
  'is_paid', 'payment_mode', 'installments_total', 'notes',
]
const GROUPS_HEADERS = [
  'name', 'type', 'account_name', 'category_name', 'payment_mode',
  'amount_per_installment', 'amount_total', 'installments_total',
  'recurrence_period', 'start_date', 'recurrence_end_date',
]
const TRANSACTIONS_INSTRUCTION = 'Preencha a partir da linha 4. Colunas: type (income/expense/transfer), amount, description, date, account_name, category_name, is_paid (true/false), payment_mode, installments_total, notes'
const GROUPS_INSTRUCTION = 'Preencha a partir da linha 4. Colunas: name, type, account_name, category_name, payment_mode (single/recurring/installments), amount_per_installment, amount_total, installments_total, recurrence_period, start_date, recurrence_end_date'

function buildTemplateXlsxBase64(): string {
  const wb = XLSX.utils.book_new()
  const transactionsData = [
    ['Transações'],
    [TRANSACTIONS_INSTRUCTION],
    TRANSACTIONS_HEADERS,
  ]
  const wsTransactions = XLSX.utils.aoa_to_sheet(transactionsData)
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'transactions')
  const groupsData = [
    ['Grupos / Parcelamentos'],
    [GROUPS_INSTRUCTION],
    GROUPS_HEADERS,
  ]
  const wsGroups = XLSX.utils.aoa_to_sheet(groupsData)
  XLSX.utils.book_append_sheet(wb, wsGroups, 'transaction_groups')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
  return buf
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

    // Safari/iOS e alguns gateways podem não repassar Authorization; aceitar também X-Client-JWT
    const authHeader = req.headers.get('Authorization')
    const customJwt = req.headers.get('X-Client-JWT')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.replace('Bearer ', '')
      : customJwt?.trim() ?? null
    if (!token) {
      return jsonResponse({ error: 'Não autorizado' }, 401)
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user?.email) {
      return jsonResponse({ error: 'Usuário não encontrado' }, 401)
    }

    const base64 = buildTemplateXlsxBase64()
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [user.email],
        subject: 'Planilha modelo My Fin App',
        html: '<p>Segue em anexo a planilha modelo para importar transações e grupos no My Fin App.</p><p>Preencha conforme as instruções em cada aba e use a opção Importar planilha no app.</p>',
        attachments: [
          { filename: 'finapp_import_v3.xlsx', content: base64 },
        ],
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      return jsonResponse(
        { error: (data as { message?: string }).message || 'Falha ao enviar e-mail' },
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
