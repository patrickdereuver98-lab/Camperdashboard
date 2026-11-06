-- R26 / DATA-14 / ARCH-08 (review november 2026): Beheer → Inzendingen nam een vertrektijd of voorzieningen over
-- met drie losse verzoeken vanuit de browser (merkteken, plek, inzending). Ging de tweede of derde mis, dan stond de
-- plek half aangepast. De voorstellen in updates_queue (Triage Inbox) bleven op 'pending' staan, en er kwam geen
-- controledatum bij de vertrektijd.
--
-- Nu in één transactie:
--   * public.admin_take_submission(id, velden, notitie): merkteken van beheer, plek bijwerken, controledatum bij een
--     vertrekregel (zelfde regel als admin_apply_update), open voorstellen van deze inzending afhandelen (overgenomen
--     velden 'approved', de rest 'rejected') en de inzending op 'verwerkt' met de notitie;
--   * public.admin_set_submission(id, status, notitie): "Markeer als verwerkt", "Afwijzen" en "Terugzetten". Bij
--     verwerkt of afgewezen worden open voorstellen van deze inzending afgewezen, zodat ze niet in de Triage Inbox
--     blijven hangen.
--
-- Uitrollen: na het samenvoegen van de nieuwe beheerpagina (admin/inzendingen/page.tsx). De oude pagina werkt ook
-- daarna nog (hij gebruikt deze functies niet). Vereist 20261106100200 (private.mark_departure_checked).

create or replace function public.admin_take_submission(p_id uuid, p_fields jsonb, p_note text default null) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  s public.submissions;
  v_keys text[];
  v_set text;
  v_approved integer := 0;
  v_rejected integer := 0;
  v_old jsonb;
begin
  if not public.is_admin() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  select * into s from public.submissions where id = p_id for update;
  if not found then raise exception 'Onbekende inzending'; end if;
  if s.status <> 'nieuw' then raise exception 'Deze inzending is al afgehandeld'; end if;
  if s.place_id is null then raise exception 'Deze inzending hoort niet bij een plek'; end if;
  if jsonb_typeof(p_fields) <> 'object' then raise exception 'Geen velden om over te nemen' using errcode = '22023'; end if;

  -- Alleen vertrekregel en voorzieningen; elk ander veld weigeren
  select array_agg(k order by k) into v_keys from jsonb_object_keys(p_fields) k;
  if v_keys is null then raise exception 'Geen velden om over te nemen' using errcode = '22023'; end if;
  if exists (select 1 from unnest(v_keys) k
              where k not in ('departure', 'checkout_until', 'power', 'water', 'dump_station', 'toilet', 'shower', 'wifi', 'dogs')) then
    raise exception 'Deze velden kunnen niet vanuit Inzendingen worden overgenomen' using errcode = '22023';
  end if;
  if (p_fields ? 'checkout_until') and not (p_fields ? 'departure') then
    raise exception 'Een vertrektijd hoort bij een vertrekregel' using errcode = '22023';
  end if;

  select jsonb_object_agg(k, to_jsonb(p) -> k) into v_old from public.places p, unnest(v_keys) k where p.id = s.place_id;
  if v_old is null then raise exception 'Onbekende plek'; end if;

  perform public.admin_mark_beheer(s.place_id, v_keys);
  select string_agg(format('%1$I = r.%1$I', k), ', ') into v_set from unnest(v_keys) k;
  execute format('update public.places p set %s from jsonb_populate_record(null::public.places, $1) r where p.id = $2', v_set)
    using p_fields, s.place_id;
  if p_fields ? 'departure' then perform private.mark_departure_checked(s.place_id, 'beheer'); end if;

  -- Voorstellen van deze inzending in de Triage Inbox meteen afhandelen
  update public.updates_queue set status = 'approved', decided_by = auth.uid(), decided_at = now()
   where submission_id = s.id and status = 'pending' and field_changed = any (v_keys);
  get diagnostics v_approved = row_count;
  update public.updates_queue set status = 'rejected', decided_by = auth.uid(), decided_at = now()
   where submission_id = s.id and status = 'pending';
  get diagnostics v_rejected = row_count;

  update public.submissions set status = 'verwerkt', admin_note = nullif(trim(coalesce(p_note, '')), '') where id = s.id;
  insert into public.audit_log (actor, actor_email, action, entity, entity_id, details)
  values (auth.uid(), (select email from auth.users where id = auth.uid()), 'submission_taken', 'places', s.place_id::text,
          jsonb_build_object('inzending', s.id, 'was', v_old, 'nieuw', p_fields));
  return jsonb_build_object('id', s.id, 'status', 'verwerkt', 'approved', v_approved, 'rejected', v_rejected);
end $$;
revoke all on function public.admin_take_submission(uuid, jsonb, text) from public, anon;
grant execute on function public.admin_take_submission(uuid, jsonb, text) to authenticated;

create or replace function public.admin_set_submission(p_id uuid, p_status text, p_note text default null) returns jsonb
 language plpgsql security definer set search_path to ''
as $$
declare
  s public.submissions;
  v_rejected integer := 0;
begin
  if not public.is_admin() then raise exception 'Geen toegang' using errcode = '42501'; end if;
  if p_status not in ('nieuw', 'verwerkt', 'afgewezen') then raise exception 'Onbekende status' using errcode = '22023'; end if;
  update public.submissions set status = p_status, admin_note = nullif(trim(coalesce(p_note, '')), '')
   where id = p_id returning * into s;
  if not found then raise exception 'Onbekende inzending'; end if;
  if p_status <> 'nieuw' then
    update public.updates_queue set status = 'rejected', decided_by = auth.uid(), decided_at = now()
     where submission_id = s.id and status = 'pending';
    get diagnostics v_rejected = row_count;
  end if;
  return jsonb_build_object('id', s.id, 'status', s.status, 'rejected', v_rejected);
end $$;
revoke all on function public.admin_set_submission(uuid, text, text) from public, anon;
grant execute on function public.admin_set_submission(uuid, text, text) to authenticated;
