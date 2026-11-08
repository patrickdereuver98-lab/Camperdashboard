-- Beheer → Foto's: trust-score voor alle inzenders in één verzoek, in plaats van één verzoek per inzender (N+1).
create or replace function public.user_trust_many(p_users uuid[])
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Geen toegang'; end if;
  return coalesce((select jsonb_object_agg(u, private.user_trust(u)) from (select distinct unnest(p_users[1:200]) u) s where u is not null), '{}'::jsonb);
end $$;
revoke all on function public.user_trust_many(uuid[]) from public, anon;
grant execute on function public.user_trust_many(uuid[]) to authenticated;
