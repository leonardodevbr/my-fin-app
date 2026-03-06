import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'

export function SetNewPasswordPage() {
  const { updatePassword, clearNeedsNewPassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres')
      return
    }
    if (password !== confirm) {
      toast.error('As senhas não conferem')
      return
    }
    setLoading(true)
    const { error } = await updatePassword(password)
    setLoading(false)
    if (error) {
      toast.error(error.message)
      return
    }
    clearNeedsNewPassword()
    toast.success('Senha definida. Você já está logado.')
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="rounded-full bg-primary-100 p-3">
            <Lock className="h-8 w-8 text-primary-600" />
          </div>
          <h1 className="text-xl font-semibold text-surface-900">Definir senha</h1>
          <p className="text-sm text-surface-500 text-center">
            Escolha uma senha para entrar com email e senha da próxima vez.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-surface-700 mb-1">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-surface-300 px-3 py-2 pr-10 text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
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
          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-surface-700 mb-1">
              Confirmar senha
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-surface-300 px-3 py-2 pr-10 text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="Repita a senha"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded text-surface-500 hover:text-surface-700 hover:bg-surface-100"
                aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Salvando…' : 'Definir senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
