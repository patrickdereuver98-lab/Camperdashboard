-- Herstel: het patroon {10,300} in place_google.google_place_id is ongeldig in Postgres (hoogstens 255 herhalingen),
-- waardoor elke insert faalde. Een Google place_id is ruim onder 200 tekens.
alter table public.place_google drop constraint if exists place_google_google_place_id_check;
alter table public.place_google add constraint place_google_google_place_id_check
  check (google_place_id ~ '^[A-Za-z0-9_-]{10,200}$');
