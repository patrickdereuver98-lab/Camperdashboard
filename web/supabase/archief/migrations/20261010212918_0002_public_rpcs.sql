-- Live migratie 20261010212918 (0002_public_rpcs), letterlijk uit supabase_migrations.schema_migrations.statements
-- (opgehaald 8 november 2026, review R5). Niet wijzigen: dit is de geschiedenis zoals live toegepast.

-- Publieke schrijfacties lopen uitsluitend via deze functies (valideren + rate limit).

create or replace function private.log(p_level text, p_source text, p_message text, p_context jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.app_logs (level, source, message, context) values (p_level, p_source, left(p_message, 2000), coalesce(p_context, '{}'));
$$;

-- Review plaatsen (komt in moderatie)
create or replace function public.submit_review(
  p_place_id uuid, p_author_name text, p_author_email text, p_rating int,
  p_score_location int, p_score_quiet int, p_score_facilities int, p_score_value int,
  p_title text, p_body text, p_vehicle text, p_visited_month date
) returns uuid language plpgsql security definer set search_path = '' as $$
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
  if (select count(*) from public.reviews where created_at > now() - interval '1 minute') > 30 then
    raise exception 'Het is even erg druk. Probeer het over een minuut opnieuw.';
  end if;
  insert into public.reviews (place_id, author_name, author_email, rating, score_location, score_quiet,
    score_facilities, score_value, title, body, vehicle, visited_month)
  values (p_place_id, trim(p_author_name), nullif(trim(p_author_email), ''), p_rating, p_score_location, p_score_quiet,
    p_score_facilities, p_score_value, nullif(trim(p_title), ''), trim(p_body), p_vehicle, p_visited_month)
  returning id into rid;
  insert into public.events (name, props) values ('review', jsonb_build_object('place_id', p_place_id));
  return rid;
end;
$$;

-- Supportticket openen; geeft nummer en toegangstoken terug
create or replace function public.create_ticket(
  p_name text, p_email text, p_subject text, p_category text, p_body text, p_place_id uuid default null
) returns table (number bigint, access_token text) language plpgsql security definer set search_path = '' as $$
declare t public.tickets;
begin
  if (select count(*) from public.tickets where lower(email) = lower(p_email) and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Je hebt al een aantal berichten gestuurd. We nemen zo snel mogelijk contact op.';
  end if;
  if char_length(coalesce(p_body, '')) < 10 then
    raise exception 'Je bericht is te kort.';
  end if;
  insert into public.tickets (name, email, subject, category, place_id)
  values (trim(p_name), trim(p_email), trim(p_subject), coalesce(p_category, 'vraag'), p_place_id)
  returning * into t;
  insert into public.ticket_messages (ticket_id, author, body) values (t.id, 'klant', trim(p_body));
  insert into public.events (name, props) values ('ticket', jsonb_build_object('category', t.category));
  perform private.log('info', 'support', 'Nieuw ticket #' || t.number, jsonb_build_object('category', t.category));
  return query select t.number, t.access_token;
end;
$$;

-- Klant bekijkt eigen ticket via geheime link
create or replace function public.get_ticket(p_token text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'number', t.number, 'subject', t.subject, 'status', t.status, 'category', t.category,
    'name', t.name, 'created_at', t.created_at, 'updated_at', t.updated_at,
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object('author', m.author, 'body', m.body, 'created_at', m.created_at) order by m.created_at)
        from public.ticket_messages m where m.ticket_id = t.id and not m.internal
    ), '[]'::jsonb)
  )
  from public.tickets t where t.access_token = p_token;
$$;

create or replace function public.reply_ticket(p_token text, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare t public.tickets;
begin
  select * into t from public.tickets where access_token = p_token;
  if not found then raise exception 'Ticket niet gevonden'; end if;
  if t.status = 'gesloten' then raise exception 'Dit ticket is gesloten. Open een nieuw bericht via de contactpagina.'; end if;
  if (select count(*) from public.ticket_messages where ticket_id = t.id and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Te veel berichten in korte tijd.';
  end if;
  insert into public.ticket_messages (ticket_id, author, body) values (t.id, 'klant', trim(p_body));
  update public.tickets set status = 'open', updated_at = now() where id = t.id;
end;
$$;

-- Nieuwe plek / correctie / eigenaar
create or replace function public.submit_place(
  p_kind text, p_place_id uuid, p_payload jsonb, p_contact_name text, p_contact_email text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare sid uuid;
begin
  if pg_column_size(p_payload) > 20000 then raise exception 'Te veel gegevens'; end if;
  if p_contact_email is not null and (
    select count(*) from public.submissions where lower(contact_email) = lower(p_contact_email) and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'Te veel inzendingen in korte tijd.';
  end if;
  insert into public.submissions (kind, place_id, payload, contact_name, contact_email)
  values (p_kind, p_place_id, p_payload, nullif(trim(p_contact_name), ''), nullif(trim(p_contact_email), ''))
  returning id into sid;
  perform private.log('info', 'inzending', 'Nieuwe inzending: ' || p_kind, jsonb_build_object('id', sid));
  return sid;
end;
$$;

-- Anonieme statistiek (alleen met toestemming vanuit de client)
create or replace function public.track(p_name text, p_path text, p_props jsonb, p_session text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_name not in ('page_view','search','place_view','outbound','route','save') then return; end if;
  if pg_column_size(p_props) > 2000 then return; end if;
  insert into public.events (name, path, props, session_id) values (p_name, left(p_path, 300), coalesce(p_props, '{}'), left(p_session, 64));
end;
$$;

create or replace function public.log_consent(p_consent_id text, p_analytics boolean, p_marketing boolean, p_version text)
returns void language sql security definer set search_path = '' as $$
  insert into public.consent_log (consent_id, analytics, marketing, version)
  values (left(p_consent_id, 64), p_analytics, p_marketing, left(p_version, 20));
$$;

-- Fouten uit de frontend
create or replace function public.report_client_error(p_message text, p_context jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.app_logs where source = 'client' and ts > now() - interval '1 minute') > 60 then return; end if;
  perform private.log('error', 'client', p_message, case when pg_column_size(p_context) > 4000 then '{}'::jsonb else p_context end);
end;
$$;

-- Routecache vullen (server-side, na een geslaagde route-aanvraag)
create or replace function public.cache_route(p_key text, p_distance int, p_duration int, p_geometry jsonb, p_provider text)
returns void language sql security definer set search_path = '' as $$
  insert into public.route_cache (key, distance_m, duration_s, geometry, provider)
  values (left(p_key, 200), p_distance, p_duration, case when pg_column_size(p_geometry) > 200000 then null else p_geometry end, left(p_provider, 20))
  on conflict (key) do update set distance_m = excluded.distance_m, duration_s = excluded.duration_s,
    geometry = excluded.geometry, provider = excluded.provider, created_at = now();
$$;

-- ── Audit: admin-wijzigingen loggen ─────────────────────────────────────────
create or replace function private.audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return coalesce(new, old); end if;
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (uid, (select email from public.admins where user_id = uid), lower(tg_op), tg_table_name,
          coalesce(new.id, old.id)::text,
          case when tg_op = 'UPDATE' then
            (select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb)
               from jsonb_each(to_jsonb(new)) n
              where to_jsonb(old) -> n.key is distinct from n.value and n.key not in ('updated_at','completeness'))
          else '{}'::jsonb end);
  return coalesce(new, old);
end;
$$;

create trigger places_audit after update or delete on public.places for each row execute function private.audit();
create trigger reviews_audit after update or delete on public.reviews for each row execute function private.audit();
create trigger tickets_audit after update or delete on public.tickets for each row execute function private.audit();
create trigger faq_audit after insert or update or delete on public.faq for each row execute function private.audit();
create trigger submissions_audit after update or delete on public.submissions for each row execute function private.audit();

create or replace function private.touch_ticket()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.tickets set updated_at = now(),
    status = case when new.author = 'support' and not new.internal and status in ('open','in-behandeling') then 'wacht-op-klant' else status end
   where id = new.ticket_id;
  return new;
end;
$$;
create trigger ticket_messages_touch after insert on public.ticket_messages for each row execute function private.touch_ticket();

-- Rechten
revoke all on function public.submit_review, public.create_ticket, public.get_ticket, public.reply_ticket,
  public.submit_place, public.track, public.log_consent, public.report_client_error, public.cache_route from public;
grant execute on function public.submit_review, public.create_ticket, public.get_ticket, public.reply_ticket,
  public.submit_place, public.track, public.log_consent, public.report_client_error, public.cache_route to anon, authenticated;

-- Admin-uitnodiging voor de eigenaar
insert into private.admin_invites (email, role) values ('patrickdereuver98@gmail.com', 'admin') on conflict do nothing;
