-- Beoordeling van de concepten uit Google-kandidaten (README 141, 22 november 2026, opdracht Patrick: "oordeel zelf").
-- Herhaalbaar: pakt alleen voorstellen van de AI-lezer bij concepten (places.sources ? 'google') die nog open staan.
--   web/scripts/sql.sh -f web/scripts/google-beoordeel-concepten.sql
-- Regels:
--  1. Vertrek, aankomst, lengte en verblijfsduur: accepteren als het citaat over dat onderwerp gaat (de AI-lezer heeft het
--     citaat al letterlijk gecontroleerd).
--  2. Prijs: alleen een duidelijke nachtprijs, zonder seizoenstarief, tent, kind, huisdier, extra persoon of andere activiteit.
--  3. Publiceren: een concept komt vrij als vertrek bekend is (uit de eigen website), de plek bij Google in bedrijf is, de
--     websitetekst camper, kampeerauto of motorhome noemt en de kernregels van places (place_meets_must_haves) kloppen.
--     Het vertrek krijgt GEEN merkteken "bevestigd door beheer": dat blijft voor een mens of de eigenaar.
do $$
declare
  q record; rec public.places; n_acc int := 0; n_skip int := 0; n_pub int := 0; pr record;
begin
  perform set_config('vrijstaan.bron', 'website', true);
  for q in
    select u.*, p.name from public.updates_queue u join public.places p on p.id = u.place_id
     where p.sources ? 'google' and u.source = 'ai-lezer' and u.status = 'pending'
       and u.field_changed in ('departure', 'checkout_until', 'checkin_from', 'checkin_until', 'max_length_m', 'max_stay_nights', 'price_eur')
     order by (u.field_changed = 'departure') desc, u.id
     for update of u
  loop
    if not (
         (q.field_changed in ('departure', 'checkout_until') and q.quote ~* '(vertrek|uitcheck|check-?out|verlaten|eindtijd)')
      or (q.field_changed in ('checkin_from', 'checkin_until') and q.quote ~* '(aankom|incheck|check-?in)')
      or (q.field_changed = 'max_length_m' and q.quote ~* '(meter|\d\s?m\M)' )
      or (q.field_changed = 'max_stay_nights' and q.quote ~* '(nacht|nachten|dagen)')
      or (q.field_changed = 'price_eur' and q.quote ~* 'nacht' and q.quote ~* '(camper|staanplaats|plaats)'
          and q.quote !~* '(laagseizoen|hoogseizoen|oktober|november|december|januari|februari|maart|kind|huisdier|vissen|tent|vouwwagen|elektra|extra persoon|per persoon|hond|2 personen|twee personen|vanaf)')
    ) then
      n_skip := n_skip + 1;
      continue;
    end if;
    rec := jsonb_populate_record(null::public.places, jsonb_build_object(q.field_changed, q.new_value));
    execute format('update public.places set %1$I = ($1).%1$I where id = $2', q.field_changed) using rec, q.place_id;
    update public.updates_queue set status = 'approved', decided_at = now() where id = q.id;
    insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
    values (null, 'ai-lezer (beoordeeld door agent)', 'update_accepted', 'places', q.place_id::text,
            jsonb_build_object('veld', q.field_changed, 'nieuw', q.new_value, 'update', q.id, 'bron', q.source, 'citaat', q.quote,
                               'reden', 'Letterlijk citaat van de eigen website, onderwerp gecontroleerd'));
    n_acc := n_acc + 1;
  end loop;

  -- Vrijgeven: alleen met vertrek uit de eigen website, in bedrijf bij Google en camper op de site genoemd
  for pr in
    select pl.id, pl.name from public.places pl
      left join private.page_texts t on t.place_id = pl.id
      left join private.google_found f on f.google_place_id = pl.sources -> 'google' ->> 'place_id'
     where pl.sources ? 'google' and pl.status = 'draft' and pl.status_locked
       and pl.departure is not null and pl.website is not null
       and f.business_status is not distinct from 'OPERATIONAL'
       and t.text ~* '(camper|kampeerauto|motorhome)'
  loop
    update public.places set status_locked = false where id = pr.id;
    if (select status from public.places where id = pr.id) = 'published' then
      n_pub := n_pub + 1;
      insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
      values (null, 'agent (beoordeeld)', 'update', 'places', pr.id::text,
              jsonb_build_object('veld', 'status', 'was', 'draft', 'nieuw', 'published',
                                 'reden', 'Concept uit Google: eigen website geeft de vertrektijd, plek in bedrijf, camper genoemd'));
    else
      update public.places set status_locked = true where id = pr.id;  -- kernregels niet gehaald: blijft vergrendeld
    end if;
  end loop;
  raise notice 'geaccepteerd % overgeslagen % vrijgegeven %', n_acc, n_skip, n_pub;
end $$;
select (select count(*) from public.places where sources ? 'google' and status = 'published') concepten_gepubliceerd,
       (select count(*) from public.places where sources ? 'google' and status = 'draft') concepten_draft,
       (select count(*) from public.places where status = 'published') gepubliceerd_totaal;
