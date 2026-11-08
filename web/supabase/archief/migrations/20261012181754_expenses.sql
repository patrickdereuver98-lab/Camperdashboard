-- Status: live toegepast op 2026-10-12.
-- Fase 5c: uitgaven onderweg (kosten- en brandstoftracker) per account. Zonder account alleen op het toestel.
create table if not exists public.user_expenses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array' and jsonb_array_length(entries) <= 1000),
  updated_at timestamptz not null default now()
);
alter table public.user_expenses enable row level security;
create policy "eigen uitgaven" on public.user_expenses for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.user_expenses from anon;
grant select, insert, update on public.user_expenses to authenticated;
