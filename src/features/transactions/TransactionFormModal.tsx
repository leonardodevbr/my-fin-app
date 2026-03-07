import { useEffect, useMemo, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { addMonths, addWeeks, addYears, addDays } from 'date-fns'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { X, Zap, Repeat, Package } from 'lucide-react'
import type { Transaction } from '../../db'
import { Button } from '../../components/ui/Button'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { DatePicker } from '../../components/ui/DatePicker'
import { Select } from '../../components/ui/Select'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { cn, formatCurrencyFromCents, toISODate } from '../../lib/utils'
import { useAuth } from '../../hooks/useAuth'
import { useAccounts } from '../../hooks/useAccounts'
import { useCategories } from '../../hooks/useCategories'
import { useRecentDescriptions, getTransactionsByGroupId } from '../../hooks/useTransactions'
import {
  createTransactionGroup,
  updateTransactionInGroup,
  type CreateTransactionGroupData,
  type PaymentMode as ServicePaymentMode,
  type EditGroupScope,
} from './transactionGroupService'
import { updateTransaction } from '../../hooks/useTransactions'
import toast from 'react-hot-toast'

const PAYMENT_MODES: { value: ServicePaymentMode; label: string; desc: string; icon: typeof Zap }[] = [
  { value: 'single', label: 'Único', desc: 'Um lançamento isolado', icon: Zap },
  { value: 'recurring', label: 'Fixo', desc: 'Repete todo período', icon: Repeat },
  { value: 'installments', label: 'Parcelado', desc: 'Valor dividido em N vezes', icon: Package },
]

const RECURRENCE_OPTIONS = [
  { value: 'weekly', label: 'Semana' },
  { value: 'biweekly', label: '15 dias' },
  { value: 'monthly', label: 'Mês' },
  { value: 'every_2_months', label: '2 meses' },
  { value: 'every_3_months', label: '3 meses' },
  { value: 'every_6_months', label: '6 meses' },
  { value: 'yearly', label: 'Ano' },
]

const INSTALLMENT_INTERVAL_OPTIONS = [
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
]

const RECURRING_EXAMPLES = ['Salário', 'Aluguel', 'Internet', 'Conta de luz', 'Mensalidade']
const INSTALLMENT_EXAMPLES = ['Financiamento', 'IPVA', 'Cartão', 'Curso', 'Empréstimo']

const baseSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  payment_mode: z.enum(['single', 'recurring', 'installments']),
  description: z.string().min(2, 'Mínimo 2 caracteres'),
  account_id: z.string().min(1, 'Selecione a conta'),
  category_id: z.string(),
  is_paid: z.boolean(),
  notes: z.string(),
  tags: z.array(z.string()),
  date: z.string().min(1, 'Informe a data'),
  amount_cents: z.number(),
  recurrence_period: z.string().optional(),
  start_date: z.string().optional(),
  recurrence_end: z.enum(['never', 'date', 'after_n']).optional(),
  recurrence_end_date: z.string().optional(),
  recurrence_end_after_occurrences: z.number().optional(),
  installment_mode: z.enum(['per_parcel', 'total']).optional(),
  amount_per_installment_cents: z.number().optional(),
  amount_total_cents: z.number().optional(),
  installments_total: z.number().optional(),
  installment_interval: z.string().optional(),
})

type FormValues = z.infer<typeof baseSchema>

function buildSchema(mode: FormValues['payment_mode']) {
  return baseSchema
    .refine((d) => d.amount_cents > 0, {
      message: 'Informe o valor',
      path: ['amount_cents'],
    })
    .refine(
      (d) => {
        if (mode === 'recurring') return !!d.recurrence_period && !!d.start_date
        return true
      },
      { message: 'Preencha recorrência e primeira ocorrência', path: ['recurrence_period'] }
    )
    .refine(
      (d) => {
        if (mode === 'installments') {
          const total = (d.installments_total ?? 0) >= 2
          const amount = (d.amount_cents ?? 0) > 0
          return total && amount
        }
        return true
      },
      { message: 'Parcelas (mín. 2) e valor obrigatórios', path: ['installments_total'] }
    )
}

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
  const { user } = useAuth()
  const accounts = useAccounts(false)
  const categories = useCategories()
  const recentDescriptions = useRecentDescriptions(20)
  const [tagInput, setTagInput] = useState('')
  const [editScope, setEditScope] = useState<EditGroupScope>('this_only')
  const [groupInfo, setGroupInfo] = useState<{ name: string; current: number; total: number } | null>(null)
  const amountInputRef = useRef<HTMLInputElement>(null)

  const defaultValues: FormValues = useMemo(
    () => ({
      type: transaction?.type ?? 'expense',
      payment_mode: 'single',
      description: transaction?.description?.replace(/\s*\*\s*$/, '') ?? '',
      account_id: transaction?.account_id ?? '',
      category_id: transaction?.category_id ?? '',
      is_paid: transaction?.is_paid ?? true,
      notes: transaction?.notes ?? '',
      tags: transaction?.tags ?? [],
      date: transaction?.date ?? toISODate(new Date()),
      amount_cents: transaction?.amount ?? 0,
      recurrence_period: 'monthly',
      start_date: transaction?.date ?? toISODate(new Date()),
      recurrence_end: 'never',
      recurrence_end_date: '',
      recurrence_end_after_occurrences: 12,
      installment_mode: 'per_parcel',
      amount_per_installment_cents: 0,
      amount_total_cents: 0,
      installments_total: 2,
      installment_interval: 'monthly',
    }),
    [transaction]
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues,
  })

  const payment_mode = watch('payment_mode')
  const schema = useMemo(() => buildSchema(payment_mode), [payment_mode])

  const type = watch('type')
  const amount_cents = watch('amount_cents')
  const tags = watch('tags')

  useEffect(() => {
    if (!open) return
    reset(defaultValues)
    setTagInput('')
    if (transaction?.group_id) {
      getTransactionsByGroupId(transaction.group_id).then((txs) => {
        const sorted = txs.sort((a, b) => (a.installment_number ?? 0) - (b.installment_number ?? 0))
        const current = transaction.installment_number ?? 1
        const total = sorted.length
        const name = transaction.description.replace(/\s*\d+\/\d+\s*$/, '').trim() || 'Grupo'
        setGroupInfo({ name, current, total })
      })
    } else {
      setGroupInfo(null)
    }
  }, [open, transaction?.id, transaction?.group_id, transaction?.description, transaction?.installment_number])

  useEffect(() => {
    if (open && !transaction && accounts.length === 1) {
      setValue('account_id', accounts[0].id)
    }
  }, [open, transaction, accounts, setValue])

  useEffect(() => {
    if (open && type) setValue('category_id', '')
  }, [open, type, setValue])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => amountInputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  const accountOptions = useMemo(
    () => accounts.map((a) => ({ value: a.id, label: a.name })),
    [accounts]
  )

  const categoryOptions = useMemo(
    () =>
      categories
        .filter((c) => c.type === type || type === 'transfer')
        .map((c) => ({ value: c.id, label: c.name, color: c.color })),
    [categories, type]
  )

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

  const onSubmit = async (values: FormValues) => {
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      const path = (first.path[0] as keyof FormValues) ?? 'description'
      setError(path, { message: first.message })
      return
    }
    if (!user?.id) return
    try {
      if (transaction?.group_id && groupInfo) {
        await updateTransactionInGroup(
          transaction.id,
          {
            type: values.type,
            amount: values.amount_cents,
            description: values.description.trim(),
            date: values.date,
            account_id: values.account_id,
            category_id: values.category_id || null,
            is_paid: values.is_paid,
            notes: values.notes.trim() || null,
            tags: values.tags,
          },
          editScope,
          user.id
        )
        onSaved()
        onClose()
        return
      }
      if (transaction && !transaction.group_id) {
        const now = new Date().toISOString()
        await updateTransaction(transaction.id, {
          type: values.type,
          amount: values.amount_cents,
          description: values.description.trim(),
          date: values.date,
          account_id: values.account_id,
          category_id: values.category_id || null,
          is_paid: values.is_paid,
          paid_at: values.is_paid ? now : null,
          notes: values.notes.trim() || null,
          tags: values.tags,
        })
        toast.success('Transação salva')
        onSaved()
        onClose()
        return
      }

      const data: CreateTransactionGroupData = {
        type: values.type,
        description: values.description.trim(),
        account_id: values.account_id,
        category_id: values.category_id || null,
        notes: values.notes.trim() || null,
        tags: values.tags,
        is_paid: values.is_paid,
        payment_mode: values.payment_mode as ServicePaymentMode,
        amount_cents: values.amount_cents,
      }

      if (values.payment_mode === 'single') {
        data.start_date = values.date
      }

      if (values.payment_mode === 'recurring') {
        data.recurrence_period = (values.recurrence_period as CreateTransactionGroupData['recurrence_period']) ?? 'monthly'
        data.start_date = values.start_date ?? values.date
        data.recurrence_end_date = values.recurrence_end === 'date' ? values.recurrence_end_date ?? undefined : undefined
        data.recurrence_end_after_occurrences = values.recurrence_end === 'after_n' ? values.recurrence_end_after_occurrences ?? undefined : undefined
      }

      if (values.payment_mode === 'installments') {
        const n = Math.max(2, Math.min(360, values.installments_total ?? 2))
        data.installment_mode = values.installment_mode ?? 'per_parcel'
        if (values.installment_mode === 'total') {
          data.amount_total_cents = values.amount_cents
          data.amount_per_installment_cents = undefined
        } else {
          data.amount_per_installment_cents = values.amount_cents
          data.amount_total_cents = undefined
        }
        data.installments_total = n
        data.start_date = values.start_date ?? values.date
        data.installment_interval = (values.installment_interval as 'weekly' | 'biweekly' | 'monthly' | 'yearly') ?? 'monthly'
      }

      await createTransactionGroup(data, user.id)
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
      throw e
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
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-1 flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {groupInfo && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
              <p className="text-sm text-amber-900">
                Este lançamento faz parte de um grupo: <strong>{groupInfo.name}</strong> (parcela {groupInfo.current} de {groupInfo.total})
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setEditScope('this_only')}
                  className={cn(
                    'px-2 py-1 rounded text-sm font-medium',
                    editScope === 'this_only' ? 'bg-amber-200' : 'bg-white border border-amber-300 hover:bg-amber-100'
                  )}
                >
                  Editar só este
                </button>
                <button
                  type="button"
                  onClick={() => setEditScope('this_and_future')}
                  className={cn(
                    'px-2 py-1 rounded text-sm font-medium',
                    editScope === 'this_and_future' ? 'bg-amber-200' : 'bg-white border border-amber-300 hover:bg-amber-100'
                  )}
                >
                  Editar este e futuros
                </button>
                <button
                  type="button"
                  onClick={() => setEditScope('all')}
                  className={cn(
                    'px-2 py-1 rounded text-sm font-medium',
                    editScope === 'all' ? 'bg-amber-200' : 'bg-white border border-amber-300 hover:bg-amber-100'
                  )}
                >
                  Editar todos
                </button>
              </div>
            </div>
          )}

          {/* Modo de entrada (primeiro campo, antes do valor) */}
          {!transaction?.group_id && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">Modo de entrada</label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_MODES.map(({ value, label, desc, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setValue('payment_mode', value)}
                    className={cn(
                      'rounded-xl border-2 p-3 text-left transition-colors',
                      payment_mode === value
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-surface-200 hover:border-surface-300'
                    )}
                  >
                    <Icon className="h-5 w-5 text-surface-600 mb-1" />
                    <div className="font-medium text-sm text-surface-900">{label}</div>
                    <div className="text-xs text-surface-500">{desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Type tabs */}
          <div className="flex rounded-lg bg-surface-100 p-1">
            {(['income', 'expense', 'transfer'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setValue('type', t)}
                className={cn(
                  'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                  type === t ? 'bg-white text-surface-900 shadow' : 'text-surface-600 hover:text-surface-900'
                )}
              >
                {t === 'income' ? 'Receita' : t === 'expense' ? 'Despesa' : 'Transferência'}
              </button>
            ))}
          </div>

          {/* Parcelado: Modo de entrada (Por parcela / Valor total) antes do valor + um único campo Valor */}
          {payment_mode === 'installments' && !transaction?.group_id && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">Modo de entrada</label>
                <div className="flex rounded-lg bg-surface-100 p-1">
                  <button
                    type="button"
                    onClick={() => setValue('installment_mode', 'per_parcel')}
                    className={cn(
                      'flex-1 py-2 text-sm font-medium rounded-md',
                      watch('installment_mode') === 'per_parcel' ? 'bg-white shadow' : ''
                    )}
                  >
                    Por parcela
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('installment_mode', 'total')}
                    className={cn(
                      'flex-1 py-2 text-sm font-medium rounded-md',
                      watch('installment_mode') === 'total' ? 'bg-white shadow' : ''
                    )}
                  >
                    Valor total
                  </button>
                </div>
              </div>
              <CurrencyInput
                ref={amountInputRef}
                label={watch('installment_mode') === 'total' ? 'Valor (total)' : 'Valor (por parcela)'}
                value={amount_cents}
                onChange={(c) => setValue('amount_cents', c)}
                error={errors.amount_cents?.message}
                className="text-xl font-semibold"
              />
            </>
          )}

          {/* Amount (single e recurring) */}
          {payment_mode === 'single' && (
            <CurrencyInput
              ref={amountInputRef}
              label="Valor"
              value={amount_cents}
              onChange={(c) => setValue('amount_cents', c)}
              error={errors.amount_cents?.message}
              className="text-2xl font-bold"
            />
          )}
          {payment_mode === 'recurring' && (
            <CurrencyInput
              ref={amountInputRef}
              label="Valor (por ocorrência)"
              value={amount_cents}
              onChange={(c) => setValue('amount_cents', c)}
              error={errors.amount_cents?.message}
              className="text-2xl font-bold"
            />
          )}

          {/* Description */}
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

          {/* Date (single) or start_date (recurring/installments) */}
          {(payment_mode === 'single' || transaction?.group_id) && (
            <DatePicker
              label="Data"
              value={watch('date')}
              onChange={(d) => setValue('date', d)}
              error={errors.date?.message}
            />
          )}

          {/* Recurring extra fields */}
          {payment_mode === 'recurring' && !transaction?.group_id && (
            <>
              <Select
                label="Repete a cada"
                value={watch('recurrence_period') ?? 'monthly'}
                onChange={(v) => setValue('recurrence_period', v)}
                options={RECURRENCE_OPTIONS}
              />
              <DatePicker
                label="Primeira ocorrência"
                value={watch('start_date') ?? watch('date')}
                onChange={(d) => setValue('start_date', d)}
                error={errors.start_date?.message}
              />
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-2">Termina</label>
                <div className="space-y-2">
                  {(['never', 'date', 'after_n'] as const).map((opt) => (
                    <label key={opt} className="flex items-center gap-2">
                      <input
                        type="radio"
                        checked={(watch('recurrence_end') ?? 'never') === opt}
                        onChange={() => setValue('recurrence_end', opt)}
                        className="rounded-full"
                      />
                      {opt === 'never' && 'Nunca'}
                      {opt === 'date' && 'Em uma data'}
                      {opt === 'after_n' && 'Após X ocorrências'}
                    </label>
                  ))}
                </div>
                {watch('recurrence_end') === 'date' && (
                  <div className="mt-2">
                    <DatePicker
                      label="Data final"
                      value={watch('recurrence_end_date') ?? ''}
                      onChange={(d) => setValue('recurrence_end_date', d)}
                    />
                  </div>
                )}
                {watch('recurrence_end') === 'after_n' && (
                  <div className="mt-2">
                    <label className="block text-sm text-surface-600 mb-1">Número de ocorrências</label>
                    <input
                      type="number"
                      min={1}
                      max={360}
                      className="w-full rounded-lg border border-surface-300 px-3 py-2"
                      {...register('recurrence_end_after_occurrences', { valueAsNumber: true })}
                    />
                  </div>
                )}
              </div>
              {amount_cents > 0 && (watch('recurrence_period') || watch('start_date')) && (
                <RecurringPreview
                  amountCents={amount_cents}
                  period={watch('recurrence_period') ?? 'monthly'}
                  startDate={watch('start_date') ?? watch('date') ?? ''}
                  end={watch('recurrence_end') ?? 'never'}
                  endDate={watch('recurrence_end_date')}
                  endAfter={watch('recurrence_end_after_occurrences') ?? 24}
                />
              )}
              <div className="flex flex-wrap gap-2">
                {RECURRING_EXAMPLES.map((ex) => {
                  const isSelected = (watch('description') ?? '').trim() === ex
                  return (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setValue('description', ex)}
                      className={cn(
                        'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                        isSelected
                          ? 'bg-primary-600 text-white'
                          : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                      )}
                    >
                      {ex}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Installments extra fields (Modo de entrada + Valor já aparecem antes) */}
          {payment_mode === 'installments' && !transaction?.group_id && (
            <>
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1">Número de parcelas</label>
                <input
                  type="number"
                  min={2}
                  max={360}
                  className="w-full rounded-lg border border-surface-300 px-3 py-2"
                  {...register('installments_total', { valueAsNumber: true })}
                />
              </div>
              {amount_cents > 0 && (watch('installments_total') ?? 0) >= 2 && (
                <InstallmentSummary
                  mode={watch('installment_mode') ?? 'per_parcel'}
                  totalCents={
                    watch('installment_mode') === 'total'
                      ? amount_cents
                      : amount_cents * (watch('installments_total') ?? 2)
                  }
                  perParcelCents={
                    watch('installment_mode') === 'total'
                      ? Math.floor(amount_cents / (watch('installments_total') ?? 2))
                      : amount_cents
                  }
                  installmentsTotal={watch('installments_total') ?? 2}
                />
              )}
              <DatePicker
                label="Vencimento da 1ª parcela"
                value={watch('start_date') ?? watch('date')}
                onChange={(d) => setValue('start_date', d)}
              />
              <Select
                label="Intervalo entre parcelas"
                value={watch('installment_interval') ?? 'monthly'}
                onChange={(v) => setValue('installment_interval', v)}
                options={INSTALLMENT_INTERVAL_OPTIONS}
              />
              <InstallmentPreviewList
                startDate={watch('start_date') ?? watch('date') ?? ''}
                total={watch('installments_total') ?? 2}
                amountPerInstallment={
                  watch('installment_mode') === 'total'
                    ? Math.floor(amount_cents / (watch('installments_total') ?? 2))
                    : amount_cents
                }
                amountTotal={
                  watch('installment_mode') === 'total'
                    ? amount_cents
                    : amount_cents * (watch('installments_total') ?? 2)
                }
                interval={watch('installment_interval') ?? 'monthly'}
                description={watch('description') || 'Parcela'}
              />
              <div className="flex flex-wrap gap-2">
                {INSTALLMENT_EXAMPLES.map((ex) => {
                  const isSelected = (watch('description') ?? '').trim() === ex
                  return (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setValue('description', ex)}
                      className={cn(
                        'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                        isSelected
                          ? 'bg-primary-600 text-white'
                          : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                      )}
                    >
                      {ex}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Account */}
          <SearchableSelect
            label="Conta"
            value={watch('account_id')}
            onChange={(v) => setValue('account_id', v)}
            options={accountOptions}
            placeholder="Selecione a conta"
            searchPlaceholder="Buscar conta..."
            emptyLabel="Nenhuma conta encontrada"
            error={errors.account_id?.message}
          />

          {/* Category */}
          {type !== 'transfer' && (
            <SearchableSelect
              label="Categoria"
              value={watch('category_id')}
              onChange={(v) => setValue('category_id', v)}
              options={[{ value: '', label: 'Nenhuma' }, ...categoryOptions]}
              placeholder="Nenhuma"
              searchPlaceholder="Buscar categoria..."
              emptyLabel="Nenhuma categoria encontrada"
            />
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
                      onClick={() => setValue('tags', tags.filter((t: string) => t !== tag))}
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
      <div className="fixed inset-0 z-40 bg-black/50 md:block" onClick={onClose} aria-hidden />
      {content}
    </>,
    document.body
  )
}

function RecurringPreview({
  amountCents,
  startDate,
  end,
  endDate,
  endAfter,
}: {
  amountCents: number
  period: string
  startDate: string
  end: string
  endDate?: string
  endAfter: number
}) {
  const start = startDate ? format(new Date(startDate + 'T12:00:00'), 'MMM/yyyy', { locale: ptBR }) : ''
  const endStr =
    end === 'after_n'
      ? `${endAfter} ocorrências`
      : end === 'date' && endDate
        ? format(new Date(endDate + 'T12:00:00'), 'MMM/yyyy', { locale: ptBR })
        : '24 meses (máx.)'
  return (
    <p className="text-sm text-surface-500">
      Serão gerados lançamentos de {formatCurrencyFromCents(amountCents)}, de {start} até {endStr}.
    </p>
  )
}

function InstallmentSummary({
  mode,
  totalCents,
  perParcelCents,
  installmentsTotal,
}: {
  mode: string
  totalCents: number
  perParcelCents: number
  installmentsTotal: number
}) {
  const remainder = totalCents - perParcelCents * installmentsTotal
  const lastParcel = perParcelCents + remainder
  return (
    <div className="text-sm text-surface-600 space-y-1">
      {mode === 'per_parcel' && (
        <p>Total: {formatCurrencyFromCents(totalCents)}</p>
      )}
      {mode === 'total' && (
        <p>
          Parcela: {formatCurrencyFromCents(perParcelCents)}
          {remainder !== 0 && ` (última: ${formatCurrencyFromCents(lastParcel)})`}
        </p>
      )}
    </div>
  )
}

function addByInterval(d: Date, interval: string, n: number): Date {
  switch (interval) {
    case 'weekly':
      return addWeeks(d, n)
    case 'biweekly':
      return addDays(d, 15 * n)
    case 'yearly':
      return addYears(d, n)
    default:
      return addMonths(d, n)
  }
}

function InstallmentPreviewList({
  startDate,
  total,
  amountPerInstallment,
  amountTotal,
  interval,
}: {
  startDate: string
  total: number
  amountPerInstallment: number
  amountTotal: number
  interval: string
  description: string
}) {
  const [expanded, setExpanded] = useState(false)
  const remainder = amountTotal - amountPerInstallment * total
  const items: { n: number; date: string; amount: number }[] = []
  for (let i = 0; i < total; i++) {
    const d = addByInterval(new Date(startDate + 'T12:00:00'), interval, i)
    items.push({
      n: i + 1,
      date: format(d, 'dd/MM/yyyy', { locale: ptBR }),
      amount: amountPerInstallment + (i < remainder ? 1 : 0),
    })
  }
  const show = expanded ? items : [...items.slice(0, 3), ...(items.length > 4 ? [null as unknown as { n: number; date: string; amount: number }] : []), ...items.slice(-1)]
  return (
    <div className="border border-surface-200 rounded-lg p-3 space-y-1">
      {show.map((item) =>
        item === null ? (
          <p key="ellipsis" className="text-sm text-surface-500 py-1">
            ... ({total - 4} ocultas) ...
          </p>
        ) : (
          <p key={item.n} className="text-sm text-surface-700">
            Parcela {item.n}/{total} — {formatCurrencyFromCents(item.amount)} — {item.date}
          </p>
        )
      )}
      {total > 4 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="text-sm text-primary-600 hover:underline mt-1"
        >
          {expanded ? 'Ver menos ▲' : 'Ver todas as parcelas ▼'}
        </button>
      )}
    </div>
  )
}
