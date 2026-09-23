# Legacybackfill dry-run

De dry-run is strikt read-only. Hij inventariseert marktvideo's, maar maakt geen
transcript, workflow, upload of providercall aan. De adminweergave start met een
lege selectie en kan maximaal tien expliciete eligible items voor een latere,
afzonderlijk goed te keuren handeling markeren.
Een tweede expliciete bevestiging laat de server de opaque sleutels opnieuw
tegen een verse read-only inventaris controleren. Ook dit levert alleen een
voorstel op; het maakt geen job of goedkeuringsrecord aan.

## Eligibilityregels

De regels worden in deze volgorde toegepast:

1. Een bestaand `ready` transcript wordt overgeslagen als `transcript_exists`.
2. Een bestaand `pending` of `processing` transcript wordt overgeslagen als
   `transcription_in_progress`; zo kan een dubbele of rondlopende backfill niet
   worden aangeboden.
3. Een bestaand `failed` transcript wordt geblokkeerd als `previous_failure` en
   vereist eerst menselijke beoordeling.
4. Vimeo en YouTube worden geblokkeerd als `legacy_source_unavailable`. Er wordt
   niets gedownload of gescrapet.
5. Ontbrekende Mux-media, een Mux-fout en ontbrekende duur worden geblokkeerd.
   Een nog verwerkende Mux-video wordt overgeslagen.
6. Alleen een Mux-video met status `ready`, asset, playback-ID, bekende duur en
   zonder transcript is eligible.

Het rapport toont geen database-, asset-, playback- of transcript-ID's. Een
server-only HMAC levert per kandidaat een opaque selectiesleutel. Hiervoor is
`BACKFILL_DRY_RUN_SIGNING_SECRET` nodig (minimaal 32 tekens). Een selectiesleutel
is geen toestemming om de backfill uit te voeren.

## Raming

Per eligible video worden twee providerstappen geraamd: Mux-captioning en
AI-enrichment. Omdat vóór het transcript geen betrouwbare tokenraming bestaat,
rapporteert de dry-run conservatief de goedgekeurde bovengrens van EUR 2 per
video. De bestaande maandgrens van EUR 50 en pilotgrens van tien video's blijven
van kracht. Geblokkeerde en overgeslagen items tellen niet mee in de raming.

## Lokaal dry-runcommando

Gebruik uitsluitend een synthetisch JSON-catalogusbestand:

```bash
npm run transcription:backfill-dry-run -- --input ./tests/fixtures/transcription-backfill-catalog.json
```

Het commando leest alleen het opgegeven bestand en schrijft het geanonimiseerde
rapport naar stdout. De productie-inventarisatie gebeurt alleen via de
adminweergave en gebruikt een read-only `select`.
