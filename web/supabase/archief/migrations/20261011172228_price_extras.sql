-- Live migratie 20261011172228 (price_extras), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

alter table public.places add column if not exists price_extras jsonb;
comment on column public.places.price_extras is 'Toeslagen zoals de website ze noemt: [{label, amount, unit}]';
do $$ declare d text; begin
  d := pg_get_functiondef('public.apply_scrape(uuid,jsonb,text)'::regprocedure);
  d := replace(d, $x$'access_hours','access_24h','times_note'];$x$, $x$'access_hours','access_24h','times_note','price_extras'];$x$);
  d := replace(d, $x$priority text[] := array['price_eur',$x$, $x$priority text[] := array['price_extras','price_eur',$x$);
  d := replace(d, $x$access_hours = r.access_hours, access_24h = r.access_24h, times_note = r.times_note,$x$, $x$access_hours = r.access_hours, access_24h = r.access_24h, times_note = r.times_note, price_extras = r.price_extras,$x$);
  execute d;
end $$;
select position('price_extras = r.price_extras' in pg_get_functiondef('public.apply_scrape(uuid,jsonb,text)'::regprocedure)) > 0 ok;
