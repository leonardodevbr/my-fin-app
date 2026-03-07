-- =============================================================================
-- Finapp: schema único (tabelas, RLS, realtime, triggers, conta/categorias padrão, storage)
-- VERSÃO CORRIGIDA: campos monetários como int8 (centavos inteiros)
-- =============================================================================
-- Ordem de execução: 1) reset.sql  2) esta migration  3) seed.sql
-- =============================================================================

-- =============================================================================
-- TABLES
-- =============================================================================

CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  -- Saldo inicial em centavos inteiros. Ex: R$ 1.000,00 = 100000
  balance int8 NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#10b981',
  icon text NOT NULL DEFAULT 'wallet',
  currency text NOT NULL DEFAULT 'BRL',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  color text NOT NULL DEFAULT '#64748b',
  icon text NOT NULL DEFAULT 'tag',
  parent_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

CREATE TABLE transaction_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  payment_mode text NOT NULL CHECK (payment_mode IN ('single', 'installments', 'recurring')),
  installments_total int4,
  -- Valores em centavos inteiros. Ex: R$ 1.150,00 = 115000
  amount_total int8,
  amount_per_installment int8,
  recurrence_period text CHECK (recurrence_period IN ('daily', 'weekly', 'biweekly', 'monthly', 'every_2_months', 'every_3_months', 'every_6_months', 'yearly')),
  recurrence_end_date date,
  start_date date NOT NULL,
  notes text,
  tags jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES transaction_groups(id) ON DELETE SET NULL,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  -- Valor em centavos inteiros. Ex: R$ 54,00 = 5400
  amount int8 NOT NULL,
  description text NOT NULL,
  date date NOT NULL,
  paid_at timestamptz,
  is_paid boolean NOT NULL DEFAULT false,
  installment_number int4,
  notes text,
  tags jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

CREATE TABLE budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  -- Limite em centavos inteiros. Ex: R$ 500,00 = 50000
  amount int8 NOT NULL,
  month varchar(7) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  synced_at timestamptz
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX idx_accounts_user_id_updated_at ON accounts(user_id, updated_at DESC);
CREATE INDEX idx_categories_user_id_updated_at ON categories(user_id, updated_at DESC);
CREATE INDEX idx_transaction_groups_user_id_updated_at ON transaction_groups(user_id, updated_at DESC);
CREATE INDEX idx_transactions_user_id_updated_at ON transactions(user_id, updated_at DESC);
CREATE INDEX idx_budgets_user_id_updated_at ON budgets(user_id, updated_at DESC);
CREATE INDEX idx_transactions_user_id_date_desc ON transactions(user_id, date DESC);
CREATE INDEX idx_transactions_user_id_account_id ON transactions(user_id, account_id);
CREATE INDEX idx_transactions_user_id_category_id ON transactions(user_id, category_id);
CREATE INDEX idx_transactions_group_id ON transactions(group_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_select ON accounts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY accounts_insert ON accounts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY accounts_update ON accounts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY accounts_delete ON accounts FOR DELETE USING (user_id = auth.uid());

CREATE POLICY categories_select ON categories FOR SELECT USING (user_id = auth.uid());
CREATE POLICY categories_insert ON categories FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY categories_update ON categories FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY categories_delete ON categories FOR DELETE USING (user_id = auth.uid());

CREATE POLICY transaction_groups_select ON transaction_groups FOR SELECT USING (user_id = auth.uid());
CREATE POLICY transaction_groups_insert ON transaction_groups FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY transaction_groups_update ON transaction_groups FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY transaction_groups_delete ON transaction_groups FOR DELETE USING (user_id = auth.uid());

CREATE POLICY transactions_select ON transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY transactions_insert ON transactions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY transactions_update ON transactions FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY transactions_delete ON transactions FOR DELETE USING (user_id = auth.uid());

CREATE POLICY budgets_select ON budgets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY budgets_insert ON budgets FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY budgets_update ON budgets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY budgets_delete ON budgets FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- REALTIME
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE transaction_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;

-- =============================================================================
-- RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION get_changes_since(p_table text, p_since timestamptz)
RETURNS SETOF json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_table NOT IN ('accounts', 'categories', 'transaction_groups', 'transactions', 'budgets') THEN
    RAISE EXCEPTION 'Invalid table name: %', p_table;
  END IF;
  RETURN QUERY EXECUTE format(
    'SELECT row_to_json(t) FROM %I t WHERE user_id = auth.uid() AND updated_at > $1 ORDER BY updated_at',
    p_table
  )
  USING p_since;
END;
$$;

-- =============================================================================
-- TRIGGERS updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER transaction_groups_updated_at BEFORE UPDATE ON transaction_groups FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- FUNÇÕES: categorias e conta padrão para novos usuários
-- =============================================================================

CREATE OR REPLACE FUNCTION create_default_categories_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO categories (id, user_id, name, type, color, icon, parent_id, created_at, updated_at)
  VALUES
    (gen_random_uuid(), p_user_id, 'Salário',      'income',  '#10b981', 'briefcase',  NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Freelance',    'income',  '#059669', 'laptop',     NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Investimentos','income',  '#047857', 'trending-up',NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Outros',       'income',  '#64748b', 'circle',     NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Alimentação',  'expense', '#dc2626', 'utensils',   NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Transporte',   'expense', '#ea580c', 'car',        NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Moradia',      'expense', '#ca8a04', 'home',       NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Saúde',        'expense', '#2563eb', 'heart',      NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Educação',     'expense', '#7c3aed', 'book-open',  NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Lazer',        'expense', '#db2777', 'smile',      NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Vestuário',    'expense', '#0d9488', 'shirt',      NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Serviços',     'expense', '#4f46e5', 'settings',   NULL, now(), now()),
    (gen_random_uuid(), p_user_id, 'Outros',       'expense', '#64748b', 'circle',     NULL, now(), now());
END;
$$;

CREATE OR REPLACE FUNCTION create_default_account_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO accounts (user_id, name, type, balance, color, icon, currency, is_active, created_at, updated_at)
  VALUES (p_user_id, 'Carteira', 'cash', 0, '#10b981', 'wallet', 'BRL', true, now(), now());
END;
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_default_categories_for_user(NEW.id);
  PERFORM create_default_account_for_user(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================================================
-- STORAGE: bucket avatars (fotos de perfil)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Avatars are public"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');