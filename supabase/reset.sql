-- =============================================================================
-- APAGAR TUDO do Finapp (tabelas, triggers, funções)
-- =============================================================================
-- Rode este arquivo no SQL Editor do Supabase quando quiser zerar e recomeçar.
-- Depois rode na ordem: 001_initial_schema.sql → 002_default_account.sql → seed.sql
-- =============================================================================

-- 1. Trigger em auth.users (tem que ser primeiro)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Funções usadas pelo trigger
DROP FUNCTION IF EXISTS handle_new_user();
DROP FUNCTION IF EXISTS create_default_account_for_user(uuid);
DROP FUNCTION IF EXISTS create_default_categories_for_user(uuid);

-- 3. Tabelas (a ordem importa por causa das chaves estrangeiras)
DROP TABLE IF EXISTS budgets CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- 4. Funções que sobraram (triggers de updated_at e RPC)
DROP FUNCTION IF EXISTS set_updated_at();
DROP FUNCTION IF EXISTS get_changes_since(text, timestamptz);
