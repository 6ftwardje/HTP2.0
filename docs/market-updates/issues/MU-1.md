## Prompt voor uitvoerder

Implementeer de additieve basis voor `video`, `chart` en `text` in `weekly_updates`. Werk op een eigen branch vanaf de actuele basis. Zet dit issue **voor de eerste codewijziging** op `status:in-progress`. Raak de bestaande transcriptiebranch en bestaande video-assets niet aan.

Voeg een migratie toe met `content_format` (default `video`), `body` en chartafbeeldingspaden. Maak de relevante TypeScript-types compleet. Houd oude videorijen leesbaar, dezelfde IDs/slugs en dezelfde RLS. Geen bestaande kolommen verwijderen of hernoemen. Leg de keuze voor maximale lengte/aantal beelden vast.

## Acceptatie

- Alle bestaande rijen blijven `video`; nieuwe velden zijn additief.
- Databaseconstraints weren onbekende formats, te veel afbeeldingen en ongeldige publiceerbare formatcombinaties zonder legacyvideo's te breken.
- Een rollback is beschreven; geen destructieve datamigratie.
- Typecheck en relevante tests slagen.

Afhankelijkheden: geen. Volgende stap: MU-2 en MU-3.
