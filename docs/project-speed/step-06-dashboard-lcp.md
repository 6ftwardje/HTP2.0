# Project Speed — stap 06: dashboardhero-LCP

Datum: 24 juli 2026

## Hypothese

De grote hero-afbeelding op het dashboard staat boven de vouw maar wordt als
lazy image geladen. Alleen die afbeelding prioriteit geven kan LCP verbeteren
zonder extra mediarequests voor kaarten onder de vouw.

## Productiediagnose

Vijf verse authenticated contexten met het actieve dashboard-readmodel:

- LCP-element in 5/5 runs: hero `<img>`;
- bron: `lesson-thumbnails/lesson-1.jpg`;
- gerenderd oppervlak: circa 114.249 px²;
- browserstatus: `loading="lazy"`, fetch priority `auto`;
- gemeten LCP-range: 1.788–5.880 ms.

## Architectuur en rollback

`PROJECT_SPEED_DASHBOARD_HERO_PRIORITY=1` zet uitsluitend `priority` op de
bestaande `CourseThumbnail` in de dashboardhero. Alle andere thumbnails houden
hun bestaande lazygedrag. Ontbrekend, `0` of een andere waarde behoudt legacy.

Er veranderen geen teksten, links, auth-, RLS-, query- of completionflows.
Rollback is de flag op `0` zetten en dezelfde commit opnieuw deployen.

## A/B-status

Nog uit te voeren. Vereist dezelfde productiecommit met legacy A, experiment en
legacy B; geselecteerde stand alleen bij stabiele hash en betere LCP-tail zonder
slechtere transfer/request count of fouten.
