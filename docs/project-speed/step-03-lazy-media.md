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

Uitgevoerd op commit `91661432f57c5ea1059cb4a93ce73c3a8247cf32`,
telkens tien verse authenticated browsercontexten op dezelfde weekly update:

| Metric | Legacy A p50/p95 | Experiment p50/p95 | Legacy B p50/p95 |
| --- | ---: | ---: | ---: |
| TTFB | 1.328 / 2.584 ms | 761 / 2.628 ms | 716 / 1.998 ms |
| FCP | 1.688 / 2.860 ms | 860 / 2.852 ms | 780 / 2.068 ms |
| LCP | 1.688 / 2.860 ms | 872 / 3.404 ms | 1.196 / 2.388 ms |
| Load | 2.599 / 3.820 ms | 909 / 3.596 ms | 930 / 2.129 ms |
| Transfer | 550.457 / 557.635 B | 300.209 / 300.291 B | 874.577 / 874.634 B |
| Requests | 24 / 27 | 23 / 23 | 34 / 34 |
| Mux-requests vóór klik | 4 / 5 | 1 / 1 | 4 / 4 |
| Streamrequests vóór klik | 1 / 1 | 0 / 0 | 1 / 1 |

Legacy A was deploy `6a6337d4e57afd536133441a`; experiment was
`6a63387b40f03b428745e0d3`; legacy B was
`6a63393fbe43e35c29023602`. Alle waren `ready`, productiecontext, branch
`main` en dezelfde commit.

De productie-boundarytest bevestigde nul streamrequests vóór interactie, één
streamrequest na de play-actie, nul consolefouten en afwijzing van vervalste
interne headers.

## Geselecteerde productiestand

`PROJECT_SPEED_LAZY_MEDIA=0` (legacy).

De mediawinst is structureel: het experiment voorkomt initiële streaming en
verkleint de gemeten transfer sterk. De gebruikersgerichte timingwinst is echter
niet reproduceerbaar. Experiment-load p50 (909 ms) is vrijwel gelijk aan legacy
B (930 ms), terwijl experiment-LCP/load p95 slechter zijn dan legacy B. Door die
instabiele tail blijft de flag conform de beslisregels uit. De rollbackbare
experimentcode blijft beschikbaar voor een latere herhaling met netwerkshaping
en een grotere steekproef.

## Resterende risico's

- Het testaccount heeft nog geen voltooide intake en bood daarom geen
  toegankelijke lesdetailroute; completion is op de weekly update getest tot en
  met het starten van dezelfde speler, maar de video is niet volledig afgespeeld.
- Transfer verschilde sterk tussen legacy A en B door Mux-segment/cachegedrag.
  Een vervolgmeting moet cachebeleid en netwerkcondities expliciet vastzetten.
- De modulesbaseline had geen stabiele tekst/linkhash en moet apart worden
  onderzocht voordat een modulespecifieke optimalisatie wordt geselecteerd.
