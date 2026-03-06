import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Category } from '../db'
import { generateId } from '../lib/utils'

export function useCategories(type?: 'income' | 'expense') {
  const list = useLiveQuery(
    async () => {
      let collection = db.categories.orderBy('name')
      if (type) {
        return collection.filter((c) => c.type === type).toArray()
      }
      return collection.toArray()
    },
    [type]
  )
  return list ?? []
}

export function useCategory(id: string | null) {
  return useLiveQuery(
    () => (id ? db.categories.get(id) : Promise.resolve(undefined)),
    [id]
  )
}

export async function addCategory(
  data: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'synced_at'>
): Promise<string> {
  const id = generateId()
  const now = new Date().toISOString()
  const category: Category = {
    ...data,
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
  return id
}

export async function updateCategory(
  id: string,
  data: Partial<Omit<Category, 'id' | 'created_at'>>
): Promise<void> {
  const existing = await db.categories.get(id)
  if (!existing) return
  const now = new Date().toISOString()
  const updated = { ...existing, ...data, updated_at: now }
  await db.categories.put(updated)
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'categories',
    record_id: id,
    operation: 'update',
    payload: JSON.stringify(updated),
    created_at: now,
    attempts: 0,
  })
}

export async function deleteCategory(id: string): Promise<void> {
  await db.categories.delete(id)
  const now = new Date().toISOString()
  await db.sync_queue.add({
    id: generateId(),
    table_name: 'categories',
    record_id: id,
    operation: 'delete',
    payload: JSON.stringify({ id }),
    created_at: now,
    attempts: 0,
  })
}
