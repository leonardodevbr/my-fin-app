import { useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Budget } from '../../db'
import { addBudget, addBudgetsForMonths, updateBudget } from '../../hooks/useBudgets'
import { useCategories } from '../../hooks/useCategories'
import { Button } from '../../components/ui/Button'
import { CurrencyInput } from '../../components/ui/CurrencyInput'
import { SearchableSelect } from '../../components/ui/SearchableSelect'
import { toMonthKey } from '../../lib/utils'
import toast from 'react-hot-toast'

const schema = z.object({
  category_id: z.string().min(1, 'Selecione uma categoria'),
  amount: z.number().min(1, 'Informe o limite'),
  month: z.string().min(1, 'Informe o mês'),
  repeatEveryMonth: z.boolean(),
})

type FormValues = z.infer<typeof schema>

export interface BudgetFormModalProps {
  open: boolean
  onClose: () => void
  budget?: Budget | null
  initialMonth?: string
  onSaved: () => void
}

export function BudgetFormModal({
  open,
  onClose,
  budget,
  initialMonth,
  onSaved,
}: BudgetFormModalProps) {
  const categories = useCategories('expense')
  const isEdit = !!budget
  const options = useMemo(
    () =>
      categories.map((c) => ({
        value: c.id,
        label: c.name,
        color: c.color,
      })),
    [categories]
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
      category_id: '',
      amount: 0,
      month: initialMonth ?? toMonthKey(new Date()),
      repeatEveryMonth: false,
    },
  })

  const categoryId = watch('category_id')

  useEffect(() => {
    if (open) {
      if (budget) {
        reset({
          category_id: budget.category_id,
          amount: budget.amount,
          month: budget.month,
          repeatEveryMonth: false,
        })
      } else {
        reset({
          category_id: '',
          amount: 0,
          month: initialMonth ?? toMonthKey(new Date()),
          repeatEveryMonth: false,
        })
      }
    }
  }, [open, budget, initialMonth, reset])

  const onSubmit = async (data: FormValues) => {
    try {
      const amount = Math.round(data.amount) || 0
      if (amount <= 0) {
        toast.error('Informe o limite em valor positivo.')
        return
      }
      if (isEdit && budget) {
        await updateBudget(budget.id, {
          category_id: data.category_id,
          amount,
          month: data.month,
        })
        toast.success('Orçamento atualizado')
      } else {
        if (data.repeatEveryMonth) {
          await addBudgetsForMonths(data.category_id, amount, data.month, 12)
          toast.success('12 orçamentos criados (um por mês)')
        } else {
          await addBudget({
            category_id: data.category_id,
            amount,
            month: data.month,
          })
          toast.success('Orçamento criado')
        }
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
            {isEdit ? 'Editar orçamento' : 'Novo orçamento'}
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
          <SearchableSelect
            label="Categoria"
            value={categoryId}
            onChange={(v) => setValue('category_id', v)}
            options={options}
            placeholder="Selecione categoria (despesas)"
            searchPlaceholder="Buscar categoria..."
          />
          {errors.category_id && (
            <p className="text-sm text-red-600 -mt-2">{errors.category_id.message}</p>
          )}
          <CurrencyInput
            label="Limite (R$)"
            value={watch('amount')}
            onChange={(v) => setValue('amount', v)}
            placeholder="R$ 0,00"
          />
          {errors.amount && (
            <p className="text-sm text-red-600 -mt-2">{errors.amount.message}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Mês</label>
            <input
              {...register('month')}
              type="month"
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-surface-900"
            />
          </div>
          {!isEdit && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                {...register('repeatEveryMonth')}
                className="rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-surface-700">Repetir todo mês (próximos 12 meses)</span>
            </label>
          )}
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
