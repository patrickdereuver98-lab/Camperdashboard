-- Live migratie 20261012133312 (website_discovery), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

-- Websites zoeken voor plekken zonder website (edge function pipeline, actie "discover").
-- Elke plek wordt één keer geprobeerd; het resultaat staat in sources->'discovery'.

create or replace function public.next_discover_batch(p_limit integer)
returns table(id uuid, name text, town text, postcode text, phone text)
language sql
security definer
set search_path to ''
as $$
  with picked as (
    select p.id from public.places p
     where p.website is null
       and p.status in ('draft', 'published')
       and coalesce(p.name_is_generic, false) = false
       and p.name is not null
       and not (coalesce(p.sources, '{}'::jsonb) ? 'discovery')
     order by p.completeness desc
     limit p_limit
     for update skip locked
  ), mark as (
    -- Meteen markeren, zodat een volgende batch dezelfde plekken niet nog eens pakt
    update public.places p set sources = coalesce(p.sources, '{}'::jsonb) || jsonb_build_object('discovery', jsonb_build_object('started', now()))
      from picked where p.id = picked.id
    returning p.id, p.name, p.town, p.postcode, p.phone
  )
  select * from mark;
$$;

create or replace function public.apply_discovery(p_id uuid, p_url text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.places
     set website = coalesce(website, p_url),
         sources = coalesce(sources, '{}'::jsonb) || jsonb_build_object('discovery', jsonb_build_object('at', now(), 'url', p_url))
   where id = p_id;
  if p_url is not null then
    insert into private.scrape_queue (place_id) values (p_id)
    on conflict (place_id) do update set done_at = null, attempts = 0, next_attempt_at = now(), last_error = null;
  end if;
end;
$$;

revoke all on function public.next_discover_batch(integer) from public, anon, authenticated;
revoke all on function public.apply_discovery(uuid, text) from public, anon, authenticated;
grant execute on function public.next_discover_batch(integer) to service_role;
grant execute on function public.apply_discovery(uuid, text) to service_role;
