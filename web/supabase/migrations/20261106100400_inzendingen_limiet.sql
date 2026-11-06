-- R11 / SEC-08 (review november 2026): submit_place had één limiet voor alle bezoekers samen (60 per uur, 300 per
-- dag). Eén script, of een drukke avond met de vertrektijd-oproep, blokkeerde daarmee ook het doorgeven van
-- vertrektijden, het kernfeit. Nu:
--   * vertrektijden (Doe mee, "Weet jij de vertrektijd?", review-vraag) hebben een eigen, ruimere limiet:
--     200 per uur en 1.000 per dag;
--   * de rest houdt 60 per uur en 300 per dag;
--   * voorzieningen van één plek komen als één inzending binnen (facility-grid.tsx bundelt ze), niet één per vraag.
-- De limiet per e-mailadres (10 per uur) blijft.
--
-- Uitrollen: los van de site te doen (zelfde functie en argumenten).

create or replace function public.submit_place(p_kind text, p_place_id uuid, p_payload jsonb, p_contact_name text, p_contact_email text)
 returns uuid language plpgsql security definer set search_path to ''
as $$
declare
  sid uuid;
  v_departure boolean := coalesce(p_payload ->> 'onderwerp' = 'vertrektijd' or p_payload ->> 'veld' = 'vertrektijd', false);
begin
  if pg_column_size(p_payload) > 20000 then raise exception 'Te veel gegevens'; end if;
  if p_contact_email is not null and (
    select count(*) from public.submissions where lower(contact_email) = lower(p_contact_email) and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Te veel inzendingen in korte tijd.';
  end if;
  if v_departure then
    if not private.rate_take('submit:vertrek:uur', 200, interval '1 hour')
       or not private.rate_take('submit:vertrek:dag', 1000, interval '1 day') then
      raise exception 'Het is even erg druk. Probeer het later opnieuw.';
    end if;
  elsif not private.rate_take('submit:uur', 60, interval '1 hour')
     or not private.rate_take('submit:dag', 300, interval '1 day') then
    raise exception 'Het is even erg druk. Probeer het later opnieuw.';
  end if;
  insert into public.submissions (kind, place_id, payload, contact_name, contact_email, user_id)
  values (p_kind, p_place_id, p_payload, nullif(trim(p_contact_name), ''), nullif(trim(p_contact_email), ''), auth.uid())
  returning id into sid;
  perform private.log('info', 'inzending', 'Nieuwe inzending: ' || p_kind, jsonb_build_object('id', sid));
  return sid;
end $$;
