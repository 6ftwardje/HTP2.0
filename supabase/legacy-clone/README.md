# Legacy Trade Platform clone naar 2.0

Gebruik deze scripts alleen op een aparte Supabase-clone van het originele
Trade Platform. Draai ze niet rechtstreeks op de live database.

## Waarom eerst clonen?

De huidige `.env.local` wijst naar het originele Supabase-project. Daardoor
werken bestaande accounts al, maar schemawijzigingen zouden ook meteen het live
platform veranderen.

De aanbevolen flow:

1. Maak via Supabase een nieuw project door een backup van het originele project
   te herstellen naar een aparte clone.
2. Vul in `.env.local` de URL, anon key en service-role key van de clone in.
3. Controleer dat de project-ref niet meer `trogwrgxxhsvixzglzpn` is.
4. Draai `01_prepare_legacy_schema_for_2.sql` in de SQL Editor van de clone.
5. Draai daarna in deze volgorde de aanvullende 2.0-migraties:
   - `../migrations/20260326000000_admin_rls_policies.sql`
   - `../migrations/20260520000000_mux_lesson_uploads.sql`
   - `../migrations/20260520010000_course_thumbnail_storage.sql`
   - `../migrations/20260601000000_lesson_actions.sql`
6. Test login, modules, lessen, voortgang, examens en admin op de clone.

## Wat de bridge doet

- Bestaande IDs blijven gelijk, zodat studenten, voortgang en examenresultaten
  gekoppeld blijven.
- De oude kolommen `"order"` en `video_url` blijven bestaan voor
  compatibiliteit.
- 2.0-kolommen zoals `slug`, `order_index`, `is_published` en timestamps worden
  additief toegevoegd en gevuld.
- Bestaande Vimeo-links blijven tijdelijk bruikbaar via `video_provider =
  'vimeo'`.
- Bestaande publieke thumbnail-URL's blijven tijdelijk bruikbaar. Nieuwe
  thumbnails kunnen later via de 2.0-admin naar `course-thumbnails`.

## Bewust nog niet gemigreerd

De oude tabel `practical_lessons` blijft onaangeraakt. Beslis later of deze
praktijkvideo's gewone 2.0-lessen worden of opnieuw een aparte sectie krijgen.

## Productie-cutover

Na acceptatie op de clone zijn er twee opties:

1. Gebruik de clone als nieuwe productieomgeving en doe vlak voor livegang een
   gecontroleerde laatste datasynchronisatie.
2. Pas dezelfde geteste additieve bridge tijdens een onderhoudsvenster toe op
   het originele project.

Optie 1 houdt de nieuwe opbouw het duidelijkst gescheiden van het bestaande
platform.
