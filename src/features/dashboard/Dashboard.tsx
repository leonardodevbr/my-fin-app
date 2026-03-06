import { useAppStore } from '../../store/appStore'
import { BalanceHeader } from './BalanceHeader'
import { MonthNavigator } from './MonthNavigator'
import { MonthlySummaryBar } from './MonthlySummaryBar'
import { AccountCards } from './AccountCards'
import { RecentTransactions } from './RecentTransactions'
import { BudgetProgress } from './BudgetProgress'
import { UpcomingBills } from './UpcomingBills'

export function Dashboard() {
  const selectedMonth = useAppStore((s) => s.selectedMonth)

  return (
    <div className="space-y-6">
      <MonthNavigator />
      <div
        key={selectedMonth}
        className="grid gap-6 lg:grid-cols-2 animate-[dashboard-fade-in_0.2s_ease-out]"
      >
        <div className="space-y-6">
          <BalanceHeader />
          <MonthlySummaryBar />
          <section>
            <h2 className="mb-3 text-lg font-semibold text-surface-900">Contas</h2>
            <AccountCards />
          </section>
        </div>
        <div className="space-y-6">
          <RecentTransactions />
          <BudgetProgress />
          <UpcomingBills />
        </div>
      </div>
    </div>
  )
}
