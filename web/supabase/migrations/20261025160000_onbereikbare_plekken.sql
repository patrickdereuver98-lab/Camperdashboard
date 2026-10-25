-- Onbereikbare plekken opruimen (besluit eigenaar 25 oktober 2026: "plekken waar we niet bij kunnen moeten uit de
-- database; als we niets weten hebben we er ook niets aan").
--
-- Een plek gaat weg als we er niets over weten en er ook niet meer bij kunnen:
--   - niet gepubliceerd, niet vastgezet (status_locked) en geen velden van Beheer;
--   - geen prijs en geen vertrektijd;
--   - geen website, of een website die ook de stealth-lezer na drie pogingen niet kon lezen (sources.stealth.error).
-- Gepubliceerde plekken blijven altijd staan.
--
-- OpenStreetMap zou zo'n plek bij de volgende ronde opnieuw toevoegen (ingest_osm herkent plekken aan osm_type en
-- osm_id). Daarom komt elke verwijderde plek met al zijn gegevens in private.verwijderde_plekken, en houdt een trigger
-- nieuwe rijen met hetzelfde OSM-nummer tegen. Terugzetten: de rij uit die tabel verwijderen en de plek met de
-- bewaarde gegevens opnieuw invoegen.

create table if not exists private.verwijderde_plekken (
  id uuid primary key,
  osm_type text,
  osm_id bigint,
  slug text,
  name text,
  website text,
  reden text not null,
  gegevens jsonb not null,
  removed_at timestamptz not null default now()
);
create unique index if not exists verwijderde_plekken_osm on private.verwijderde_plekken (osm_type, osm_id)
  where osm_id is not null;
alter table private.verwijderde_plekken enable row level security;

-- OSM-import: een verwijderde plek niet opnieuw toevoegen
create or replace function private.weiger_verwijderde_plek()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.osm_id is not null and exists (
    select 1 from private.verwijderde_plekken v where v.osm_type = new.osm_type and v.osm_id = new.osm_id
  ) then
    return null;
  end if;
  return new;
end $$;

drop trigger if exists weiger_verwijderde_plek on public.places;
create trigger weiger_verwijderde_plek before insert on public.places
  for each row execute function private.weiger_verwijderde_plek();

-- Opruimen; met p_proef = true alleen tellen
create or replace function private.verwijder_onbereikbare_plekken(p_proef boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  n_geen_site int;
  n_dood int;
begin
  drop table if exists _weg;
  create temp table _weg on commit drop as
  select p.*,
         case when p.website is null then 'geen website'
              else 'website onleesbaar, ook met stealth: ' || left(p.sources->'stealth'->>'error', 120) end as reden
    from public.places p
   where p.merged_into is null
     and p.status <> 'published'
     and not p.status_locked
     and p.price_eur is null
     and p.departure is null
     and not (jsonb_typeof(p.sources->'beheer') = 'array' and jsonb_array_length(p.sources->'beheer') > 0)
     and not (jsonb_typeof(p.sources->'beheer') = 'object' and p.sources->'beheer' <> '{}'::jsonb)
     and not exists (select 1 from public.places m where m.merged_into = p.id)
     and (p.website is null
          or (p.sources->'stealth' ? 'error'
              and not exists (select 1 from private.stealth_queue q where q.place_id = p.id and q.done_at is null)));

  select count(*) filter (where website is null), count(*) filter (where website is not null)
    into n_geen_site, n_dood from _weg;

  if not p_proef then
    insert into private.verwijderde_plekken (id, osm_type, osm_id, slug, name, website, reden, gegevens)
    select w.id, w.osm_type, w.osm_id, w.slug, w.name, w.website, w.reden, to_jsonb(w) - 'reden' - 'geom'
      from _weg w
    on conflict (id) do nothing;
    delete from public.places p using _weg w where p.id = w.id;
  end if;

  return jsonb_build_object('proef', p_proef, 'geen_website', n_geen_site, 'website_dood', n_dood);
end $$;

revoke all on function private.verwijder_onbereikbare_plekken(boolean) from public, anon, authenticated;
revoke all on function private.weiger_verwijderde_plek() from public, anon, authenticated;

-- Elke dag na de stealth-lezer en de wachtrij (05:23): plekken die intussen definitief onbereikbaar bleken
do $$
begin
  if exists (select 1 from cron.job where jobname = 'onbereikbaar-opruimen') then
    perform cron.unschedule('onbereikbaar-opruimen');
  end if;
  perform cron.schedule('onbereikbaar-opruimen', '13 6 * * *', $cmd$select private.verwijder_onbereikbare_plekken(false)$cmd$);
end $$;
