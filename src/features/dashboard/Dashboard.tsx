import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
import { useAccountsWithLoading } from '../../hooks/useAccounts'
import { BalanceHeader } from './BalanceHeader'
import { MonthNavigator } from './MonthNavigator'
import { MonthlySummaryBar } from './MonthlySummaryBar'
import { AccountCards } from './AccountCards'
import { RecentTransactions } from './RecentTransactions'
import { BudgetProgress } from './BudgetProgress'
import { UpcomingBills } from './UpcomingBills'
import { QuickProjectionCard } from './QuickProjectionCard'
import { Button } from '../../components/ui/Button'

function OnboardingCard() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-5xl mb-4">💰</div>
      <h2 className="text-xl font-bold text-surface-900 mb-2">Bem-vindo ao FinApp!</h2>
      <p className="text-surface-500 mb-6 max-w-sm">
        Para começar, crie sua primeira conta bancária ou carteira.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button onClick={() => navigate('/accounts')}>Criar minha primeira conta</Button>
        <Button variant="secondary" onClick={() => navigate('/import')}>
          Importar planilha existente
        </Button>
      </div>
    </div>
  )
}

export function Dashboard() {
  const selectedMonth = useAppStore((s) => s.selectedMonth)
  const { accounts, isLoading } = useAccountsWithLoading(true)

  if (!isLoading && accounts.length === 0) {
    return <OnboardingCard />
  }

  return (
    <div className="min-w-0 overflow-x-hidden space-y-6">
      <MonthNavigator />
      <div
        key={selectedMonth}
        className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 animate-[dashboard-fade-in_0.2s_ease-out]"
      >
        <div className="min-w-0 space-y-6">
          <BalanceHeader />
          <MonthlySummaryBar />
          <QuickProjectionCard />
          <section className="min-w-0">
            <h2 className="mb-3 text-lg font-semibold text-surface-900">Contas</h2>
            <AccountCards />
          </section>
        </div>
        <div className="min-w-0 space-y-6">
          <RecentTransactions />
          <BudgetProgress />
          <UpcomingBills />
        </div>
      </div>
    </div>
  )
}
