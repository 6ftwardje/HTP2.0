# Project Speed — stap 01: nulmeting en plan

Datum: 15 juli 2026

Productie-URL: `https://htp2.netlify.app`

Nulmetingcommit: `20c87c7bacfb285e82a3a9c50cb1f436d9b907ce`

## Gecontroleerde architectuur

- Next.js 15.5 App Router met React 18, server components en middleware.
- Netlify bouwt `npm run build`, publiceert `.next` en deployt `main` automatisch.
- De echte HTP2 Netlify-site is `htp2` (`8c1e7273-8140-4a47-88e7-9dbd11241229`). De bestaande lokale Netlify-link wees ten onrechte naar `coachedbycourse`; deploys moeten daarom expliciet aan de HTP2-site worden gekoppeld.
- Netlify Functions draaien in `eu-west-1`; de gekoppelde HTP2 Supabase-database draait in `eu-west-3`. Dat is een meetbaar regio-risico voor server-to-databaseverkeer, maar wordt niet zonder productie-A/B gewijzigd.
- Supabase SSR verzorgt cookies en serverclients. Middleware gebruikt `auth.getUser()` wanneer een authcookie aanwezig is en wijst protected routes zonder geverifieerde gebruiker af.
- Protected layout haalt student en notificaties server-side op. Dashboard, module- en detailroutes voeren meerdere routegerichte Supabasequeries uit, grotendeels parallel waar afhankelijkheden dat toelaten.
- Mux wordt client-side dynamisch geladen via `VimeoPlayer`; Vimeo gebruikt een iframe en laadt de Player API alleen wanneer een completion-event nodig is.
- De initiële loginroute bevat de browser-Supabase-SDK, hoewel die pas bij submit nodig is.

## Herhaalbare meetmethode

`npm run perf:baseline -- --base-url <url> --runs 10` start één Chromiumproces maar gebruikt voor ieder meetpunt een verse browsercontext. Het rapport bevat TTFB, FCP, LCP, DOMContentLoaded, load, transfer, initiële JavaScript-transfer, request count, CLS, long tasks, consolefouten en een SHA-256 van zichtbare tekst plus links. De standaardroutes zijn login en anonieme dashboard-, module- en adminrequests. Authenticated routes worden uitsluitend toegevoegd wanneer `PERF_TEST_EMAIL` en `PERF_TEST_PASSWORD` beide expliciet aanwezig zijn.

Het script is read-only. De afzonderlijke boundarycheck onderschept de authrequest lokaal en stuurt geen credentials naar Supabase.

## Productienulmeting

Tien verse contexten per route, bestaande productiecommit, flag niet aanwezig:

| Route | TTFB p50/p95 | FCP p50/p95 | LCP p50/p95 | Load p50/p95 | Transfer p50/p95 | JS p50/p95 | Requests | CLS | Console-errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Login | 467 / 1.332 ms | 1.292 / 2.616 ms | 1.292 / 2.616 ms | 1.276 / 2.593 ms | 244.150 / 244.398 B | 160.898 / 161.195 B | 13 | 0 | 0 |
| Dashboard anoniem | 194 / 695 ms | 436 / 1.504 ms | 436 / 1.504 ms | 418 / 1.478 ms | 243.994 / 244.467 B | 160.805 / 161.219 B | 13 | 0 | 0 |
| Modules anoniem | 391 / 511 ms | 1.148 / 1.324 ms | 1.148 / 1.324 ms | 1.126 / 1.308 ms | 244.154 / 244.550 B | 160.991 / 161.342 B | 13 | 0 | 0 |
| Admin anoniem | 167 / 625 ms | 380 / 1.636 ms | 380 / 1.636 ms | 360 / 1.614 ms | 243.901 / 244.576 B | 160.718 / 161.343 B | 13 | 0 | 0 |

Alle tekst/linkhashes waren binnen de tien runs stabiel. Vervalste interne userheaders gaven geen toegang en eindigden op `/?redirectedFrom=%2Fdashboard`.

## Beperkingen

Er staan geen dedicated testaccountvariabelen in de lokale of Netlify-omgeving. Er is daarom geen account aangemaakt en geen bestaande gebruiker gewijzigd. Authenticated dashboard-, lijst-, detail-, navigatie-, RLS- en mediaflowmetingen blijven verplicht voordat database- of protected-route-optimalisaties geactiveerd mogen worden.

## Gefaseerd vervolgplan op basis van de nulmeting

1. Login-SDK alleen na interactie laden, achter server-side buildflag en met legacy entrypoint.
2. Dedicated read-only testaccount configureren en serverduur per protected route/query vastleggen; daarna querywaterfalls rangschikken op productie-p95.
3. Les- en weekly-update-media vóór en na interactie meten. Alleen wanneer productie zware Mux/Vimeorequests vóór interactie toont, een poster-first player achter flag testen.
4. PostgreSQL `EXPLAIN (ANALYZE, BUFFERS)` uitvoeren op de gemeten topqueries. Alleen gerichte, idempotente index/RPC-migraties toepassen wanneer plans dat onderbouwen; RLS, `auth.uid()`, grants en anonieme directe RPC-toegang controleren.
5. Functions-regio `eu-west-1` versus database `eu-west-3` als infrastructuur-A/B uitvoeren wanneer Netlify-plan en rollback dat toelaten.

Elke fase behoudt legacy, deployt eerst met flag uit, vergelijkt dezelfde commit met flag aan en schakelt terug bij slechtere fouten, autorisatie of tail latency.
