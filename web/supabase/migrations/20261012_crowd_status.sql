-- Status: live toegepast op 2026-10-12.
-- Fase 5a: live drukte. Ingelogde camperaars melden hoe druk het nu is (rustig, druk, vol). De site toont alleen
-- meldingen van de laatste 3 uur, met aantal en tijdstip; nooit een eigen inschatting.

create table if not exists public.crowd_reports (
  id bigint generated always as identity primary key,
  place_id uuid not null references public.places (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  level text not null check (level in ('rustig', 'druk', 'vol')),
  created_at timestamptz not null default now()
);
create index if not exists crowd_reports_place_time_idx on public.crowd_reports (place_id, created_at desc);
create index if not exists crowd_reports_user_time_idx on public.crowd_reports (user_id, created_at desc);
alter table public.crowd_reports enable row level security;
create policy "beheer leest drukte" on public.crowd_reports for select to authenticated using ((select public.is_admin()));
revoke all on public.crowd_reports from anon, authenticated;
grant select on public.crowd_reports to authenticated;

-- Melden: ingelogd, gepubliceerde plek, per persoon per plek één melding per 30 minuten (een nieuwe vervangt de
-- vorige), en hoogstens 30 meldingen per persoon per dag.
create or replace function public.report_crowd(p_place_id uuid, p_level text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); recent bigint;
begin
  if uid is null then raise exception 'Log in om de drukte door te geven'; end if;
  if p_level not in ('rustig', 'druk', 'vol') then raise exception 'Kies rustig, druk of vol'; end if;
  if not exists (select 1 from public.places where id = p_place_id and status = 'published') then raise exception 'Onbekende plek'; end if;
  if (select count(*) from public.crowd_reports where user_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Je hebt vandaag al veel meldingen gedaan. Probeer het morgen weer.';
  end if;
  select id into recent from public.crowd_reports
  where user_id = uid and place_id = p_place_id and created_at > now() - interval '30 minutes'
  order by created_at desc limit 1;
  if recent is not null then
    update public.crowd_reports set level = p_level, created_at = now() where id = recent;
  else
    insert into public.crowd_reports (place_id, user_id, level) values (p_place_id, uid, p_level);
  end if;
  return public.crowd_status(p_place_id);
end $$;
revoke all on function public.report_crowd(uuid, text) from public, anon;
grant execute on function public.report_crowd(uuid, text) to authenticated;

-- Stand van de laatste 3 uur: aantal per niveau, het laatste tijdstip en het niveau van de meest recente meldingen
-- (gewogen: een melding van nu telt zwaarder dan een van 2 uur geleden). Geen persoonsgegevens.
create or replace function public.crowd_status(p_place_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with recent as (
    select level, created_at, greatest(0.1, 1 - extract(epoch from now() - created_at) / 10800.0) as w
    from public.crowd_reports
    where place_id = p_place_id and created_at > now() - interval '3 hours'
  ), score as (
    select level, sum(w) as s from recent group by level
  )
  select jsonb_build_object(
    'reports', (select count(*) from recent),
    'last_at', (select max(created_at) from recent),
    'counts', coalesce((select jsonb_object_agg(level, n) from (select level, count(*) as n from recent group by level) c), '{}'::jsonb),
    'level', (select level from score order by s desc, case level when 'vol' then 0 when 'druk' then 1 else 2 end limit 1)
  );
$$;
grant execute on function public.crowd_status(uuid) to anon, authenticated;

-- Meldingen ouder dan 30 dagen zijn niet meer nodig (ook niet voor statistiek)
select cron.schedule('crowd-retention', '17 3 * * *', $$delete from public.crowd_reports where created_at < now() - interval '30 days'$$);
