-- Tabela para armazenar subscriptions de Web Push (um usuário pode ter vários dispositivos)
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

alter table push_subscriptions enable row level security;

create policy "users_own_subscriptions_select" on push_subscriptions
  for select using (user_id = auth.uid());

create policy "users_own_subscriptions_insert" on push_subscriptions
  for insert with check (user_id = auth.uid());

create policy "users_own_subscriptions_delete" on push_subscriptions
  for delete using (user_id = auth.uid());
