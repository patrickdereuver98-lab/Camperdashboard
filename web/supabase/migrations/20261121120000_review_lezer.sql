-- Review-lezer (README 141, bronnenbeleid §3c): de Google-reviews uit private.place_google_reviews worden gelezen door
-- de edge function pipeline (actie "reviews") en worden voorstellen in de Triage Inbox (bron "google-review"), pas
-- als minstens twee verschillende reviews hetzelfde zeggen. Toepassen NA samenvoegen en uitrollen van de edge function.
alter table private.place_google_reviews
  add column if not exists analysed_at timestamptz,
  add column if not exists ai_result jsonb;

alter table public.updates_queue drop constraint if exists updates_queue_source_check;
alter table public.updates_queue add constraint updates_queue_source_check check (
  source = any (array['doe-mee', 'plekpuls', 'beheer', 'pipeline', 'eigenaar', 'mail (onbevestigd)', 'ai-lezer', 'google-review']));

-- Volgende plekken met ongelezen reviews, met al hun reviews (ook de gelezen: de samenvoeging kijkt over alle reviews)
create or replace function public.next_review_batch(p_limit integer default 3)
 returns table (place_id uuid, name text, kind text, google_place_id text, reviews jsonb)
 language sql security definer set search_path to ''
as $$
  with pick as (
    select r.place_id
      from private.place_google_reviews r
      join public.places p on p.id = r.place_id
     where r.analysed_at is null and p.merged_into is null and p.status <> 'hidden'
     group by r.place_id
     order by min(r.fetched_at)
     limit least(greatest(p_limit, 1), 20)
  )
  select p.id, p.name, p.kind, g.google_place_id,
         (select coalesce(jsonb_agg(jsonb_build_object('ref', r.review_ref, 'rating', r.rating, 'body', r.body, 'published_at', r.published_at)
                                    order by r.published_at desc nulls last), '[]'::jsonb)
            from private.place_google_reviews r where r.place_id = p.id)
    from pick
    join public.places p on p.id = pick.place_id
    left join public.place_google g on g.place_id = p.id;
$$;
revoke all on function public.next_review_batch(integer) from public, anon, authenticated;
grant execute on function public.next_review_batch(integer) to service_role;

create or replace function public.apply_review_reading(p_id uuid, p_refs text[], p_results jsonb, p_proposals jsonb)
 returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  cur jsonb;
  pr jsonb;
  f text;
  v jsonb;
  n integer := 0;
  v_reading uuid := gen_random_uuid();
  v_row public.places;
begin
  update private.place_google_reviews r
     set analysed_at = now(), ai_result = p_results -> r.review_ref
   where r.place_id = p_id and r.review_ref = any (p_refs);

  select to_jsonb(p) into cur from public.places p where p.id = p_id and p.merged_into is null and p.status <> 'hidden';
  if cur is null then return jsonb_build_object('id', p_id, 'proposals', 0); end if;

  for pr in select * from jsonb_array_elements(coalesce(p_proposals, '[]'::jsonb)) loop
    f := pr ->> 'field';
    v := pr -> 'value';
    continue when f is null or not (f = any (private.queue_fields())) or v is null or v = 'null'::jsonb;
    begin
      v_row := jsonb_populate_record(null::public.places, jsonb_build_object(f, v));
      v := to_jsonb(v_row) -> f;
    exception when others then
      continue;
    end;
    continue when v is null or v = 'null'::jsonb;
    -- Een door een mens bevestigde vertrekregel krijgt geen voorstel uit reviews
    continue when f in ('departure', 'checkout_until') and cur ->> 'departure_check' = 'bevestigd';
    continue when cur -> f = v;
    continue when exists (
      select 1 from public.updates_queue q
       where q.place_id = p_id and q.field_changed = f and q.new_value = v
         and (q.status = 'pending' or (q.source in ('ai-lezer', 'google-review') and q.status = 'rejected')));
    insert into public.updates_queue (place_id, field_changed, old_value, new_value, source, quote, source_url, reading_id)
    values (p_id, f, cur -> f, v, 'google-review', left(pr ->> 'quote', 500), left(pr ->> 'url', 500), v_reading);
    n := n + 1;
  end loop;
  return jsonb_build_object('id', p_id, 'proposals', n);
end $$;
revoke all on function public.apply_review_reading(uuid, text[], jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_review_reading(uuid, text[], jsonb, jsonb) to service_role;

-- Elke 10 minuten een paar plekken, alleen als er ongelezen reviews zijn
do $$ begin
  perform cron.unschedule('review-lezer') where exists (select 1 from cron.job where jobname = 'review-lezer');
  perform cron.schedule('review-lezer', '*/10 * * * *', $c$select private.call_pipeline('{"action":"reviews","n":5,"background":true}'::jsonb) where exists (select 1 from private.place_google_reviews r where r.analysed_at is null)$c$);
end $$;
