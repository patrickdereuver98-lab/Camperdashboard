// Vragen voor de analyse na de eerste Google-ronde (README 141). Alleen tellingen en plaatsnamen; geen reviewteksten.
export const QUERIES = [
  {
    title: "Dekking",
    sql: `select count(*) as "gepubliceerde plekken",
                 count(g.place_id) as "gecheckt",
                 count(g.google_place_id) as "gevonden bij Google",
                 count(g.rating) as "met cijfer",
                 round(100.0 * count(g.google_place_id) / nullif(count(g.place_id), 0), 1) as "% gevonden"
            from public.places p left join public.place_google g on g.place_id = p.id
           where p.status = 'published' and p.merged_into is null`,
  },
  {
    title: "Cijfers per soort plek (Google, schaal 1 tot 5)",
    sql: `select coalesce(p.kind, 'onbekend') as soort, count(g.rating) as "met cijfer",
                 round(avg(g.rating), 2) as gemiddelde, round(avg(g.rating_count), 1) as "gem. aantal reviews",
                 count(*) filter (where g.rating_count >= 10) as "10+ reviews"
            from public.places p join public.place_google g on g.place_id = p.id
           where g.rating is not null group by 1 order by 2 desc`,
  },
  {
    title: "Verdeling van de cijfers",
    sql: `select case when rating >= 4.5 then '4,5 en hoger' when rating >= 4 then '4,0 tot 4,5' when rating >= 3.5 then '3,5 tot 4,0'
                      when rating >= 3 then '3,0 tot 3,5' else 'onder 3,0' end as bereik, count(*) as plekken
            from public.place_google where rating is not null group by 1 order by 1`,
  },
  {
    title: "Hoogst gewaardeerd (minstens 15 reviews)",
    sql: `select p.name as plek, p.town as plaats, g.rating as cijfer, g.rating_count as reviews
            from public.place_google g join public.places p on p.id = g.place_id
           where g.rating_count >= 15 order by g.rating desc, g.rating_count desc limit 10`,
  },
  {
    title: "Laagst gewaardeerd (minstens 15 reviews)",
    sql: `select p.name as plek, p.town as plaats, g.rating as cijfer, g.rating_count as reviews
            from public.place_google g join public.places p on p.id = g.place_id
           where g.rating_count >= 15 order by g.rating asc, g.rating_count desc limit 10`,
  },
  {
    title: "Bij Google als gesloten gemarkeerd (controleer in Beheer)",
    sql: `select p.name as plek, p.town as plaats, g.business_status as status, p.status as "onze status"
            from public.place_google g join public.places p on p.id = g.place_id
           where g.business_status in ('CLOSED_PERMANENTLY', 'CLOSED_TEMPORARILY') order by 3, 1 limit 40`,
  },
  {
    title: "Onze plekken die Google niet vindt (steekproef, kan een andere naam of schrijfwijze zijn)",
    sql: `select p.name as plek, p.town as plaats, p.kind as soort, (p.website is not null) as "heeft website"
            from public.place_google g join public.places p on p.id = g.place_id
           where g.google_place_id is null order by p.name limit 25`,
  },
  {
    title: "Reviews opgeslagen",
    sql: `select count(*) as reviews, count(distinct place_id) as plekken, count(*) filter (where body is not null and length(body) > 0) as "met tekst",
                 count(*) filter (where body ~* 'vertrek|uitcheck|check[- ]?out|€|euro|per nacht|24 uur|gesloten|opgeheven|incheck|aankomst|slagboom') as "noemen vertrek, prijs of sluiting"
            from private.place_google_reviews`,
  },
  {
    title: "Kans voor de review-lezer: plekken zonder bekende vertrektijd met minstens 2 relevante reviews",
    sql: `select count(*) as plekken from (
            select p.id from public.places p join private.place_google_reviews r on r.place_id = p.id
             where p.status = 'published' and p.departure is null
               and r.body ~* 'vertrek|uitcheck|check[- ]?out|moesten.*(voor|om)|weg (voor|om)'
             group by p.id having count(*) >= 2) x`,
  },
  {
    title: "Voorstellen uit reviews (Triage Inbox)",
    sql: `select field_changed as veld, status, count(*) as voorstellen from public.updates_queue
           where source = 'google-review' group by 1, 2 order by 1, 2`,
  },
];
