import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import { toISODate } from '../../lib/utils'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export interface DatePickerProps {
  value: string
  onChange: (dateStr: string) => void
  label?: string
  error?: string
  placeholder?: string
}

export function DatePicker({
  value,
  onChange,
  label,
  error,
  placeholder = 'dd/mm/aaaa',
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const date = value && ISO_DATE.test(value)
    ? parseISO(value)
    : undefined

  const displayStr = date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : ''

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleSelect = (d: Date | undefined) => {
    if (d) {
      onChange(toISODate(d))
      setOpen(false)
    }
  }

  const handleHoje = () => {
    onChange(toISODate(new Date()))
    setOpen(false)
  }

  const handleLimpar = () => {
    onChange('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-surface-700 mb-1">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border bg-white px-3 py-2 text-left text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          error ? 'border-red-500' : 'border-surface-300'
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-surface-400" />
        <span className={displayStr ? '' : 'text-surface-400'}>{displayStr || placeholder}</span>
      </button>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 rounded-xl border border-surface-200 bg-white p-3 shadow-lg">
          <DayPicker
            mode="single"
            selected={date}
            onSelect={handleSelect}
            locale={ptBR}
            defaultMonth={date ?? new Date()}
            showOutsideDays
            classNames={{
              root: 'rdp-custom',
              month: 'space-y-3',
              month_caption: 'flex justify-between items-center px-1 mb-2',
              caption_label: 'text-sm font-semibold text-surface-900',
              nav: 'flex gap-1',
              button_previous: 'flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-100 text-surface-600',
              button_next: 'flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface-100 text-surface-600',
              weekdays: 'flex',
              weekday: 'w-9 text-center text-xs font-medium text-surface-500',
              week: 'flex',
              day: 'w-9 h-9 p-0',
              day_button: 'h-9 w-9 rounded-lg text-sm font-medium hover:bg-surface-100 focus:outline-none focus:ring-2 focus:ring-primary-500',
              selected: '!bg-primary-500 !text-white hover:!bg-primary-600',
              today: 'bg-primary-100 text-primary-700',
              outside: 'text-surface-300',
              disabled: 'opacity-40',
              hidden: 'invisible',
            }}
            components={{
              Chevron: ({ orientation }) =>
                orientation === 'left' ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                ),
            }}
          />
          <div className="mt-3 flex justify-between border-t border-surface-200 pt-3">
            <button
              type="button"
              onClick={handleLimpar}
              className="text-sm font-medium text-surface-600 hover:text-surface-900"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleHoje}
              className="rounded-lg bg-primary-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600"
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
