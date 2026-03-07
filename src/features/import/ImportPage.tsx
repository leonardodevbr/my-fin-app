import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, Mail, X } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import { getSupabase, supabaseUrl, supabaseAnonKey } from '../../lib/supabase'
import { ImportWizard } from './ImportWizard'
import { downloadTemplate } from './downloadTemplate'

const TEMPLATE_EMAIL_SENT_KEY = 'finapp_template_email_sent_at'
const COOLDOWN_MS = 60 * 60 * 1000 // 1 hora

function getNextSendInMs(): number {
  try {
    const sent = localStorage.getItem(TEMPLATE_EMAIL_SENT_KEY)
    if (!sent) return 0
    const at = Number(sent)
    const elapsed = Date.now() - at
    return elapsed >= COOLDOWN_MS ? 0 : COOLDOWN_MS - elapsed
  } catch {
    return 0
  }
}

export function ImportPage() {
  const { user } = useAuth()
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [nextSendInMs, setNextSendInMs] = useState(getNextSendInMs)

  useEffect(() => {
    const tick = setInterval(() => setNextSendInMs(getNextSendInMs()), 10_000)
    return () => clearInterval(tick)
  }, [])

  const handleDownloadTemplate = () => {
    downloadTemplate()
    toast.success('Modelo baixado')
    setTemplateModalOpen(false)
  }

  const handleSendToEmail = async () => {
    if (!user?.email) {
      toast.error('Faça login para usar esta opção')
      return
    }
    if (getNextSendInMs() > 0) return
    const supabase = getSupabase()
    if (!supabase) {
      toast.error('Sincronização não configurada')
      return
    }
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) {
      toast.error('Sessão expirada. Faça login novamente.', { duration: 5000 })
      return
    }
    setSendingEmail(true)
    try {
      const url = `${supabaseUrl}/functions/v1/send-template-email`
      const token = session.access_token
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Client-JWT': token,
          apikey: supabaseAnonKey,
        },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? `Erro ${res.status}`)
      }
      if (data?.error) throw new Error(data.error)
      localStorage.setItem(TEMPLATE_EMAIL_SENT_KEY, String(Date.now()))
      setNextSendInMs(COOLDOWN_MS)
      toast.success('E-mail enviado! Verifique sua caixa de entrada.')
      setTemplateModalOpen(false)
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : 'Falha ao enviar e-mail'
      const friendly =
        msg.includes('401') || msg.includes('JWT') || msg.includes('Invalid JWT')
          ? 'Sessão expirada ou inválida. Faça login novamente.'
          : msg
      toast.error(friendly, { duration: 5000 })
    } finally {
      setSendingEmail(false)
    }
  }

  const cooldownRemaining = nextSendInMs > 0
  const sendEmailDisabled = sendingEmail || cooldownRemaining
  const cooldownMin = Math.ceil(nextSendInMs / 60_000)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-surface-900">Importar planilha</h1>
      <p className="text-sm text-surface-600">
        Importe suas transações e grupos a partir da{' '}
        <button
          type="button"
          onClick={() => setTemplateModalOpen(true)}
          className="font-semibold text-primary-600 underline-offset-2 hover:underline cursor-pointer"
        >
          planilha modelo
        </button>
        .
      </p>
      <ImportWizard />

      {templateModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="template-modal-title">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setTemplateModalOpen(false)}
              aria-hidden
            />
            <div className="relative w-full max-w-sm rounded-xl border border-surface-200 bg-white px-4 py-3 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <h2 id="template-modal-title" className="text-base font-semibold text-surface-900">
                  Planilha modelo
                </h2>
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(false)}
                  className="p-1 rounded-lg text-surface-500 hover:bg-surface-100"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-primary-300 bg-white px-4 py-2 text-sm font-medium text-primary-700 shadow-sm hover:bg-primary-50"
                >
                  <Download className="h-4 w-4 shrink-0" />
                  Baixar modelo
                </button>
                <button
                  type="button"
                  onClick={handleSendToEmail}
                  disabled={sendEmailDisabled}
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-surface-200 bg-white px-4 py-2 text-sm font-medium text-surface-700 shadow-sm hover:bg-surface-100 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                      Enviando…
                    </>
                  ) : cooldownRemaining ? (
                    `Próximo envio em ${cooldownMin} min`
                  ) : (
                    <>
                      <Mail className="h-4 w-4 shrink-0" />
                      Enviar para meu e-mail
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}