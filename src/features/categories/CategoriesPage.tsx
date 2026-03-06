import { useCategories } from '../../hooks/useCategories'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'

export function CategoriesPage() {
  const categories = useCategories()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-surface-900">Categorias</h1>
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
                <li key={c.id} className="py-3 first:pt-0 last:pb-0 flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: c.color }}
                  >
                    {c.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-surface-900">{c.name}</p>
                    {c.parent_id && <p className="text-sm text-surface-500">Subcategoria</p>}
                  </div>
                  <Badge variant={c.type === 'income' ? 'income' : 'expense'}>{c.type}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
