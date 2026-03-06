import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Search } from 'lucide-react'
import type { Transaction } from '../../db'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { cn, formatCurrency, parseCurrency } from '../../lib/utils'
import { useAccounts } from '../../hooks/useAccounts'
import { useCategories } from '../../hooks/useCategories'
import { useRecentDescriptions } from '../../hooks/useTransactions'
import {
  getDefaultValues,
  useTransactionForm,
  type TransactionFormValues,
} from './useTransactionForm'

const schema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.string().min(1, 'Informe o valor').refine((v) => parseCurrency(v) > 0, 'Valor deve ser maior que zero'),
  description: z.string().min(2, 'Mínimo 2 caracteres'),
  date: z.string().min(1, 'Informe a data'),
  account_id: z.string().min(1, 'Selecione a conta'),
  category_id: z.string(),
  is_paid: z.boolean(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']),
  installments_total: z.number().min(1).max(99),
  notes: z.string(),
  tags: z.array(z.string()),
})

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Não repete' },
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
]

export interface TransactionFormModalProps {
  open: boolean
  onClose: () => void
  transaction?: Transaction | null
  onSaved: () => void
}

export function TransactionFormModal({
  open,
  onClose,
  transaction,
  onSaved,
}: TransactionFormModalProps) {
  const accounts = useAccounts(false)
  const categories = useCategories()
  const recentDescriptions = useRecentDescriptions(20)
  const [accountSearch, setAccountSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [tagInput, setTagInput] = useState('')

  const { handleSubmit: submitForm } = useTransactionForm(() => {
    onSaved()
    onClose()
  })

  const defaultValues = useMemo(
    () => getDefaultValues(transaction),
    [transaction]
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const type = watch('type')
  const amountStr = watch('amount')
  const recurrence = watch('recurrence')
  const installments_total = watch('installments_total')
  const tags = watch('tags')

  useEffect(() => {
    if (open) {
      const v = getDefaultValues(transaction)
      setValue('type', v.type)
      setValue('amount', v.amount)
      setValue('description', v.description)
      setValue('date', v.date)
      setValue('account_id', v.account_id)
      setValue('category_id', v.category_id)
      setValue('is_paid', v.is_paid)
      setValue('recurrence', v.recurrence)
      setValue('installments_total', v.installments_total)
      setValue('notes', v.notes)
      setValue('tags', v.tags)
    }
  }, [open, transaction, setValue])

  useEffect(() => {
    setValue('category_id', '')
  }, [type, setValue])

  const filteredAccounts = useMemo(
    () =>
      accountSearch.trim()
        ? accounts.filter((a) =>
            a.name.toLowerCase().includes(accountSearch.toLowerCase())
          )
        : accounts,
    [accounts, accountSearch]
  )

  const filteredCategories = useMemo(
    () =>
      categories
        .filter((c) => c.type === type || type === 'transfer')
        .filter((c) =>
          !categorySearch.trim() || c.name.toLowerCase().includes(categorySearch.toLowerCase())
        ),
    [categories, type, categorySearch]
  )

  const amountNum = parseCurrency(amountStr)
  const installmentAmount = installments_total > 1 ? amountNum / installments_total : amountNum

  const accentClass =
    type === 'income'
      ? 'border-[var(--color-income)]'
      : type === 'expense'
        ? 'border-[var(--color-expense)]'
        : 'border-[var(--color-transfer)]'

  const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      setValue('tags', [...tags, tagInput.trim()])
      setTagInput('')
    }
  }

  if (!open) return null

  const content = (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col bg-white md:inset-auto md:left-1/2 md:top-1/2 md:h-[90vh] md:max-h-[700px] md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl md:shadow-xl',
        accentClass,
        'md:border-2'
      )}
    >
      <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3">
        <h2 className="text-lg font-semibold text-surface-900">
          {transaction ? 'Editar transação' : 'Nova transação'}
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar">
          <X className="h-5 w-5" />
        </Button>
      </div>
      <form
        onSubmit={handleSubmit((values) => submitForm(values, transaction?.id))}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Type tabs */}
          <div className="flex rounded-lg bg-surface-100 p-1">
            {(['income', 'expense', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setValue('type', t)}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                  type === t
                    ? 'bg-white text-surface-900 shadow'
                    : 'text-surface-600 hover:text-surface-900'
                )}
              >
                {t === 'income' ? 'Receita' : t === 'expense' ? 'Despesa' : 'Transferência'}
              </button>
            ))}
          </div>

          {/* Amount */}
          <Input
            label="Valor"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            {...register('amount')}
            error={errors.amount?.message}
            className="text-2xl font-bold"
          />

          {/* Description with autocomplete */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Descrição</label>
            <input
              list="recent-descriptions"
              className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-surface-900"
              {...register('description')}
            />
            <datalist id="recent-descriptions">
              {recentDescriptions.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            {errors.description && (
              <p className="mt-1 text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Date */}
          <Input
            label="Data"
            type="date"
            {...register('date')}
            error={errors.date?.message}
          />

          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Conta</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
              <input
                type="text"
                placeholder="Buscar conta..."
                value={accountSearch}
                onChange={(e) => setAccountSearch(e.target.value)}
                className="w-full rounded-lg border border-surface-300 bg-white pl-9 pr-3 py-2"
              />
            </div>
            <select
              className="mt-1 w-full rounded-lg border border-surface-300 bg-white px-3 py-2"
              {...register('account_id')}
            >
              <option value="">Selecione</option>
              {filteredAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {errors.account_id && (
              <p className="mt-1 text-sm text-red-500">{errors.account_id.message}</p>
            )}
          </div>

          {/* Category */}
          {type !== 'transfer' && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Categoria</label>
              <input
                type="text"
                placeholder="Buscar categoria..."
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 mb-1"
              />
              <select
                className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2"
                {...register('category_id')}
              >
                <option value="">Nenhuma</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* is_paid */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-surface-700">Pago</span>
            <button
              type="button"
              role="switch"
              aria-checked={watch('is_paid')}
              onClick={() => setValue('is_paid', !watch('is_paid'))}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors',
                watch('is_paid') ? 'bg-primary-500' : 'bg-surface-300'
              )}
            >
              <span
                className={cn(
                  'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
                  watch('is_paid') ? 'translate-x-5' : 'translate-x-0.5'
                )}
                style={{ marginTop: 2 }}
              />
            </button>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Recorrência</label>
            <select
              className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2"
              {...register('recurrence')}
            >
              {RECURRENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Installments */}
          {recurrence === 'none' && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">Parcelas</label>
              <input
                type="number"
                min={1}
                max={99}
                className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2"
                {...register('installments_total', { valueAsNumber: true })}
              />
              {installments_total > 1 && amountNum > 0 && (
                <p className="mt-1 text-sm text-surface-500">
                  {installments_total} parcelas de {formatCurrency(installmentAmount)}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Observações</label>
            <textarea
              className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 min-h-[80px]"
              {...register('notes')}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Tags (Enter para adicionar)</label>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={onTagKeyDown}
              placeholder="Digite e pressione Enter"
              className="w-full rounded-lg border border-surface-300 bg-white px-3 py-2"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-200 px-2.5 py-0.5 text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setValue('tags', tags.filter((t) => t !== tag))}
                      className="hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-surface-200 p-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>
  )

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50 md:block"
        onClick={onClose}
        aria-hidden
      />
      {content}
    </>,
    document.body
  )
}
