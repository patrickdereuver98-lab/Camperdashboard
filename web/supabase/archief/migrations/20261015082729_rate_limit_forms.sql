-- Live migratie 20261015082729 (rate_limit_forms), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

create or replace function public.submit_place(p_kind text, p_place_id uuid, p_payload jsonb, p_contact_name text, p_contact_email text)
 returns uuid language plpgsql security definer set search_path to ''
as $$
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
  insert into public.submissions (kind, place_id, payload, contact_name, contact_email)
  values (p_kind, p_place_id, p_payload, nullif(trim(p_contact_name), ''), nullif(trim(p_contact_email), ''))
  returning id into sid;
  perform private.log('info', 'inzending', 'Nieuwe inzending: ' || p_kind, jsonb_build_object('id', sid));
  return sid;
end $$;

create or replace function public.create_ticket(p_name text, p_email text, p_subject text, p_category text, p_body text, p_place_id uuid default null)
 returns table(number bigint, access_token text) language plpgsql security definer set search_path to ''
as $$
declare t public.tickets;
begin
  if (select count(*) from public.tickets where lower(email) = lower(p_email) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Je hebt al een aantal berichten gestuurd. We nemen zo snel mogelijk contact op.';
  end if;
  if char_length(coalesce(p_body, '')) < 10 then
    raise exception 'Je bericht is te kort.';
  end if;
  if char_length(p_body) > 5000 then
    raise exception 'Je bericht is te lang. Houd het onder de 5.000 tekens.';
  end if;
  if not private.rate_take('ticket:uur', 30, interval '1 hour')
     or not private.rate_take('ticket:dag', 150, interval '1 day') then
    raise exception 'Het is even erg druk. Probeer het later opnieuw of mail ons.';
  end if;
  insert into public.tickets (name, email, subject, category, place_id)
  values (trim(p_name), trim(p_email), trim(p_subject), coalesce(p_category, 'vraag'), p_place_id)
  returning * into t;
  insert into public.ticket_messages (ticket_id, author, body) values (t.id, 'klant', trim(p_body));
  insert into public.events (name, props) values ('ticket', jsonb_build_object('category', t.category));
  perform private.log('info', 'support', 'Nieuw ticket #' || t.number, jsonb_build_object('category', t.category));
  return query select t.number, t.access_token;
end $$;

create or replace function public.submit_review(p_place_id uuid, p_author_name text, p_author_email text, p_rating integer,
  p_score_location integer, p_score_quiet integer, p_score_facilities integer, p_score_value integer, p_title text,
  p_body text, p_vehicle text, p_visited_month date)
 returns uuid language plpgsql security definer set search_path to ''
as $$
declare rid uuid;
begin
  if not exists (select 1 from public.places where id = p_place_id and status = 'published') then
    raise exception 'Onbekende plek';
  end if;
  if p_author_email is not null and (
    select count(*) from public.reviews where lower(author_email) = lower(p_author_email) and created_at > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'Te veel reviews in korte tijd. Probeer het later opnieuw.';
  end if;
  if not private.rate_take('review:' || p_place_id, 5, interval '1 hour')
     or not private.rate_take('review:dag', 400, interval '1 day') then
    raise exception 'Het is even erg druk. Probeer het later opnieuw.';
  end if;
  insert into public.reviews (place_id, author_name, author_email, rating, score_location, score_quiet,
    score_facilities, score_value, title, body, vehicle, visited_month)
  values (p_place_id, trim(p_author_name), nullif(trim(p_author_email), ''), p_rating, p_score_location, p_score_quiet,
    p_score_facilities, p_score_value, nullif(trim(p_title), ''), trim(p_body), p_vehicle, p_visited_month)
  returning id into rid;
  insert into public.events (name, props) values ('review', jsonb_build_object('place_id', p_place_id));
  return rid;
end $$;
