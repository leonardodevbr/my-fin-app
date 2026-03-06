import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface SelectOption<T = string> {
  value: T
  label: string
}

export interface SelectProps<T = string> {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  label?: string
  error?: string
  placeholder?: string
  disabled?: boolean
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  error,
  placeholder = 'Selecione',
  disabled,
}: SelectProps<T>) {
  const selected = options.find((o) => o.value === value)

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-surface-700 mb-1">{label}</label>
      )}
      <Listbox value={value} onChange={onChange} disabled={disabled}>
        <div className="relative">
          <Listbox.Button
            className={cn(
              'relative w-full cursor-default rounded-lg border bg-white py-2 pl-3 pr-10 text-left text-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
              error ? 'border-red-500' : 'border-surface-300'
            )}
          >
            <span className={cn('block truncate', !selected?.label && 'text-surface-400')}>
              {selected?.label ?? placeholder}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronDown className="h-4 w-4 text-surface-400" aria-hidden />
            </span>
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-surface-200 bg-white py-1 shadow-lg focus:outline-none">
              {options.map((opt) => (
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
                      <span className={cn('block truncate font-medium', isSelected && 'font-semibold')}>
                        {opt.label}
                      </span>
                      {isSelected ? (
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-600">
                          <Check className="h-4 w-4" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}
