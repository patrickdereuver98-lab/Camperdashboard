-- Live migratie 20261015082902 (admin_mark_beheer), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function public.admin_mark_beheer(p_place_id uuid, p_fields text[])
 returns void language plpgsql security definer set search_path to ''
as $$
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  update public.places
     set sources = jsonb_set(coalesce(sources, '{}'), '{beheer}', (
       select coalesce(jsonb_agg(f order by f), '[]'::jsonb)
         from (select jsonb_array_elements_text(coalesce(sources->'beheer', '[]')) f union select unnest(p_fields)) x))
   where id = p_place_id;
end $$;
revoke all on function public.admin_mark_beheer(uuid, text[]) from public, anon;
grant execute on function public.admin_mark_beheer(uuid, text[]) to authenticated;
