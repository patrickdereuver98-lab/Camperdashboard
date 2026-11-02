-- Vervolg op README 95: het bronnenonderzoek zet een vertrektijd als {"veld": "vertrektijd", "voorstel": "vast, uiterlijk
-- 12:00"} in submissions. De trigger nam `vertrektijd` letterlijk over als veld in updates_queue, maar places kent dat
-- veld niet, dus Accepteren gaf "Veld vertrektijd kan niet via de inbox worden aangepast". Nu wordt zo'n voorstel net
-- als Doe mee gesplitst in `departure` (vrij, per24, vast) en `checkout_until` (HH:MM). Andere velden komen alleen in
-- de wachtrij als accepteren ze aankan (private.queue_fields); de rest blijft in Inzendingen.

create or replace function private.queue_from_submission(s public.submissions) returns integer
 language plpgsql security definer set search_path to ''
as $$
declare
  cur jsonb;
  n integer := 0;
  k text;
  v jsonb;
  v_kind text;
  v_raw text;
  v_time text;
  v_parts text[];
  v_text text;
begin
  if s.place_id is null or s.kind <> 'correctie' then return 0; end if;
  select to_jsonb(p) into cur from public.places p where p.id = s.place_id;
  if cur is null then return 0; end if;

  if jsonb_typeof(s.payload -> 'voorzieningen') = 'object' then
    for k, v in select * from jsonb_each(s.payload -> 'voorzieningen') loop
      continue when not (k = any (private.queue_fields())) or not (v ? 'nieuw');
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, submission_id, user_id)
      values (s.place_id, k, cur -> k, v -> 'nieuw', s.id, s.user_id)
      on conflict (submission_id, field_changed) do nothing;
      n := n + 1;
    end loop;
  elsif s.payload ->> 'veld' = any (private.queue_fields()) and s.payload ? 'voorstel' then
    -- Alleen velden die accepteren ook aankan; de rest blijft alleen in Inzendingen
    insert into public.updates_queue (place_id, field_changed, old_value, new_value, submission_id, user_id)
    values (s.place_id, s.payload ->> 'veld', cur -> (s.payload ->> 'veld'), s.payload -> 'voorstel', s.id, s.user_id)
    on conflict (submission_id, field_changed) do nothing;
    n := 1;
  elsif s.payload ->> 'onderwerp' = 'vertrektijd'
        or (s.payload ->> 'veld' = 'vertrektijd' and jsonb_typeof(s.payload -> 'voorstel') = 'string') then
    if s.payload ->> 'onderwerp' = 'vertrektijd' then
      v_raw := trim(coalesce(s.payload ->> 'vertrek_uiterlijk', ''));
      v_kind := s.payload ->> 'vertrek';
    else
      -- Voorstel uit het bronnenonderzoek als tekst: "vast, uiterlijk 12:00", "vrij", "per 24 uur"
      v_text := lower(trim(s.payload ->> 'voorstel'));
      v_raw := coalesce(substring(v_text from '([0-9]{1,2}[:.][0-9]{2})'), '');
      v_kind := case
        when v_text ~ 'per ?24' then 'per24'
        when v_text ~ '^(vrij|geen vaste)' then 'vrij'
        when v_text ~ '^vast' or v_raw <> '' then 'vast'
      end;
    end if;
    -- "9:30", "09.30" en "11:00" worden "09:30" en "11:00"; iets anders is geen tijd
    v_parts := regexp_match(v_raw, '^([01]?[0-9]|2[0-3])[:.]([0-5][0-9])$');
    if v_parts is not null then v_time := lpad(v_parts[1], 2, '0') || ':' || v_parts[2]; end if;
    -- Oude inzendingen zonder `vertrek` maar met een tijd: vaste vertrektijd
    if v_kind is null and v_time is not null then v_kind := 'vast'; end if;
    if v_kind is null or v_kind not in ('vrij', 'per24', 'vast') or (v_kind = 'vast' and v_time is null) then return 0; end if;

    if cur ->> 'departure' is distinct from v_kind then
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, submission_id, user_id)
      values (s.place_id, 'departure', cur -> 'departure', to_jsonb(v_kind), s.id, s.user_id)
      on conflict (submission_id, field_changed) do nothing;
      n := n + 1;
    end if;
    -- Vast: de tijd; vrij of per 24 uur: een oude tijd gaat weg
    if (v_kind = 'vast' and cur ->> 'checkout_until' is distinct from v_time)
       or (v_kind <> 'vast' and cur ->> 'checkout_until' is not null) then
      insert into public.updates_queue (place_id, field_changed, old_value, new_value, submission_id, user_id)
      values (s.place_id, 'checkout_until', cur -> 'checkout_until', coalesce(to_jsonb(v_time), 'null'::jsonb), s.id, s.user_id)
      on conflict (submission_id, field_changed) do nothing;
      n := n + 1;
    end if;
  end if;
  return n;
end $$;
revoke all on function private.queue_from_submission(public.submissions) from public, anon, authenticated;

-- Open rijen met een veld dat accepteren niet aankan weghalen en de inzending opnieuw in de wachtrij zetten
do $$
declare ids uuid[];
begin
  with bad as (
    delete from public.updates_queue
     where status = 'pending' and submission_id is not null and not (field_changed = any (private.queue_fields()))
    returning submission_id)
  select array_agg(distinct submission_id) into ids from bad;
  perform private.queue_from_submission(s) from public.submissions s where s.id = any (coalesce(ids, '{}'));
end $$;
