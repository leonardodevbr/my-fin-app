import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Category } from '../../db'
import { addCategory, updateCategory } from '../../hooks/useCategories'
import { Button } from '../../components/ui/Button'
import { CategoryIcon, CATEGORY_ICON_KEYS } from './categoryIconMap'
import { cn } from '../../lib/utils'
import toast from 'react-hot-toast'

const PRESET_COLORS = [
  '#dc2626',
  '#ea580c',
  '#ca8a04',
  '#65a30d',
  '#059669',
  '#0d9488',
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#64748b',
]

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  type: z.enum(['income', 'expense']),
  color: z.string(),
  icon: z.string(),
})

type FormValues = z.infer<typeof schema>

export interface CategoryFormModalProps {
  open: boolean
  onClose: () => void
  category: Category | null
  onSaved: () => void
}

export function CategoryFormModal({ open, onClose, category, onSaved }: CategoryFormModalProps) {
  const isEdit = !!category

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
      type: 'expense',
      color: PRESET_COLORS[0],
      icon: 'circle',
    },
  })

  const color = watch('color')
  const icon = watch('icon')

  useEffect(() => {
    if (open) {
      if (category) {
        reset({
          name: category.name,
          type: category.type,
          color: category.color,
          icon: category.icon || 'circle',
        })
      } else {
        reset({
          name: '',
          type: 'expense',
          color: PRESET_COLORS[0],
          icon: 'circle',
        })
      }
    }
  }, [open, category, reset])

  const onSubmit = async (data: FormValues) => {
    try {
      if (isEdit && category) {
        await updateCategory(category.id, {
          name: data.name.trim(),
          type: data.type,
          color: data.color,
          icon: data.icon,
        })
        toast.success('Categoria atualizada')
      } else {
        await addCategory({
          name: data.name.trim(),
          type: data.type,
          color: data.color,
          icon: data.icon,
          parent_id: null,
        })
        toast.success('Categoria criada')
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
            {isEdit ? 'Editar categoria' : 'Nova categoria'}
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
              placeholder="Ex: Alimentação, Salário"
              className="w-full rounded-lg border border-surface-300 px-3 py-2 text-surface-900"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Tipo</label>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 cursor-pointer transition-colors has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
                <input {...register('type')} type="radio" value="expense" className="sr-only" />
                <span className="text-sm font-medium text-surface-700">Despesa</span>
              </label>
              <label className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-3 py-2 cursor-pointer transition-colors has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50">
                <input {...register('type')} type="radio" value="income" className="sr-only" />
                <span className="text-sm font-medium text-surface-700">Receita</span>
              </label>
            </div>
          </div>
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
                    color === c ? 'border-surface-800 scale-110' : 'border-surface-200 hover:border-surface-400'
                  )}
                  style={{ backgroundColor: c }}
                  aria-label="Selecionar cor"
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Ícone</label>
            <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
              {CATEGORY_ICON_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setValue('icon', key)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg border-2 transition-colors',
                    icon === key ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-surface-200 hover:border-surface-300 text-surface-600'
                  )}
                  aria-label={`Ícone ${key}`}
                >
                  <CategoryIcon iconName={key} className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
