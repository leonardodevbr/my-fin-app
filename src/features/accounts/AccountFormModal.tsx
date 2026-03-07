import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Account } from '../../db'
import { addAccount, updateAccount, createInitialBalanceTransaction } from '../../hooks/useAccounts'
import { Button } from '../../components/ui/Button'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { Select } from '../../components/ui/Select'
import {
  ACCOUNT_TYPE_OPTIONS,
  PRESET_COLORS,
  ICON_OPTIONS,
  CURRENCY_OPTIONS,
  type AccountTypeOptionValue,
} from './constants'
import { Wallet, Landmark, CreditCard, Banknote, TrendingUp, PiggyBank } from 'lucide-react'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  typeValue: z.string(),
  initialBalance: z.number(),
  color: z.string(),
  icon: z.string(),
  currency: z.string(),
})

type FormValues = z.infer<typeof schema>

const LUCIDE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  wallet: Wallet,
  landmark: Landmark,
  'credit-card': CreditCard,
  banknote: Banknote,
  'trending-up': TrendingUp,
  'piggy-bank': PiggyBank,
  briefcase: Wallet,
  home: Landmark,
  car: Banknote,
  'shopping-cart': CreditCard,
}

function IconCell({ icon, selected, onClick }: { icon: string; selected: boolean; onClick: () => void }) {
  const LucideIcon = LUCIDE_ICONS[icon]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg border-2 text-lg transition-colors',
        selected ? 'border-primary-600 bg-primary-50' : 'border-surface-200 hover:border-surface-300'
      )}
    >
      {LucideIcon ? <LucideIcon className="h-5 w-5" /> : <span>{icon}</span>}
    </button>
  )
}

export interface AccountFormModalProps {
  open: boolean
  onClose: () => void
  account?: Account | null
  onSaved: () => void
}

export function AccountFormModal({ open, onClose, account, onSaved }: AccountFormModalProps) {
  const isEdit = !!account
  const typeOptions = useMemo(
    () => ACCOUNT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    []
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      typeValue: 'checking',
      initialBalance: 0,
      color: '#10b981',
      icon: 'wallet',
      currency: 'BRL',
    },
  })

  const typeValue = watch('typeValue')
  const color = watch('color')
  const icon = watch('icon')
  const currency = watch('currency')

  useEffect(() => {
    if (open) {
      if (account) {
        const typeOption = ACCOUNT_TYPE_OPTIONS.find((o) => o.schemaType === account.type)
        reset({
          name: account.name,
          typeValue: (typeOption?.value ?? account.type) as AccountTypeOptionValue,
          initialBalance: 0,
          color: account.color,
          icon: account.icon,
          currency: account.currency,
        })
      } else {
        reset({
          name: '',
          typeValue: 'checking',
          initialBalance: 0,
          color: '#10b981',
          icon: 'wallet',
          currency: 'BRL',
        })
      }
    }
  }, [open, account, reset])

  const onSubmit = async (data: FormValues) => {
    try {
      const typeOption = ACCOUNT_TYPE_OPTIONS.find((o) => o.value === data.typeValue)
      const schemaType = typeOption?.schemaType ?? 'checking'
      if (isEdit && account) {
        await updateAccount(account.id, {
          name: data.name.trim(),
          type: schemaType,
          color: data.color,
          icon: data.icon,
          currency: data.currency,
        })
        toast.success('Conta atualizada')
      } else {
        const id = await addAccount({
          name: data.name.trim(),
          type: schemaType,
          balance: 0,
          color: data.color,
          icon: data.icon,
          currency: data.currency,
          is_active: true,
        })
        if (data.initialBalance !== 0) {
          await createInitialBalanceTransaction(id, data.initialBalance)
        }
        toast.success('Conta criada')
      }
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
      throw e
    }
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-surface-200">
          <h2 className="text-lg font-semibold text-surface-900">
            {isEdit ? 'Editar conta' : 'Nova conta'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-surface-500 hover:bg-surface-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Nome</label>
            <input
              {...register('name')}
              type="text"
              placeholder="Ex: Nubank, Carteira"
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-surface-900"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>
          <Select<AccountTypeOptionValue>
            label="Tipo"
            value={typeValue as AccountTypeOptionValue}
            onChange={(v) => setValue('typeValue', v)}
            options={typeOptions}
          />
          {!isEdit && (
            <CurrencyInput
              label="Saldo inicial"
              value={watch('initialBalance')}
              onChange={(v) => setValue('initialBalance', v)}
              placeholder="R$ 0,00"
            />
          )}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Cor</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setValue('color', c)}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 transition-transform',
                    color === c ? 'border-surface-900 scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Ícone</label>
            <div className="grid grid-cols-5 gap-2">
              {ICON_OPTIONS.map((opt) => (
                <IconCell
                  key={opt}
                  icon={opt}
                  selected={icon === opt}
                  onClick={() => setValue('icon', opt)}
                />
              ))}
            </div>
          </div>
          <Select
            label="Moeda"
            value={currency}
            onChange={(v) => setValue('currency', v)}
            options={CURRENCY_OPTIONS}
          />
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar conta'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
