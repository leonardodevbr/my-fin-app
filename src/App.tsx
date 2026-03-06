import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './features/auth/LoginPage'
import { SetNewPasswordPage } from './features/auth/SetNewPasswordPage'
import { Dashboard } from './features/dashboard/Dashboard'
import { TransactionsPage } from './features/transactions/TransactionsPage'
import { AccountsPage } from './features/accounts/AccountsPage'
import { CategoriesPage } from './features/categories/CategoriesPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { BudgetsPage } from './features/budgets/BudgetsPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { useAuthRequired } from './hooks/useAuth'

const REDIRECT_KEY = 'finapp_redirect_after_auth'

function RedirectAfterAuth() {
  useEffect(() => {
    try {
      const path = sessionStorage.getItem(REDIRECT_KEY)
      if (path) {
        sessionStorage.removeItem(REDIRECT_KEY)
        const hash = path.startsWith('/') ? path : `/${path}`
        if (window.location.hash !== hash) {
          window.location.hash = hash
        }
        return
      }
      // Hash só com tokens (ex.: #access_token=...) — limpa para mostrar a rota /
      const h = window.location.hash.slice(1)
      if (h.includes('access_token') && !h.startsWith('/')) {
        window.history.replaceState(null, '', `${window.location.pathname}#/`)
      }
    } catch {
      // ignore
    }
  }, [])
  return null
}

function App() {
  const { showLogin, showSetPassword, loading } = useAuthRequired()

  return (
    <HashRouter>
      {showSetPassword ? (
        <SetNewPasswordPage />
      ) : showLogin ? (
        <LoginPage />
      ) : loading ? (
        <div className="min-h-screen bg-surface-100 flex items-center justify-center">
          <span className="text-surface-500">Carregando…</span>
        </div>
      ) : (
        <>
          <RedirectAfterAuth />
          <AppShell>
            <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Routes>
        </AppShell>
        </>
      )}
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
    </HashRouter>
  )
}

export default App
