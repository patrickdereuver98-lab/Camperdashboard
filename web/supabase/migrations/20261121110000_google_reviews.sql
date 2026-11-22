-- Google-reviews voor intern gebruik (besluit Patrick, 21 november 2026, README 141): de reviews die de Places API per
-- plek teruggeeft (hoogstens vijf), bewaard om onze eigen gegevens te scannen en te vergelijken (vertrektijd, prijs,
-- gesloten). We vragen de naam van de reviewer niet op en tonen deze teksten nooit op de site: de tabel staat in het
-- private schema, zonder leesrechten voor bezoekers. Risico staat in docs/bronnenbeleid.md §3c.
create table if not exists private.place_google_reviews (
  place_id     uuid not null references public.places (id) on delete cascade,
  review_ref   text not null check (length(review_ref) between 5 and 400),
  rating       smallint check (rating between 1 and 5),
  body         text,
  language     text,
  published_at timestamptz,
  fetched_at   timestamptz not null default now(),
  primary key (place_id, review_ref)
);

alter table private.place_google_reviews enable row level security;
revoke all on private.place_google_reviews from anon, authenticated;

create index if not exists place_google_reviews_published_idx on private.place_google_reviews (published_at desc);

comment on table private.place_google_reviews is 'Google-reviews zonder reviewernaam, alleen intern. Zie docs/bronnenbeleid.md §3c.';
