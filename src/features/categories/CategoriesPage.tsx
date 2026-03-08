import { useState } from 'react'
import type { Category } from '../../db'
import { useCategories } from '../../hooks/useCategories'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { CategoryFormModal } from './CategoryFormModal'
import { CategoryIcon } from './categoryIconMap'
import { Plus } from 'lucide-react'

export function CategoriesPage() {
  const categories = useCategories()
  const [formOpen, setFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)

  const handleNew = () => {
    setEditingCategory(null)
    setFormOpen(true)
  }

  const handleEdit = (c: Category) => {
    setEditingCategory(c)
    setFormOpen(true)
  }

  const handleSaved = () => {
    setFormOpen(false)
    setEditingCategory(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-surface-900">Categorias</h1>
        <Button onClick={handleNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova categoria
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Lista de categorias</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-surface-500 py-4">Nenhuma categoria cadastrada.</p>
          ) : (
            <ul className="divide-y divide-surface-200">
              {categories.map((c) => (
                <li
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleEdit(c)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEdit(c)}
                  className="py-3 first:pt-0 last:pb-0 flex items-center gap-3 cursor-pointer hover:bg-surface-50 rounded-lg -mx-1 px-1 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.icon ? (
                      <CategoryIcon iconName={c.icon} className="h-5 w-5" />
                    ) : (
                      <span>{c.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-surface-900">{c.name}</p>
                    {c.parent_id && <p className="text-sm text-surface-500">Subcategoria</p>}
                  </div>
                  <Badge variant={c.type === 'income' ? 'income' : 'expense'}>
                    {c.type === 'income' ? 'receita' : 'despesa'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <CategoryFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingCategory(null) }}
        category={editingCategory}
        onSaved={handleSaved}
      />
    </div>
  )
}
