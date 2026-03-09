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

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

const hasEfiPayeeCode = Boolean(import.meta.env.VITE_EFI_PAYEE_CODE)

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
  const [cardHolderPhone, setCardHolderPhone] = useState('')
  const [addressZip, setAddressZip] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressNumber, setAddressNumber] = useState('')
  const [addressNeighborhood, setAddressNeighborhood] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressState, setAddressState] = useState('')
  const [addressComplement, setAddressComplement] = useState('')
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

      const phoneDigits = cardHolderPhone.replace(/\D/g, '')
      if (phoneDigits.length < 10) {
        toast.error('Telefone é obrigatório (DDD + número, ex.: 11999999999).')
        return
      }

      const zipDigits = addressZip.replace(/\D/g, '')
      if (zipDigits.length !== 8 || !addressStreet.trim() || !addressNumber.trim() || !addressNeighborhood.trim() || !addressCity.trim() || !addressState.trim()) {
        toast.error('Preencha o endereço completo: CEP, rua, número, bairro, cidade e estado.')
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

      if (!hasEfiPayeeCode) {
        toast.error('Pagamento com cartão não está disponível no momento. Use PIX.')
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

        let data: { ok?: boolean; error?: string } | null = null
        let error: Error | null = null
        try {
          const result = await supabase.functions.invoke('efi-card-charge', {
            body: {
              paymentToken,
              cardMask,
              customer: {
                name: cardHolderName || user?.email || '',
                cpf: cpfDigits,
                email: user?.email ?? '',
                phone_number: cardHolderPhone ? cardHolderPhone.replace(/\D/g, '') : undefined,
                address: {
                  zipcode: addressZip.replace(/\D/g, ''),
                  street: addressStreet.trim(),
                  number: addressNumber.trim(),
                  neighborhood: addressNeighborhood.trim(),
                  city: addressCity.trim(),
                  state: addressState.trim().toUpperCase().slice(0, 2),
                  complement: addressComplement.trim() || undefined,
                },
              },
            },
          })
          data = result.data
          error = result.error
        } catch (invokeErr: any) {
          const m = invokeErr?.message ?? ''
          if (m.includes('Unexpected token') || m.includes('is not valid JSON')) {
            toast.error('Serviço de pagamento indisponível. Verifique a URL do Supabase no deploy e se a função efi-card-charge está publicada.')
            return
          }
          throw invokeErr
        }

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
            <div className="flex gap-2 rounded-xl p-1.5 bg-surface-100">
              <button
                type="button"
                onClick={() => setMethod('pix')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  method === 'pix'
                    ? 'border-primary-400 bg-primary-50 text-primary-800 shadow-sm'
                    : 'border-transparent bg-surface-200/60 text-surface-600 hover:bg-surface-200 hover:text-surface-700'
                }`}
              >
                <QrCode className="h-5 w-5 shrink-0" />
                PIX
              </button>
              {hasEfiPayeeCode && (
                <button
                  type="button"
                  onClick={() => setMethod('card')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                    method === 'card'
                      ? 'border-primary-400 bg-primary-50 text-primary-800 shadow-sm'
                      : 'border-transparent bg-surface-200/60 text-surface-600 hover:bg-surface-200 hover:text-surface-700'
                  }`}
                >
                  <CreditCard className="h-5 w-5 shrink-0" />
                  Cartão
                </button>
              )}
            </div>

            {method === 'pix' || !hasEfiPayeeCode ? (
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
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
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
                      onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                      className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder="MM/AA"
                      maxLength={5}
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <label className="block text-xs font-medium text-surface-600">CVV</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="cc-csc"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder="123"
                      maxLength={4}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-surface-600">CPF do titular (obrigatório)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={cardHolderDocument}
                    onChange={(e) => setCardHolderDocument(formatCpf(e.target.value))}
                    className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-surface-600">Telefone (obrigatório para cartão)</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={cardHolderPhone}
                    onChange={(e) => setCardHolderPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                    placeholder="11999999999"
                    maxLength={11}
                  />
                </div>
                <div className="border-t border-surface-200 pt-3">
                  <p className="mb-2 text-xs font-medium text-surface-600">Endereço (obrigatório para cartão)</p>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={addressZip}
                        onChange={(e) => setAddressZip(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        onBlur={async (e) => {
                          const z = (e.target as HTMLInputElement).value.replace(/\D/g, '')
                          if (z.length !== 8) return
                          try {
                            const r = await fetch(`https://viacep.com.br/ws/${z}/json/`)
                            const data = await r.json()
                            if (!data.erro) {
                              setAddressStreet(data.logradouro ?? '')
                              setAddressNeighborhood(data.bairro ?? '')
                              setAddressCity(data.localidade ?? '')
                              setAddressState(data.uf ?? '')
                            }
                          } catch {
                            // ignora erro de CEP
                          }
                        }}
                        className="w-28 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        placeholder="CEP"
                        maxLength={8}
                      />
                      <input
                        type="text"
                        value={addressStreet}
                        onChange={(e) => setAddressStreet(e.target.value)}
                        className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        placeholder="Rua"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={addressNumber}
                        onChange={(e) => setAddressNumber(e.target.value)}
                        className="w-24 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        placeholder="Nº"
                      />
                      <input
                        type="text"
                        value={addressNeighborhood}
                        onChange={(e) => setAddressNeighborhood(e.target.value)}
                        className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        placeholder="Bairro"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={addressCity}
                        onChange={(e) => setAddressCity(e.target.value)}
                        className="flex-1 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        placeholder="Cidade"
                      />
                      <input
                        type="text"
                        value={addressState}
                        onChange={(e) => setAddressState(e.target.value.toUpperCase().slice(0, 2))}
                        className="w-16 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                        placeholder="UF"
                        maxLength={2}
                      />
                    </div>
                    <input
                      type="text"
                      value={addressComplement}
                      onChange={(e) => setAddressComplement(e.target.value)}
                      className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      placeholder="Complemento (opcional)"
                    />
                  </div>
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

