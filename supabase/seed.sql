-- =============================================================================
-- Finapp seed: categorias padrão + conta padrão (contexto financeiro BR)
-- =============================================================================
--
-- O que este seed faz:
--   Para cada usuário em auth.users:
--     - Insere 12 categorias (Salário, Freelance, Investimentos, Alimentação, etc.)
--     - Insere 1 conta padrão "Carteira" (tipo cash).
--
-- Transações e orçamentos NÃO são inseridos aqui (são criados pelo app).
--
-- Como rodar no Supabase Cloud:
--   1. Rode antes: reset.sql (se quiser zerar) e depois a migration 001_initial_schema.sql.
--   2. Authentication → certifique-se de ter pelo menos um usuário.
--   3. SQL Editor → New query → cole todo este arquivo → Run.
--   4. Confira em Table Editor: categories (12 linhas/usuário), accounts (1 linha/usuário).
--
-- Novos usuários: ao se cadastrar, o trigger on_auth_user_created já cria
-- categorias e conta padrão automaticamente (não precisa rodar o seed de novo).
--
-- =============================================================================

-- Categorias: Receita: Salário, Freelance, Investimentos | Despesa: Alimentação, Transporte, Moradia, Saúde, Educação, Lazer, Vestuário, Serviços, Outros
-- Conta: 1x "Carteira" (cash) por usuário

DO $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN SELECT id FROM auth.users
  LOOP
    PERFORM create_default_categories_for_user(r.id);
    PERFORM create_default_account_for_user(r.id);
    n := n + 1;
  END LOOP;

  IF n = 0 THEN
    RAISE NOTICE 'Nenhum usuário em auth.users. Crie um usuário (Auth ou pelo app) e rode este seed de novo, ou cadastre-se no app que o trigger já cria categorias e conta padrão.';
  ELSE
    RAISE NOTICE 'Categorias e conta padrão criadas para % usuário(s). Categorias: % linhas. Contas: % linhas.', n, n * 12, n;
  END IF;
END
$$;
