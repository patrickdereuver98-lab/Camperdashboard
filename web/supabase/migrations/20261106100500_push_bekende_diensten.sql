-- SEC-13 (review november 2026, R15): push_subscribe nam elke https-URL aan als pushadres. De edge function `push`
-- stuurt daar een POST naartoe, dus een ingelogde gebruiker kon de functie elk adres laten aanroepen. Nu alleen de
-- pushdiensten van de browsers: Google (Chrome, Android, Samsung, Opera), Mozilla (Firefox), Apple (Safari) en
-- Microsoft (Edge). Live stonden er op 6 november 2026 geen abonnementen, dus niemand valt erbuiten.
--
-- Uitrollen: los van de site te doen (zelfde functie en argumenten). Komt er een nieuwe browserdienst bij, voeg de
-- host dan hier toe.

create or replace function public.push_subscribe(p_endpoint text, p_p256dh text, p_auth text) returns void
 language plpgsql security definer set search_path to ''
as $$
begin
  if auth.uid() is null then raise exception 'Niet ingelogd'; end if;
  if p_endpoint is null or length(p_endpoint) > 1000 or length(p_p256dh) > 200 or length(p_auth) > 100
     or p_endpoint !~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/' then
    raise exception 'Ongeldig abonnement';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, disabled_at = null;
end $$;
