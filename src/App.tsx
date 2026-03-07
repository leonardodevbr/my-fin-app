import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AppShell } from './components/layout/AppShell'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { AuthGuard } from './features/auth/AuthGuard'
import { Dashboard } from './features/dashboard/Dashboard'
import { TransactionsPage } from './features/transactions/TransactionsPage'
import { AccountsPage } from './features/accounts/AccountsPage'
import { AccountDetailPage } from './features/accounts/AccountDetailPage'
import { CategoriesPage } from './features/categories/CategoriesPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { BudgetsPage } from './features/budgets/BudgetsPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { ImportPage } from './features/import/ImportPage'
import { ProjectionPage } from './features/projection/ProjectionPage'
import { useAuth } from './hooks/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { RecurringSchedulerInit } from './sync/RecurringSchedulerInit'

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

function LoginRoute() {
  const { user, loading } = useAuth()
  if (isSupabaseConfigured && !loading && user) {
    return <Navigate to="/" replace />
  }
  return <LoginPage />
}

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <RecurringSchedulerInit />
              <RedirectAfterAuth />
              <AppShell>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/accounts" element={<AccountsPage />} />
                  <Route path="/accounts/:id" element={<AccountDetailPage />} />
                  <Route path="/categories" element={<CategoriesPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/budgets" element={<BudgetsPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/import" element={<ImportPage />} />
                  <Route path="/projection" element={<ProjectionPage />} />
                </Routes>
              </AppShell>
            </AuthGuard>
          }
        />
      </Routes>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
    </HashRouter>
  )
}

export default App
