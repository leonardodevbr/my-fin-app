import { HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AppShell } from './components/layout/AppShell'
import { Dashboard } from './features/dashboard/Dashboard'
import { TransactionsPage } from './features/transactions/TransactionsPage'
import { AccountsPage } from './features/accounts/AccountsPage'
import { CategoriesPage } from './features/categories/CategoriesPage'
import { ReportsPage } from './features/reports/ReportsPage'
import { BudgetsPage } from './features/budgets/BudgetsPage'

function App() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
        </Routes>
      </AppShell>
      <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
    </HashRouter>
  )
}

export default App
