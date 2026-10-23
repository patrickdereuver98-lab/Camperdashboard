-- Adressen aanvullen via de PDOK Locatieserver (besluit eigenaar 18 oktober 2026). De edge function `pipeline`
-- (actie "adres", pdok.ts) zoekt per plek het dichtstbijzijnde BAG-adres binnen 75 m en legt het vast met apply_pdok.
-- Alleen lege velden worden gevuld, nooit wat Beheer heeft vastgezet. Een postcode bij een bestaande straat alleen als
-- PDOK dezelfde straat geeft. sources.pdok bewaart tijdstip en afstand (ook als er niets binnen 75 m lag), zodat elke
-- plek één keer wordt opgezocht.

create or replace function public.next_pdok_batch(p_limit integer)
 returns table(id uuid, lat double precision, lng double precision)
 language sql
 security definer
 set search_path to ''
as $function$
  select p.id, p.lat, p.lng from public.places p
   where p.merged_into is null and (p.street is null or p.postcode is null)
     and not (coalesce(p.sources, '{}'::jsonb) ? 'pdok')
   order by random()
   limit least(p_limit, 50);
$function$;

create or replace function public.apply_pdok(p_id uuid, p_street text, p_postcode text, p_afstand integer)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  p public.places;
  beheer jsonb;
  new_street text;
  new_postcode text;
begin
  select * into p from public.places where id = p_id for update;
  if not found then return; end if;
  beheer := coalesce(p.sources->'beheer', '[]'::jsonb);
  new_street := p.street;
  new_postcode := p.postcode;
  if p_street is not null then
    if p.street is null and not (beheer ? 'street') then
      new_street := p_street;
      if p.postcode is null and not (beheer ? 'postcode') then new_postcode := p_postcode; end if;
    elsif p.postcode is null and not (beheer ? 'postcode') and lower(p.street) = lower(p_street) then
      new_postcode := p_postcode;
    end if;
  end if;
  update public.places
     set street = new_street,
         postcode = new_postcode,
         sources = coalesce(sources, '{}'::jsonb) || jsonb_build_object('pdok', jsonb_build_object(
           'at', now(), 'afstand', p_afstand,
           'velden', to_jsonb(array_remove(array[
             case when new_street is distinct from p.street then 'street' end,
             case when new_postcode is distinct from p.postcode then 'postcode' end], null))))
   where id = p_id;
end $function$;

revoke all on function public.next_pdok_batch(integer) from public, anon, authenticated;
revoke all on function public.apply_pdok(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.next_pdok_batch(integer) to service_role;
grant execute on function public.apply_pdok(uuid, text, text, integer) to service_role;

-- Elke minuut 40 plekken, zolang er nog plekken zonder adres en zonder PDOK-poging zijn (±1.800 → ±45 minuten)
select cron.schedule('pdok-adres', '* * * * *', $$
  select private.call_pipeline('{"action":"adres","n":40,"background":true}'::jsonb)
   where exists (select 1 from public.places where merged_into is null and (street is null or postcode is null)
                  and not (coalesce(sources, '{}'::jsonb) ? 'pdok'))
$$);
