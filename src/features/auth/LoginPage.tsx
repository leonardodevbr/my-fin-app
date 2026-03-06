import { useState, useEffect } from 'react'
import { Wallet, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'

export function LoginPage() {
  const { signInWithPassword, signInWithOtp, resetPasswordForEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Limpa hash com erro (ex.: otp_expired) e mostra toast
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.slice(1).replace(/^#/, ''))
      const errorDesc = params.get('error_description') ?? params.get('error') ?? 'Erro ao entrar'
      const msg = errorDesc.includes('expired') || errorDesc.includes('invalid')
        ? 'Link expirado ou inválido. Use email e senha ou peça um novo link.'
        : decodeURIComponent(errorDesc.replace(/\+/g, ' '))
      toast.error(msg)
      window.history.replaceState(null, '', window.location.pathname + '#/')
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Informe o email')
      return
    }
    if (!password.trim()) {
      toast.error('Informe a senha')
      return
    }
    setLoading(true)
    const { error } = await signInWithPassword(email.trim(), password)
    setLoading(false)
    if (error) {
      toast.error(error.message === 'Invalid login credentials' ? 'Email ou senha incorretos.' : error.message)
      return
    }
    toast.success('Entrando…')
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!email.trim()) {
      toast.error('Informe o email para receber o link')
      return
    }
    setLoading(true)
    const { error } = await signInWithOtp(email.trim())
    setLoading(false)
    if (error) {
      const isRateLimit =
        (error as { status?: number }).status === 429 ||
        String(error.message).includes('429') ||
        /rate limit|too many|demais tentativas/i.test(String(error.message))
      toast.error(
        isRateLimit ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' : error.message
      )
      return
    }
    setMagicLinkSent(true)
    toast.success('Link enviado! Verifique seu email.')
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error('Informe seu email para redefinir a senha')
      return
    }
    setLoading(true)
    const { error } = await resetPasswordForEmail(email.trim())
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    setResetSent(true)
    toast.success('Email enviado! Clique no link para definir uma nova senha.')
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="rounded-full bg-primary-100 p-3">
            <Wallet className="h-8 w-8 text-primary-600" />
          </div>
          <h1 className="text-xl font-semibold text-surface-900">My Fin App</h1>
          <p className="text-sm text-surface-500">Entre para sincronizar suas finanças</p>
        </div>

        {magicLinkSent ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-surface-600">
              Enviamos um link para <strong>{email}</strong>. Clique no link no email para entrar.
            </p>
            <button
              type="button"
              onClick={() => setMagicLinkSent(false)}
              className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
            >
              Voltar ao login
            </button>
          </div>
        ) : resetSent ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-surface-600">
              Enviamos um link para <strong>{email}</strong>. Clique no link para definir uma nova senha.
            </p>
            <button
              type="button"
              onClick={() => setResetSent(false)}
              className="text-sm text-primary-600 hover:text-primary-700 hover:underline"
            >
              Voltar ao login
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            autoComplete="off"
            style={{ position: 'relative' }}
          >
            {/* Campos fantasmas fora da tela: o Chrome preenche estes em vez dos visíveis */}
            <input
              type="text"
              name="username"
              autoComplete="off"
              tabIndex={-1}
              aria-hidden="true"
              className="absolute opacity-0 pointer-events-none h-0 w-0"
              readOnly
            />
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              tabIndex={-1}
              aria-hidden="true"
              className="absolute opacity-0 pointer-events-none h-0 w-0"
              readOnly
            />
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-surface-700 mb-1">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                name="login_email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={(e) => e.target.removeAttribute('readonly')}
                readOnly
                className="w-full rounded-lg border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="seu@email.com"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-surface-700 mb-1">
                Senha
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="login_senha"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-surface-300 px-3 py-2 pr-10 text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-100"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={loading}
              className="w-full text-sm text-primary-600 hover:text-primary-700 hover:underline disabled:opacity-50"
            >
              Enviar link por email (sem senha)
            </button>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full text-sm text-surface-500 hover:text-surface-700 disabled:opacity-50"
            >
              Esqueci minha senha
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
