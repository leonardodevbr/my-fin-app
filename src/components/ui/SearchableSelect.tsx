import { useState, useMemo, useRef } from 'react'
import { Listbox } from '@headlessui/react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface SearchableSelectOption<T = string> {
  value: T
  label: string
  /** Opcional: cor/ícone para exibir ao lado (ex. categoria) */
  color?: string
}

export interface SearchableSelectProps<T = string> {
  value: T
  onChange: (value: T) => void
  options: SearchableSelectOption<T>[]
  label?: string
  error?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  disabled?: boolean
}

export function SearchableSelect<T extends string>({
  value,
  onChange,
  options,
  label,
  error,
  placeholder = 'Selecione',
  searchPlaceholder = 'Buscar...',
  emptyLabel = 'Nenhum item',
  disabled,
}: SearchableSelectProps<T>) {
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter((o) => o.label.toLowerCase().includes(q))
  }, [options, query])

  const selected = options.find((o) => o.value === value)

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-surface-700 mb-1">{label}</label>
      )}
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        <div className="relative">
          <Listbox.Button
            onClick={() => {
              setQuery('')
              setTimeout(() => searchInputRef.current?.focus(), 50)
            }}
            className={cn(
              'relative w-full cursor-default rounded-lg border bg-white py-2 pl-3 pr-10 text-left text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
              error ? 'border-red-500' : 'border-surface-300'
            )}
          >
              {selected ? (
                <span className="flex items-center gap-2 truncate">
                  {selected.color && (
                    <span
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ backgroundColor: selected.color }}
                    />
                  )}
                  {selected.label}
                </span>
              ) : (
                <span className="text-surface-400">{placeholder}</span>
              )}
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronDown className="h-4 w-4 text-surface-400" aria-hidden />
              </span>
            </Listbox.Button>
          <Listbox.Options className="absolute left-0 right-0 top-full z-[100] mt-1 max-h-56 overflow-auto rounded-xl border border-surface-200 bg-white shadow-lg focus:outline-none">
            <div className="sticky top-0 z-10 border-b border-surface-100 bg-white p-2">
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <div className="py-1">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-sm text-surface-500">{emptyLabel}</p>
              ) : (
                filtered.map((opt) => (
                  <Listbox.Option
                    key={opt.value}
                    value={opt.value}
                    className={({ active }) =>
                      cn(
                        'relative cursor-default select-none py-2.5 pl-10 pr-4',
                        active ? 'bg-primary-50 text-primary-900' : 'text-surface-900'
                      )
                    }
                  >
                    {({ selected: isSelected }) => (
                      <>
                        <span className="flex items-center gap-2 truncate">
                          {opt.color && (
                            <span
                              className="h-4 w-4 shrink-0 rounded-full"
                              style={{ backgroundColor: opt.color }}
                            />
                          )}
                          <span className={cn(isSelected && 'font-semibold')}>{opt.label}</span>
                        </span>
                        {isSelected ? (
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-600">
                            <Check className="h-4 w-4" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))
              )}
            </div>
          </Listbox.Options>
        </div>
      </Listbox>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}
