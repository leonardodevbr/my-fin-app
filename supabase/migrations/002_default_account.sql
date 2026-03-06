-- Conta padrão para novos usuários (e para seed)
-- Uma conta "Carteira" (type cash) por usuário.

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

-- Atualiza o trigger de novo usuário para criar também a conta padrão
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
