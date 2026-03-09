import { useState, useEffect, FormEvent } from 'react'
import { Crown, CheckCircle, Copy, RefreshCw, QrCode, Clock, Zap, XCircle, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import EfiPay from 'payment-token-efi'
import { useAuth } from '../../hooks/useAuth'
import { usePusher } from '../../hooks/usePusher'
import { useSubscription } from '../../hooks/useSubscription'
import { getSupabase } from '../../lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'

const FEATURES = [
  'Transações ilimitadas',
  'Notificações push (contas a vencer)',
  'Relatórios por email automáticos',
  'Projeção financeira',
  'Importação de extratos',
  'Sincronização multi-dispositivo',
]

export function SubscriptionPage() {
  const { user } = useAuth()
  const { lastNotification, clearNotification } = usePusher(user?.id)
  const sub = useSubscription()
  const [method, setMethod] = useState<'pix' | 'card'>('pix')
  const [generating, setGenerating] = useState(false)
  const [checking, setChecking] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cardProcessing, setCardProcessing] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolderName, setCardHolderName] = useState('')
  const [cardHolderDocument, setCardHolderDocument] = useState('')
  const [cardExpiry, setCardExpiry] = useState('') // MM/AA
  const [cardCvv, setCardCvv] = useState('')
  const [pixData, setPixData] = useState<{
    pixCopiaECola: string
    qrCodeImage: string | null
    amountCents: number
    expiresAt: string
    txid: string
  } | null>(null)

  const handleGeneratePix = async () => {
    setGenerating(true)
    try {
      const supabase = getSupabase()
      if (!supabase) return
      const { data, error } = await supabase.functions.invoke('efi-create-charge')
      if (error || !data) { toast.error('Erro ao gerar cobrança. Tente novamente.'); return }
      setPixData(data)
    } finally {
      setGenerating(false)
    }
  }

  const handlePayWithCard = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (cardProcessing) return
    setCardProcessing(true)
    try {
      const supabase = getSupabase()
      if (!supabase) return

      const cleanNumber = cardNumber.replace(/\D/g, '')
      const [mmRaw, yyRaw] = cardExpiry.split('/')
      const mm = (mmRaw ?? '').trim()
      const yy = (yyRaw ?? '').trim()

      if (!cleanNumber || !mm || !yy || !cardCvv) {
        toast.error('Preencha todos os dados do cartão.')
        return
      }

      const cpfDigits = cardHolderDocument?.replace(/\D/g, '') ?? ''
      if (cpfDigits.length !== 11) {
        toast.error('CPF do titular é obrigatório (11 dígitos) para pagamento com cartão.')
        return
      }

      const year = yy.length === 2 ? `20${yy}` : yy

      let brand: string
      try {
        brand = await EfiPay.CreditCard.setCardNumber(cleanNumber).verifyCardBrand()
      } catch {
        toast.error('Cartão inválido ou não suportado.')
        return
      }

      try {
        const result = await EfiPay.CreditCard
          .setAccount(import.meta.env.VITE_EFI_PAYEE_CODE as string)
          .setEnvironment((import.meta.env.VITE_EFI_ENV as 'production' | 'sandbox') || 'sandbox')
          .setCreditCardData({
            brand,
            number: cleanNumber,
            cvv: cardCvv,
            expirationMonth: mm,
            expirationYear: year,
            holderName: cardHolderName || user?.email || '',
            holderDocument: cpfDigits,
            reuse: false,
          })
          .getPaymentToken()

        const paymentToken = (result as { payment_token: string }).payment_token
        const cardMask = (result as { card_mask?: string }).card_mask

        const { data, error } = await supabase.functions.invoke('efi-card-charge', {
          body: {
            paymentToken,
            cardMask,
            customer: {
              name: cardHolderName || user?.email || '',
              cpf: cpfDigits,
              email: user?.email ?? '',
            },
          },
        })

        if (error || !data?.ok) {
          toast.error(data?.error ?? 'Pagamento não aprovado.')
          return
        }

        await sub.refresh()
        toast.success('Assinatura ativada no cartão! 🎉')
      } catch (err: any) {
        const msg = err?.error_description ?? err?.message ?? 'Erro ao processar cartão.'
        toast.error(msg)
      }
    } finally {
      setCardProcessing(false)
    }
  }

  const copyPix = async () => {
    if (!pixData?.pixCopiaECola) return
    await navigator.clipboard.writeText(pixData.pixCopiaECola)
    toast.success('Código PIX copiado!')
  }

  const checkPayment = async () => {
    setChecking(true)
    await sub.refresh()
    setChecking(false)
    if (sub.isProActive) {
      toast.success('Assinatura ativada! 🎉')
      setPixData(null)
    } else {
      toast('Pagamento ainda não confirmado. Aguarde alguns segundos.', { icon: '⏳' })
    }
  }

  const handleRequestCancel = async () => {
    setCancelling(true)
    try {
      const supabase = getSupabase()
      if (!supabase) return
      const { data, error } = await supabase.functions.invoke('request-subscription-cancel')
      if (error) {
        toast.error(data?.error ?? 'Erro ao enviar pedido. Tente novamente.')
        return
      }
      toast.success('Pedido de cancelamento enviado. Nossa equipe processará em breve.')
    } finally {
      setCancelling(false)
    }
  }

  // Push em tempo real: quando o webhook confirma o PIX, Pusher dispara e atualizamos na hora
  useEffect(() => {
    if (lastNotification?.type === 'subscription-activated') {
      sub.refresh().then(() => {
        toast.success('Pagamento confirmado! Assinatura ativada 🎉')
        setPixData(null)
        clearNotification()
      })
      return
    }
    if (lastNotification?.type === 'subscription-canceled') {
      sub.refresh().then(() => {
        toast('Assinatura cancelada (devolução do PIX).', { icon: 'ℹ️' })
        clearNotification()
      })
    }
  }, [lastNotification?.type])

  if (sub.loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <RefreshCw className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <h1 className="text-xl font-bold text-surface-900">Assinatura</h1>

      {/* Status atual (único aviso de assinatura na tela) */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className={`rounded-full p-2 ${sub.isProActive ? 'bg-yellow-100' : 'bg-surface-100'}`}>
            <Crown className={`h-5 w-5 ${sub.isProActive ? 'text-yellow-500' : 'text-surface-400'}`} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-surface-900">
              {sub.isProActive ? 'NunFi Pro' : sub.isTrialActive ? 'Trial gratuito' : 'Sem assinatura ativa'}
            </p>
            <p className="text-sm text-surface-500">
              {sub.isTrialActive && `${sub.daysRemaining} dias restantes de trial`}
              {sub.isProActive && `Ativo até ${new Date(sub.currentPeriodEnd!).toLocaleDateString('pt-BR')}`}
              {!sub.hasAccess && 'Seu acesso expirou'}
            </p>
          </div>
          {sub.hasAccess && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Ativo</span>
          )}
        </CardContent>
        {sub.isProActive && (
          <div className="border-t border-surface-100 px-4 py-3">
            <button
              type="button"
              onClick={handleRequestCancel}
              disabled={cancelling}
              className="flex w-full items-center justify-center gap-2 text-sm text-surface-500 hover:text-red-600 disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              {cancelling ? 'Enviando...' : 'Solicitar cancelamento'}
            </button>
            <p className="mt-1 text-center text-xs text-surface-400">
              Enviaremos seu pedido por e-mail para processamento em até 48h.
            </p>
          </div>
        )}
      </Card>

      {/* Plano Pro */}
      {!sub.isProActive && (
        <Card className="border-primary-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-primary-500" />
              NunFi Pro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-surface-900">R$ 9,90</span>
              <span className="text-sm text-surface-500">/mês</span>
            </div>

            <ul className="space-y-1.5">
              {FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-surface-700">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" />
                  {f}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 rounded-lg bg-surface-50 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setMethod('pix')}
                className={`flex-1 rounded-md px-3 py-1 ${
                  method === 'pix' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500'
                }`}
              >
                PIX
              </button>
              <button
                type="button"
                onClick={() => setMethod('card')}
                className={`flex-1 rounded-md px-3 py-1 ${
                  method === 'card' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500'
                }`}
              >
                Cartão de crédito
              </button>
            </div>

            {method === 'pix' ? (
              !pixData ? (
                <button
                  onClick={handleGeneratePix}
                  disabled={generating}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  <QrCode className="h-4 w-4" />
                  {generating ? 'Gerando PIX...' : 'Assinar com PIX'}
                </button>
              ) : (
                <div className="space-y-3">
                  {pixData.qrCodeImage && (
                    <img
                      src={pixData.qrCodeImage.startsWith('data:') ? pixData.qrCodeImage : `data:image/png;base64,${pixData.qrCodeImage}`}
                      alt="QR Code PIX"
                      className="mx-auto h-44 w-44 rounded-xl border border-surface-200"
                    />
                  )}
                  <button
                    onClick={copyPix}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary-300 bg-white px-4 py-2.5 text-sm font-medium text-primary-700 hover:bg-primary-50"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar código PIX
                  </button>
                  <p className="flex items-center justify-center gap-1 text-center text-xs text-surface-500">
                    <Clock className="h-3 w-3" />
                    Expira em 1 hora. Após pagar, clique abaixo.
                  </p>
                  <button
                    onClick={checkPayment}
                    disabled={checking}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
                    {checking ? 'Verificando...' : 'Já paguei — verificar'}
                  </button>
                  <button
                    onClick={() => setPixData(null)}
                    className="w-full text-center text-xs text-surface-400 underline hover:text-surface-600"
                  >
                    Cancelar e gerar novo
                  </button>
                </div>
              )
            ) : (
              <form className="space-y-3" onSubmit={handlePayWithCard}>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-surface-600">Número do cartão</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="0000 0000 0000 0000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-surface-600">Nome impresso no cartão</label>
                  <input
                    type="text"
                    autoComplete="cc-name"
                    value={cardHolderName}
                    onChange={(e) => setCardHolderName(e.target.value)}
                    className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="Nome completo"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="block text-xs font-medium text-surface-600">Validade</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-exp"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder="MM/AA"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="block text-xs font-medium text-surface-600">CVV</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder="123"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-surface-600">CPF do titular (obrigatório)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cardHolderDocument}
                    onChange={(e) => setCardHolderDocument(e.target.value)}
                    className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="11 dígitos, somente números"
                    maxLength={14}
                  />
                </div>
                <button
                  type="submit"
                  disabled={cardProcessing}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                >
                  <CreditCard className="h-4 w-4" />
                  {cardProcessing ? 'Processando...' : 'Assinar com cartão'}
                </button>
                <p className="text-xs text-surface-400">
                  Pagamento processado pela Efí. Seus dados de cartão não são armazenados pelo NunFi.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <PaymentHistory />
    </div>
  )
}

function PaymentHistory() {
  const [payments, setPayments] = useState<Array<{
    id: string; amount_cents: number; status: string; paid_at: string | null; created_at: string
  }>>([])

  useEffect(() => {
    const load = async () => {
      const supabase = getSupabase()
      if (!supabase) return
      const { data } = await supabase
        .from('payment_history')
        .select('id, amount_cents, status, paid_at, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setPayments(data)
    }
    void load()
  }, [])

  if (!payments.length) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-surface-600">Histórico de pagamentos</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-surface-100 p-0">
        {payments.map(p => (
          <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <div>
              <p className="font-medium text-surface-800">NunFi Pro</p>
              <p className="text-xs text-surface-400">{new Date(p.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
            <div className="text-right">
              <p className="font-medium">R$ {(p.amount_cents / 100).toFixed(2)}</p>
              <span className={`text-xs font-medium ${
                p.status === 'paid' ? 'text-green-600' :
                p.status === 'refunded' ? 'text-slate-500' :
                p.status === 'failed' ? 'text-red-600' : 'text-amber-500'
              }`}>
                {p.status === 'paid' ? 'Pago' : p.status === 'refunded' ? 'Devolvido' : p.status === 'failed' ? 'Falhou' : 'Pendente'}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

