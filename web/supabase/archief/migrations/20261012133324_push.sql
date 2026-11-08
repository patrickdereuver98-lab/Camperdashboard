-- Status: live toegepast op 2026-10-12.
-- Fase 5a-2: pushmelding "nu rustig" voor wie een plek volgt.
-- VAPID-sleutels: de edge function `push` maakt ze bij het eerste gebruik aan; ze staan in private.secrets en de private
-- sleutel is alleen voor service_role leesbaar. Abonnementen en volgers: alleen eigen rijen, via RPC's.

create or replace function public.push_vapid_keys()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'publicKey', (select value from private.secrets where name = 'vapid_public'),
    'privateKey', (select value from private.secrets where name = 'vapid_private'));
$$;
revoke all on function public.push_vapid_keys() from public, anon, authenticated;
grant execute on function public.push_vapid_keys() to service_role;

create or replace function public.push_set_vapid_keys(p_public text, p_private text)
returns void language sql security definer set search_path = '' as $$
  insert into private.secrets (name, value) values ('vapid_public', p_public), ('vapid_private', p_private)
  on conflict (name) do nothing;
$$;
revoke all on function public.push_set_vapid_keys(text, text) from public, anon, authenticated;
grant execute on function public.push_set_vapid_keys(text, text) to service_role;

create or replace function public.push_public_key()
returns text language sql stable security definer set search_path = '' as $$
  select value from private.secrets where name = 'vapid_public';
$$;
grant execute on function public.push_public_key() to anon, authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  disabled_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id) where disabled_at is null;
alter table public.push_subscriptions enable row level security;
create policy "eigen abonnementen lezen" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;

create table if not exists public.crowd_watches (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  notified_at timestamptz,
  primary key (user_id, place_id)
);
create index if not exists crowd_watches_place_idx on public.crowd_watches (place_id) where notified_at is null;
alter table public.crowd_watches enable row level security;
create policy "eigen volgers lezen" on public.crowd_watches for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.crowd_watches from anon, authenticated;
grant select on public.crowd_watches to authenticated;

-- Abonnement van deze browser opslaan (een browser hoort bij hoogstens één account tegelijk)
create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if p_endpoint !~ '^https://' or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100 then
    raise exception 'Ongeldig abonnement';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, disabled_at = null;
end $$;
revoke all on function public.push_subscribe(text, text, text) from public, anon;
grant execute on function public.push_subscribe(text, text, text) to authenticated;

-- Een plek 24 uur volgen; opnieuw volgen verlengt. Stoppen zet de vervaltijd op nu.
create or replace function public.watch_place(p_place_id uuid, p_on boolean default true)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if p_on then
    if (select count(*) from public.crowd_watches where user_id = auth.uid() and expires_at > now()) >= 10 then
      raise exception 'Je volgt al 10 plekken. Stop eerst met een andere.';
    end if;
    insert into public.crowd_watches (user_id, place_id) values (auth.uid(), p_place_id)
    on conflict (user_id, place_id) do update set created_at = now(), expires_at = now() + interval '24 hours', notified_at = null;
  else
    update public.crowd_watches set expires_at = now() where user_id = auth.uid() and place_id = p_place_id;
  end if;
  return p_on;
end $$;
revoke all on function public.watch_place(uuid, boolean) from public, anon;
grant execute on function public.watch_place(uuid, boolean) to authenticated;

-- Voor de edge function: doelen ophalen en de volgers meteen als gemeld markeren (elke volger krijgt één melding)
create or replace function public.push_take_targets(p_place_id uuid)
returns table (subscription_id uuid, endpoint text, p256dh text, auth text, place_name text, place_slug text)
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with w as (
    update public.crowd_watches cw set notified_at = now()
    where cw.place_id = p_place_id and cw.notified_at is null and cw.expires_at > now()
    returning cw.user_id
  )
  select s.id, s.endpoint, s.p256dh, s.auth, p.name, p.slug
  from w join public.push_subscriptions s on s.user_id = w.user_id and s.disabled_at is null
  join public.places p on p.id = p_place_id;
end $$;
revoke all on function public.push_take_targets(uuid) from public, anon, authenticated;
grant execute on function public.push_take_targets(uuid) to service_role;

create or replace function public.push_disable_subscriptions(p_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.push_subscriptions set disabled_at = now() where id = any(p_ids);
$$;
revoke all on function public.push_disable_subscriptions(uuid[]) from public, anon, authenticated;
grant execute on function public.push_disable_subscriptions(uuid[]) to service_role;

-- Melding "rustig" en de stand is nu rustig → edge function aanroepen (alleen als iemand de plek volgt)
create or replace function private.crowd_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  if new.level <> 'rustig' then return null; end if;
  if not exists (select 1 from public.crowd_watches where place_id = new.place_id and notified_at is null and expires_at > now()) then return null; end if;
  if public.crowd_status(new.place_id)->>'level' is distinct from 'rustig' then return null; end if;
  select value into k from public.internal_secrets where name = 'pipeline_key';
  perform net.http_post(
    url := 'https://qkrmthrhwmmmwswmfgwc.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-pipeline-key', k),
    body := jsonb_build_object('action', 'notify', 'place_id', new.place_id),
    timeout_milliseconds := 20000);
  return null;
end $$;
create trigger crowd_reports_notify after insert or update of level on public.crowd_reports
  for each row execute function private.crowd_notify();
