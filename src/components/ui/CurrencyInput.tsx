import { useRef, useCallback, forwardRef, type MutableRefObject } from 'react'
import { formatCurrencyFromCents, parseCurrencyToCents } from '../../lib/utils'

const MAX_CENTS = 99999999999 // 999.999.999,99

export interface CurrencyInputProps {
  value: number
  onChange: (cents: number) => void
  placeholder?: string
  className?: string
  label?: string
  error?: string
  disabled?: boolean
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput({
  value,
  onChange,
  placeholder = 'R$ 0,00',
  className = '',
  label,
  error,
  disabled,
}, ref) {
  const inputRef = useRef<HTMLInputElement | null>(null) as MutableRefObject<HTMLInputElement | null>
  const setRef = useCallback(
    (el: HTMLInputElement | null) => {
      inputRef.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref]
  )

  const displayValue = formatCurrencyFromCents(value)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        const digit = Number(e.key)
        const next = value * 10 + digit
        if (next <= MAX_CENTS) onChange(next)
        return
      }
      if (e.key === 'Backspace') {
        e.preventDefault()
        onChange(Math.floor(value / 10))
        return
      }
      if (e.key === 'Delete') {
        e.preventDefault()
        onChange(0)
        return
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Tab' || e.key === 'Enter') {
        return
      }
      e.preventDefault()
    },
    [value, onChange]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData.getData('text')
      const cents = parseCurrencyToCents(text)
      if (!Number.isNaN(cents) && cents >= 0 && cents <= MAX_CENTS) {
        onChange(cents)
      }
    },
    [onChange]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value
      const cents = parseCurrencyToCents(text)
      if (!Number.isNaN(cents) && cents >= 0 && cents <= MAX_CENTS) {
        onChange(cents)
      }
    },
    [onChange]
  )

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-surface-700 mb-1">{label}</label>
      )}
      <input
        ref={setRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={displayValue}
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onChange={handleChange}
        disabled={disabled}
        className={`w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-surface-900 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 ${error ? 'border-red-500' : ''} ${className}`}
      />
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
})
