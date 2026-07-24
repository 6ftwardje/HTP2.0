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

De eerste twee experimentdeploys zijn ongeldig verklaard: de Netlifyflag had
eerst alleen buildscope en daarna alleen runtimescope, terwijl Next de
server→client-prop build-deterministisch maakt. De browser bleef in beide
gevallen `loading="lazy"` rapporteren. Deze reeksen tellen niet mee.

`next.config.ts` legt de niet-geheime flag nu expliciet op buildtijd vast.
Netlify bewaart de flag met scopes `builds,runtime`. De geldige experimentbrowser
rapporteert `loading="auto"` voor dezelfde hero.

## Productie-A/B

Tien verse authenticated contexten per reeks in Londen, met het actieve
dashboard-readmodel:

| Dashboardmetric | Legacy A p50/p95 | Hero priority p50/p95 | Legacy B p50/p95 |
| --- | ---: | ---: | ---: |
| TTFB | 575 / 1.819 ms | 559 / 1.342 ms | 543 / 2.870 ms |
| FCP | 676 / 1.908 ms | 640 / 1.460 ms | 604 / 2.944 ms |
| LCP | 1.652 / 2.748 ms | 1.456 / 2.312 ms | 1.568 / 4.088 ms |
| Load | 843 / 1.978 ms | 685 / 1.531 ms | 657 / 3.073 ms |
| Transfer | 326.200 / 326.578 B | 326.079 / 326.553 B | 326.468 / 326.630 B |
| Requests | 24 / 25 | 24 / 25 | 25 / 25 |

Legacy A draaide op deploy `6a63627ba3a8970008466dc2` (commit `84fe7ce`).
De geldige same-commitvergelijking draaide op commit `72ad784`: experiment
`6a6364b337f78c000858e78f`, legacy B
`6a636535b4028837e17fd7e7` en definitief experiment
`6a6365bbb5aad443a987b197`.

De experiment-LCP verbetert tegenover legacy B 7,1% op p50 en 43,4% op p95.
Transfer en request count blijven gelijk. De dashboard-mainhash was in alle
geldige samples exact `d2c977…7cd96`; consolefouten waren nul.

## Geselecteerde productiestand

`PROJECT_SPEED_DASHBOARD_HERO_PRIORITY=1`.

Slotcontrole:

- hero is niet lazy (`loading="auto"`);
- dashboard, modules en weekly updates: HTTP 200;
- forged interne headers: afgewezen;
- consolefouten: 0;
- Functions-regio: Londen (`lhr`);
- dashboard-readmodel blijft actief.

Dashboard-LCP p95 is nu 2.312 ms en voldoet aan de professionele doelgrens van
2.500 ms.

## Volgende grens

De resterende performancekandidaat is de protected layout: twee
notificationqueries blokkeren iedere protected route voordat de shell rendert.
Die reads moeten afzonderlijk worden geïnstrumenteerd en alleen achter een
rollbackbare layoutflag worden samengevoegd of uitgesteld.
