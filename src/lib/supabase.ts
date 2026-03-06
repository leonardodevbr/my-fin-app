import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')
)

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return _client
}

/** Use getSupabase() when you need the client; returns null if Supabase is not configured. */
export function getSupabase(): SupabaseClient | null {
  return getClient()
}
