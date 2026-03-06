-- Finapp seed: default categories (Brazilian financial context)
-- New users get these automatically via trigger (on_auth_user_created).
-- This script adds the same categories for any existing user(s).

-- Default categories created:
-- Income:  Salário, Freelance, Investimentos
-- Expense: Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Vestuário, Serviços, Outros

-- Create default categories for the first existing user (e.g. after initial setup)
DO $$
DECLARE
  first_user_id uuid;
BEGIN
  SELECT id INTO first_user_id FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_user_id IS NOT NULL THEN
    PERFORM create_default_categories_for_user(first_user_id);
    RAISE NOTICE 'Default categories created for user %', first_user_id;
  ELSE
    RAISE NOTICE 'No users found. Default categories will be created when the first user signs up.';
  END IF;
END
$$;
