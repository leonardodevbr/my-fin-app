import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { seedDefaultCategories } from './seedDefaultCategories'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register: doRegister } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!name.trim()) {
      setFormError('Informe seu nome')
      return
    }
    if (!email.trim()) {
      setFormError('Informe o email')
      return
    }
    if (password.length < 8) {
      setFormError('A senha deve ter no mínimo 8 caracteres')
      return
    }
    if (password !== confirmPassword) {
      setFormError('As senhas não coincidem')
      return
    }
    setLoading(true)
    const { error } = await doRegister(email.trim(), password, name.trim())
    if (error) {
      setLoading(false)
      setFormError(error.message)
      return
    }
    await seedDefaultCategories()
    setLoading(false)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-surface-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="rounded-full bg-primary-100 p-3">
            <Wallet className="h-8 w-8 text-primary-600" />
          </div>
          <h1 className="text-xl font-semibold text-surface-900">Criar conta</h1>
          <p className="text-sm text-surface-500">NunFi</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div>
            <label htmlFor="register-name" className="block text-sm font-medium text-surface-700 mb-1">
              Nome
            </label>
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="Seu nome"
            />
          </div>
          <div>
            <label htmlFor="register-email" className="block text-sm font-medium text-surface-700 mb-1">
              Email
            </label>
            <input
              id="register-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label htmlFor="register-password" className="block text-sm font-medium text-surface-700 mb-1">
              Senha (mín. 8 caracteres)
            </label>
            <div className="relative">
              <input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
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
          <div>
            <label htmlFor="register-confirm" className="block text-sm font-medium text-surface-700 mb-1">
              Confirmar senha
            </label>
            <input
              id="register-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="••••••••"
            />
          </div>
          {formError && (
            <p className="text-sm text-red-600" role="alert">
              {formError}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 px-4 py-2.5 font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? 'Criando conta…' : 'Criar conta'}
          </button>
          <p className="text-center text-sm text-surface-600">
            Já tem conta?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-700 hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
