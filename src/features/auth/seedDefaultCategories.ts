import { db } from '../../db'
import type { Category } from '../../db'
import { generateId } from '../../lib/utils'

const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'synced_at'>[] = [
  { name: 'Salário', type: 'income', color: '#10b981', icon: 'briefcase', parent_id: null },
  { name: 'Freelance', type: 'income', color: '#059669', icon: 'laptop', parent_id: null },
  { name: 'Investimentos', type: 'income', color: '#047857', icon: 'trending-up', parent_id: null },
  { name: 'Alimentação', type: 'expense', color: '#dc2626', icon: 'utensils', parent_id: null },
  { name: 'Transporte', type: 'expense', color: '#ea580c', icon: 'car', parent_id: null },
  { name: 'Moradia', type: 'expense', color: '#ca8a04', icon: 'home', parent_id: null },
  { name: 'Saúde', type: 'expense', color: '#2563eb', icon: 'heart', parent_id: null },
  { name: 'Educação', type: 'expense', color: '#7c3aed', icon: 'book-open', parent_id: null },
  { name: 'Lazer', type: 'expense', color: '#db2777', icon: 'smile', parent_id: null },
  { name: 'Vestuário', type: 'expense', color: '#0d9488', icon: 'shirt', parent_id: null },
  { name: 'Serviços', type: 'expense', color: '#4f46e5', icon: 'settings', parent_id: null },
  { name: 'Outros', type: 'expense', color: '#64748b', icon: 'circle', parent_id: null },
]

/** Inserts default Brazilian categories into Dexie + sync_queue (after register). */
export async function seedDefaultCategories(): Promise<void> {
  const now = new Date().toISOString()
  for (const row of DEFAULT_CATEGORIES) {
    const id = generateId()
    const category: Category = {
      ...row,
      id,
      created_at: now,
      updated_at: now,
      synced_at: null,
    }
    await db.categories.add(category)
    await db.sync_queue.add({
      id: generateId(),
      table_name: 'categories',
      record_id: id,
      operation: 'insert',
      payload: JSON.stringify(category),
      created_at: now,
      attempts: 0,
    })
  }
}
