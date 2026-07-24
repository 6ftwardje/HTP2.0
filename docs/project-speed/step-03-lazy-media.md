# Project Speed — stap 03: media na interactie

Datum: 24 juli 2026

## Hypothese

Een ingelogde weekly-update-detailpagina startte vóór gebruikersinteractie al
vier Mux-requests naar `image.mux.com` en `stream.mux.com`. Een poster-first
player kan streamverkeer uit de initiële load halen zonder completion-events of
autorisatie te wijzigen.

## Authenticated productiebaseline

Tien verse contexten op productiecommit `1a9e13c`:

| Route | TTFB p50/p95 | LCP p50/p95 | Load p50/p95 | Transfer p50/p95 | Requests p50/p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Dashboard | 1.698 / 3.498 ms | 4.736 / 6.288 ms | 4.013 / 5.556 ms | 323.546 / 326.554 B | 23 / 25 |
| Modules | 1.580 / 2.034 ms | 4.280 / 4.512 ms | 3.552 / 3.779 ms | 572.181 / 575.436 B | 32 / 34 |
| Weekly updates | 1.613 / 1.814 ms | 4.132 / 6.884 ms | 3.401 / 6.165 ms | 278.459 / 281.432 B | 21 / 23 |

Er waren geen consolefouten, CLS of long tasks. Anonieme en vervalste interne
headers werden afgewezen. De moduleshash varieerde tussen samples en moet vóór
een modulespecifieke optimalisatie worden verklaard.

## Architectuur, trust model en rollback

`PROJECT_SPEED_LAZY_MEDIA=1` vervangt tijdens de build uitsluitend het
media-entrypoint. De legacyspeler blijft volledig aanwezig. De experimentele
variant toont een Mux-poster en een toegankelijke play-control; na activatie
laadt hij dezelfde `VimeoPlayerCore`, Mux/Vimeo-integratie en `onEnded`
completion-callbacks.

Authenticatie, cookies, headers, Supabaseclients, RLS, progress-actions en
videorechten veranderen niet. De flag ontbreekt standaard of staat op `0`.
Rollback is dezelfde commit opnieuw deployen met flag `0`.

## Lokale A/B

Beide modi zijn als production build uit dezelfde bron getest met hetzelfde
dedicated account en dezelfde weekly update.

| Grens | Legacy | Experiment |
| --- | ---: | ---: |
| Mux-requests vóór interactie | 4 | 1 poster, 0 stream |
| Streamrequests vóór interactie | aanwezig | 0 |
| Stream start na klik | reeds gestart | ja |
| Tekst/linkhash | `dddd6b…51d` | exact gelijk |
| Forged headers afgewezen | ja | ja |
| Production build | geslaagd | geslaagd |

## Productie-A/B

Nog uit te voeren op dezelfde commit: flag uit deployen en meten, daarna flag
aan deployen en dezelfde detailroute meten. De experimentstand blijft niet
actief tenzij initiële transfer/request count én gebruikersgerichte timings
reproduceerbaar verbeteren zonder fouten of completion-regressie.
