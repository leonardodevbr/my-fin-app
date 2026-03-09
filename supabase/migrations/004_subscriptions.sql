-- Assinaturas NunFí Pro + histórico de pagamentos

-- Enum de status
create type plan_status as enum ('trial', 'active', 'past_due', 'canceled', 'expired');

-- Tabela principal de assinatura (1 por usuário)
create table user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  status plan_status not null default 'trial',
  trial_ends_at timestamptz not null default (now() + interval '30 days'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  efi_txid text,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Histórico de pagamentos
create table payment_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents int not null,
  status text not null check (status in ('pending', 'paid', 'failed', 'refunded')),
  payment_method text default 'pix',
  efi_txid text,
  pix_copia_e_cola text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- RLS
alter table user_subscriptions enable row level security;
alter table payment_history enable row level security;

create policy "own_subscription" on user_subscriptions
  for all using (user_id = auth.uid());

create policy "own_payment_history" on payment_history
  for all using (user_id = auth.uid());

-- Trigger updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger user_subscriptions_updated_at
  before update on user_subscriptions
  for each row execute function set_updated_at();

-- Auto-cria trial ao cadastrar novo usuário
create or replace function handle_new_user_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into user_subscriptions (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function handle_new_user_subscription();

-- Cria trial para usuários já existentes (rodar uma única vez)
insert into user_subscriptions (user_id)
select id from auth.users
where id not in (select user_id from user_subscriptions)
on conflict do nothing;

