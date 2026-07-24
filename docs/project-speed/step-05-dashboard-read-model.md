# Project Speed — stap 05: smal dashboard-readmodel

Datum: 24 juli 2026

## Hypothese

Het dashboard doet meerdere Supabase-reads voor modules, lessen, examens,
onboarding, examenresultaten en voortgang. De dataset is klein en queryplannen
zijn niet de bottleneck; netwerkroundtrips domineren. Eén smalle, RLS-backed
readfunctie kan die reads combineren.

## Architectuur en trust model

`public.get_my_dashboard_read_model()`:

- heeft geen caller-supplied student-id;
- gebruikt uitsluitend `auth.uid()` om de student te bepalen;
- is `security invoker` en `stable`;
- behoudt RLS op alle brontabellen;
- retourneert alleen dashboardvelden;
- heeft execute voor `authenticated` en `service_role`;
- heeft geen execute voor `anon` of `public`;
- geeft zonder sessie HTTP 401.

`PROJECT_SPEED_DASHBOARD_READ_MODEL=1` selecteert de nieuwe server-read. De flag
is standaard uit. Bij een RPC-fout, ontbrekend veld of afwijkende student-id
valt de applicatie terug op de volledige legacyketen.

## Databaseverificatie

- `security_definer=false`;
- volatility `stable`;
- geen functieparameters;
- `anon execute=false`;
- `authenticated execute=true`;
- `public execute=false`;
- directe anonieme REST-call: 401;
- authenticated REST-call: 200.

Testpayload: 12 modules, 48 gepubliceerde lessen, 10 examens en alleen de
voortgang van de ingelogde teststudent.

## Lokale A/B

Vijf verse Chromiumcontexten per mode, production builds:

| Dashboardmetric | Legacy p50/p95 | Readmodel p50/p95 |
| --- | ---: | ---: |
| TTFB | 169 / 231 ms | 181 / 191 ms |
| Load | 273 / 361 ms | 297 / 796 ms |

Een readmodel-hash matchte exact met legacy; een tweede hash kwam uitsluitend in
de experimentreeks voor. De oorzaak moet vóór activatie worden vastgesteld.

## Productiestatus

Productie-A/B op commit `cf8a10638dc7e3cdea96e8b4c23a2239c63c0dbf`,
Functions-regio Londen, tien verse authenticated contexten per reeks:

| Dashboardmetric | Legacy A p50/p95 | Readmodel p50/p95 | Legacy B p50/p95 |
| --- | ---: | ---: | ---: |
| TTFB | 803 / 2.663 ms | 691 / 1.185 ms | 687 / 2.541 ms |
| FCP | 928 / 2.928 ms | 832 / 1.340 ms | 820 / 2.596 ms |
| LCP | 2.024 / 5.364 ms | 1.732 / 2.656 ms | 1.752 / 3.484 ms |
| Load | 1.112 / 4.566 ms | 986 / 1.875 ms | 1.014 / 2.694 ms |

Deploys:

- legacy A: `6a634bd76c32770008c95f4c`;
- readmodel: `6a634c7fa7bd828c2f26e294`;
- legacy B: `6a634cfbb8282fd11d619a73`;
- definitief readmodel: `6a634d96e77980f1d03f1021`.

Alle deploys waren `ready`, productiecontext, branch `main`, dezelfde commit en
Functions-regio `lhr`. De dashboard-mainhash was in alle 30 samples exact
`d2c977…7cd96`; er waren nul consolefouten.

De mediane TTFB van readmodel en legacy B is gelijkwaardig. De tail verbetert
wel reproduceerbaar: TTFB p95 −53%, FCP p95 −48%, LCP p95 −24% en load p95
−30% tegenover legacy B.

## Geselecteerde productiestand

`PROJECT_SPEED_DASHBOARD_READ_MODEL=1`.

Slotcontrole:

- dashboard, modules en weekly updates authenticated: HTTP 200;
- forged interne headers: afgewezen;
- directe anonieme RPC-call: HTTP 401;
- browserconsole-errors: 0;
- Functions-regio: Londen (`lhr`);
- lazy-auth en lazy-media blijven uit.

De migratie is gericht met `psql -v ON_ERROR_STOP=1` toegepast. De bestaande
remote Supabase migration history is aantoonbaar onvolledig en is daarom niet
met een brede `db push` of geforceerde history-reparatie gewijzigd.

## Resterende grens

TTFB p95 is nu onder de fasegrens van 1.500 ms. LCP p95 is 2.656 ms en mist de
doelgrens van 2.500 ms nog met 156 ms. De volgende fase moet daarom de
dashboard-LCP-resource en protected-layout-notificationreads meten, niet opnieuw
de al snelle PostgreSQL-plans optimaliseren.
