# Project Speed — stap 07: notification shell readmodel

Datum: 24 juli 2026

## Hypothese

Iedere protected route wacht in de layout op twee losse notificationrequests:
één exact unread count en één lijst met maximaal vijftig notificaties waarvan de
shell er acht gebruikt. Eén smalle readfunctie kan dezelfde shellinformatie in
één netwerkroundtrip leveren.

## Architectuur en trust model

`public.get_my_notification_shell()`:

- accepteert geen student-id of andere parameters;
- bepaalt de student uitsluitend met `auth.uid()`;
- is `security invoker` en `stable`;
- behoudt RLS op recipients en events;
- retourneert exact unread count en maximaal acht recente niet-gearchiveerde
  notificaties;
- heeft execute voor `authenticated` en `service_role`, niet voor `anon` of
  `public`.

`PROJECT_SPEED_NOTIFICATION_SHELL=1` selecteert het readmodel. Bij ontbrekende,
ongeldige of student-mismatched data valt de layout terug op beide legacyreads.
De flag is build-deterministisch en standaard uit.

## A/B-status

Uitgevoerd in production op commit `db98d9d`, telkens met tien verse
browsercontexten per route en Netlify Functions in London (`lhr`):

| Variant | Deploy | Dashboard TTFB p50/p95 | Dashboard LCP p50/p95 | Modules TTFB p50/p95 | Weekly TTFB p50/p95 |
| --- | --- | ---: | ---: | ---: | ---: |
| Legacy A (`0`) | `6a636a7c6d677a0009352cce` | 656 / 1.309 ms | 1.584 / 2.432 ms | 532 / 3.510 ms | 572 / 793 ms |
| Readmodel (`1`) | `6a636b850f70c27788a9cd9a` | 648 / 1.342 ms | 1.748 / 2.312 ms | 551 / 2.980 ms | 542 / 850 ms |
| Legacy B (`0`) | `6a636c802fb19f510efe4025` | 533 / 1.093 ms | 1.476 / 2.032 ms | 542 / 650 ms | 513 / 1.543 ms |

De readmodelvariant reduceerde één database-roundtrip, maar gaf geen
reproduceerbare eindgebruikerswinst. Dashboard-LCP p50 werd tegenover beide
legacy-runs slechter en de p95-verschillen vielen binnen de aanzienlijke
productievariatie die ook tussen Legacy A en B zichtbaar was. Transfergrootte
en browserrequestaantal bleven praktisch gelijk, zoals verwacht voor
server-side reads.

Alle authenticated routes behielden stabiele content, HTTP 200, nul
consolefouten en CLS 0. Forged identityheaders werden in alle varianten naar de
login geweigerd. De RPC gaf zonder sessie HTTP 401; de authenticated test gaf
dezelfde unread count en notification-idset als legacy.

## Besluit

`PROJECT_SPEED_NOTIFICATION_SHELL=0` blijft de geselecteerde productionstand.
De veilige readmodelimplementatie blijft achter de build-deterministische flag
beschikbaar voor een toekomstige herhaling met meer notificatiedata of
server-side tracing, maar wordt zonder aantoonbare winst niet geactiveerd.
