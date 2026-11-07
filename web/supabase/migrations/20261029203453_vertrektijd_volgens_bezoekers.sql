-- "Volgens n bezoekers" bij de vertrekregel (implementatieplan, besluit eigenaar 29 oktober 2026).
-- Telt alleen meldingen van ingelogde accounts (één per account), die dezelfde vertrekregel noemen als de plek nu
-- heeft en die beheer niet heeft afgewezen. Anonieme meldingen blijven gewoon inzendingen voor beheer.

-- 1. Wie meldde het: het account (als je ingelogd bent). Bij het verwijderen van een account blijft de melding staan.
alter table public.submissions add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists submissions_place_user_idx on public.submissions (place_id, user_id) where user_id is not null;

create or replace function public.submit_place(p_kind text, p_place_id uuid, p_payload jsonb, p_contact_name text, p_contact_email text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare sid uuid;
begin
  if pg_column_size(p_payload) > 20000 then raise exception 'Te veel gegevens'; end if;
  if p_contact_email is not null and (
    select count(*) from public.submissions where lower(contact_email) = lower(p_contact_email) and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Te veel inzendingen in korte tijd.';
  end if;
  if not private.rate_take('submit:uur', 60, interval '1 hour')
     or not private.rate_take('submit:dag', 300, interval '1 day') then
    raise exception 'Het is even erg druk. Probeer het later opnieuw.';
  end if;
  insert into public.submissions (kind, place_id, payload, contact_name, contact_email, user_id)
  values (p_kind, p_place_id, p_payload, nullif(trim(p_contact_name), ''), nullif(trim(p_contact_email), ''), auth.uid())
  returning id into sid;
  perform private.log('info', 'inzending', 'Nieuwe inzending: ' || p_kind, jsonb_build_object('id', sid));
  return sid;
end $function$;

-- 2. Aantal bezoekers dat de huidige vertrekregel van een gepubliceerde plek bevestigt (laatste 2 jaar)
create or replace function public.departure_visitors(p_place_id uuid)
 returns integer
 language sql
 stable
 security definer
 set search_path to ''
as $function$
  select count(distinct s.user_id)::integer
    from public.submissions s
    join public.places p on p.id = s.place_id
   where s.place_id = p_place_id
     and p.status = 'published'
     and p.departure is not null
     and s.user_id is not null
     and s.kind = 'correctie'
     and s.payload ->> 'onderwerp' = 'vertrektijd'
     and s.status <> 'afgewezen'
     and s.created_at > now() - interval '2 years'
     and s.payload ->> 'vertrek' = p.departure
     and (p.departure <> 'vast' or s.payload ->> 'vertrek_uiterlijk' = p.checkout_until);
$function$;

revoke all on function public.departure_visitors(uuid) from public;
grant execute on function public.departure_visitors(uuid) to anon, authenticated;
