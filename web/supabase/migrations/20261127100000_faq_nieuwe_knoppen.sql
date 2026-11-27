-- UX-audit 27 november 2026 (README 145): de plekpagina heeft geen knop "Klopt er iets niet?" meer. Onderaan staan
-- "Gegevens corrigeren of aanvullen" (iedereen) en het blok "Eigenaar van deze plek?" met "Gegevens aanpassen".
-- Pas toepassen nadat de code van PR #202 live staat, anders verwijst de FAQ naar knoppen die er nog niet zijn.
update public.faq
set answer = 'Ga naar de pagina van je plek. Onderaan staat "Eigenaar van deze plek?" met de knop "Gegevens aanpassen". Je kunt ook naar "Plek aanmelden" gaan en "Ik ben eigenaar" kiezen. We controleren je wijziging en verwerken hem meestal binnen twee werkdagen.'
where question = 'Ik ben eigenaar van een camperplaats. Hoe pas ik mijn gegevens aan?'
  and answer like '%Klopt er iets niet?%';

update public.faq
set answer = replace(answer, 'of tik op "Klopt er iets niet?" op de pagina van je plek', 'of tik op "Gegevens aanpassen" onderaan de pagina van je plek')
where question = 'Hoe claim, verbeter of verwijder ik mijn plek?'
  and answer like '%Klopt er iets niet?%';

update public.faq
set answer = replace(answer, 'tik dan op "Klopt er iets niet?" op de pagina van de plek', 'tik dan op "Gegevens corrigeren of aanvullen" onderaan de pagina van de plek')
where question = 'Hoe meld ik foute of illegale inhoud?'
  and answer like '%Klopt er iets niet?%';
