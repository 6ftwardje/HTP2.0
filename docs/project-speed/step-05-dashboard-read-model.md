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

Nog niet geactiveerd. Eerst deployen en meten met flag uit, daarna alleen bij
stabiele content de productie-A/B uitvoeren.
