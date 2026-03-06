import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAppStore } from '../../store/appStore'
import { addMonthToKey } from '../../lib/utils'

export function MonthNavigator() {
  const { selectedMonth, setSelectedMonth } = useAppStore()

  const label = (() => {
    try {
      const [y, m] = selectedMonth.split('-').map(Number)
      return format(new Date(y, m - 1, 1), 'MMMM yyyy', { locale: ptBR })
    } catch {
      return selectedMonth
    }
  })()

  const goPrev = () => setSelectedMonth(addMonthToKey(selectedMonth, -1))
  const goNext = () => setSelectedMonth(addMonthToKey(selectedMonth, 1))

  const capFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-surface-200 bg-white px-4 py-3 shadow-sm">
      <button
        type="button"
        onClick={goPrev}
        className="rounded-lg p-2 text-surface-600 hover:bg-surface-100 hover:text-surface-900"
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-[140px] text-center font-semibold text-surface-900">
        {capFirst(label)}
      </span>
      <button
        type="button"
        onClick={goNext}
        className="rounded-lg p-2 text-surface-600 hover:bg-surface-100 hover:text-surface-900"
        aria-label="Mês seguinte"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  )
}
