-- =============================================================================
-- RESET: apaga tudo do Finapp (storage, trigger auth, funções, tabelas)
-- =============================================================================
-- Ordem de execução: 1) este reset  2) migration (001_initial_schema.sql)  3) seed.sql
-- Rode no SQL Editor do Supabase quando quiser zerar e recomeçar.
-- =============================================================================

-- 1. Storage: políticas do bucket avatars (Supabase não permite DELETE direto em storage.buckets)
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are public" ON storage.objects;

-- 2. Trigger em auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Funções (trigger e helpers)
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS create_default_account_for_user(uuid);
DROP FUNCTION IF EXISTS create_default_categories_for_user(uuid);

-- 4. Tabelas (ordem por FKs: budgets → transactions → transaction_groups → categories → accounts)
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS transaction_groups CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- 5. Funções restantes (updated_at e RPC)
DROP FUNCTION IF EXISTS set_updated_at();
DROP FUNCTION IF EXISTS get_changes_since(text, timestamptz);
