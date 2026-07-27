# Productie-cutover HTP2

## Aanbevolen strategie

Gebruik de bestaande legacy-clone als basis voor de nieuwe productieomgeving en
pas daar de HTP2-structuur additief op toe. Dit is veiliger dan alleen rijen uit
`public.students` kopiëren: een login leeft in `auth.users`, terwijl voortgang,
examens en profieldata via dezelfde UUID's gekoppeld zijn. Een restore/clone
behoudt die relaties en bestaande wachtwoorden.

De lokaal geconfigureerde non-live clone bevat op 27 juli 2026:

- 148 studenten
- 2.697 voortgangsregels
- 749 examenresultaten
- 12 modules en 54 lessen

Voer geen bridge of migratie uit op het oude live-project.

## Fase 1 — clone gereedmaken

1. Maak eerst een nieuwe backup/snapshot van `Dashboard 2.0`.
2. Restore die backup naar het Supabase-project dat definitief `htp2` wordt.
3. Zet lokaal de drie HTP2-keys:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` en
   `SUPABASE_SERVICE_ROLE_KEY`.
4. Draai `npm run verify:supabase-target`. Stop bij echte dubbele
   modulevolgordes, lesvolgordes, examens of voortgang.
5. Draai `supabase/legacy-clone/01_prepare_legacy_schema_for_2.sql`.
6. Pas daarna alle nieuwere bestanden uit `supabase/migrations` in
   chronologische volgorde toe.
7. Draai `supabase/legacy-clone/02_verify_bridge.sql` en vergelijk aantallen met
   de snapshot.

## Fase 2 — acceptatietest

Test met minstens drie accounts:

- bestaand account met voortgang en geslaagd examen;
- bestaand account zonder voortgang;
- nieuw geregistreerd account.

Controleer registratie, e-mailbevestiging, login, wachtwoordreset, intake,
opeenvolgende lesson locking, examenlocking, een onvoldoende, een voldoende,
module-unlock, logout en opnieuw inloggen.

## Fase 3 — korte onderhoudsstop en delta

Omdat gebruikers tussen de eerste clone en livegang nog voortgang kunnen maken,
is een finale delta nodig. De eenvoudigste en veiligste variant is:

1. Zet het oude platform kort in onderhoudsmodus.
2. Maak een finale backup.
3. Restore opnieuw naar HTP2 en herhaal de reeds geteste bridge/migraties.
4. Vergelijk de aantallen en voer de smoke test opnieuw uit.

Vermijd een losse CSV-import van users. Die neemt authenticatie, wachtwoorden,
UUID-koppelingen en referentiële integriteit niet betrouwbaar mee.

## Netlify en Supabase vóór DNS

Zet in de Netlify productieomgeving:

- `NEXT_PUBLIC_SUPABASE_URL` naar HTP2;
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` naar HTP2;
- `SUPABASE_SERVICE_ROLE_KEY` alleen als serverfuncties die werkelijk nodig
  hebben;
- `NEXT_PUBLIC_SITE_URL=https://hettradeplatform.be`;
- overige Mux/Anthropic-secrets.

Voeg in Supabase Auth toe:

- Site URL: `https://hettradeplatform.be`
- Redirect URL: `https://hettradeplatform.be/auth/callback`
- Redirect URL: `https://hettradeplatform.be/account/update-password`

Maak eerst een Netlify previewdeploy en test die met de HTP2-database. Publiceer
pas daarna dezelfde geteste commit naar productie.

## DNS in Combell

Vraag Netlify bij **Domain management → Add domain alias** om
`hettradeplatform.be` en bij voorkeur `www.hettradeplatform.be` aan het project
`htp2` te koppelen. Netlify toont vervolgens de exacte DNS-doelen voor dit
project.

Pas daarna in Combell uitsluitend de getoonde records aan. Verlaag de TTL bij
voorkeur 24 uur vooraf. Leg de oude waarden vast voor rollback. Verwijder geen
mailrecords (MX, SPF, DKIM of DMARC).

Na propagatie:

- controleer TLS/certificaatstatus in Netlify;
- test apex en `www`;
- test auth-callbacks en wachtwoordreset;
- controleer serverlogs en Supabase Auth logs;
- houd de oude omgeving en backup beschikbaar voor rollback.
