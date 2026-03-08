-- =============================================================================
-- pg_cron: agenda notificações automáticas de transações a vencer
-- Executar no SQL Editor do Supabase
-- =============================================================================

-- 1. Habilita as extensões necessárias
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Remove job anterior se existir (evita erro de nome duplicado)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'scheduler-due-notifications') then
    perform cron.unschedule('scheduler-due-notifications');
  end if;
end $$;

-- 3. Cria o job: todo dia às 11h UTC (= 8h BRT)
select cron.schedule(
  'scheduler-due-notifications',
  '0 11 * * *',
  $$
  select net.http_post(
    url     := 'https://hrvuzqtcntvsjeqdimsf.supabase.co/functions/v1/scheduler-due-notifications',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer SEU_SERVICE_ROLE_KEY_AQUI'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- =============================================================================
-- Verificação
-- =============================================================================

-- Lista todos os jobs agendados
select * from cron.job;

-- Histórico de execuções (últimas 20)
select *
from cron.job_run_details
order by start_time desc
limit 20;

-- =============================================================================
-- Utilitários (rodar separadamente conforme necessidade)
-- =============================================================================

-- Testar manualmente sem esperar o cron:
-- select net.http_post(
--   url     := 'https://hrvuzqtcntvsjeqdimsf.supabase.co/functions/v1/scheduler-due-notifications',
--   headers := jsonb_build_object(
--     'Content-Type',  'application/json',
--     'Authorization', 'Bearer SEU_SERVICE_ROLE_KEY_AQUI'
--   ),
--   body    := '{}'::jsonb
-- );

-- Remover o job:
-- select cron.unschedule('scheduler-due-notifications');