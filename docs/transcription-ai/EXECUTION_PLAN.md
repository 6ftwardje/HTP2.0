# Uitvoerplan transcriptie en AI-verrijking

## Projectdoel en verkochte scope

Marktinzicht-video’s krijgen op een betaalbare, beheerste manier een transcript, optionele vertaalde ondertiteling, een korte AI-samenvatting, aandachtspunten en klikbare hoofdstukken. Een mens keurt gegenereerde redactionele inhoud goed vóór publicatie. De eerste levering omvat geen dubbing, realtime transcriptie, zoekindex, aanbevelingsmodel of automatische publicatie zonder review.

## Architectuur en randvoorwaarden

- Next.js 15 App Router met server actions en route handlers.
- Supabase/Postgres met additieve migraties, RLS en server-only service client.
- Mux is de primaire videoprovider; er bestaat ook legacy Vimeo/YouTube-content.
- Marktcontent leeft hoofdzakelijk in `weekly_updates`; metadata `summary`, `key_takeaways` en `chapters` bestaat al of is voorbereid.
- AI gebruikt momenteel een Anthropic-adapter, centrale registry, structured output, cache en `ai_interactions`-logging.
- Mux-helpers hebben nog geen caption-API of webhookroute.
- Er is geen unit-test runner; alleen TypeScript, Next lint/build en Playwright-performance scripts bestaan.
- `npm audit` rapporteert bij aanvang twee high-severity bevindingen in development dependencies; CI blokkeert voorlopig critical en aanscherping vereist een afzonderlijk dependency-issue buiten deze productscope.
- Externe writes en betaalde API-calls mogen alleen na expliciete menselijke toestemming. CI mockt providers.

## Huidige status

- Marktinzicht en handmatige redactionele velden zijn aanwezig in de lokale worktree.
- Mux upload/sync en signed playback bestaan.
- Transcriptstatus, caption-track-ID’s, enrichment jobs, reviewstatus en vertaalartefacten bestaan nog niet.
- Geen GitHub-templates/workflows bestonden vóór deze governancewijziging.
- De worktree bevat omvangrijke, ongerelateerde niet-gecommitte wijzigingen; iedere uitvoerder moet die behouden.

## Beslispoort S0.1

Productwerk na S0.1 start pas wanneer een mens schriftelijk beslist over:

1. Mux captions als primaire bron en de fallback voor niet-Mux-content.
2. Brontaal en eerste doeltaal of expliciet “geen vertaling in MVP”.
3. Verplichte menselijke review en wie mag goedkeuren.
4. Transcriptretentie, verwijdering en zichtbaarheid voor studenten.
5. Maximale kosten per video/maand en welke provider/modelcombinatie is toegestaan.
6. Of webhookautomatisering direct gewenst is of pas na een handmatige pilot.

## Geordende backlog

| Volgorde | Code | Aantoonbaar resultaat | Afhankelijk van | Schatting |
|---:|---|---|---|---|
| 1 | S0.1 | Goedgekeurd scope- en beslisdocument | — | S |
| 2 | S0.2 | Testfundament met volledig gemockte providers | S0.1 | S |
| 3 | S1.1 | Additief transcript- en enrichmentdatamodel | S0.1 | M |
| 4 | S1.2 | Geteste Mux-captionadapter | S0.1, S0.2 | M |
| 5 | S1.3 | Geauthenticeerde, idempotente Mux-webhookintake | S1.1, S1.2 | M |
| 6 | S1.4 | Handmatige transcriptstart en zichtbare status | S1.1, S1.2 | M |
| 7 | S2.1 | Gevalideerd enrichmentcontract en fixture-evaluatie | S0.1, S0.2 | S |
| 8 | S2.2 | Idempotente AI-enrichmentjob met kostenlog | S1.3, S2.1 | M |
| 9 | S2.3 | Adminreview en expliciete publicatie | S1.1, S2.2 | M |
| 10 | S2.4 | Goedgekeurde samenvatting en hoofdstukken voor studenten | S2.3 | S |
| 11 | S3.1 | Vertaalcontract en deterministische WebVTT-renderer | S0.1, S0.2 | S |
| 12 | S3.2 | Goedgekeurde vertaling als Mux-track | S1.2, S3.1 | M |
| 13 | S4.1 | Betrouwbare orchestratie met retries en kostenlimieten | S1.3, S2.2, S3.2 | M |
| 14 | S4.2 | Legacybackfill als dry-run met expliciete goedkeuring | S2.3, S4.1 | M |
| 15 | S4.3 | Synthetische end-to-endacceptatie en runbook | S4.1, S4.2 | M |

S3.1 en S3.2 worden overgeslagen wanneer S0.1 beslist dat vertaling niet tot de MVP behoort. S4.1 moet dan zonder vertaalstap worden herschikt in een apart backlogissue; bestaande issues worden niet stilzwijgend verbreed.

## Git-flow

De verplichte flow staat in `/CONTRIBUTING.md`. Eén issue is de bron van waarheid, iedere PR sluit exact één issue, en `main` blijft deploybaar. Branch protection moet buiten Git worden geconfigureerd: vereiste CI, minimaal één approving review, Code Owner-review voor kritieke paden en squash-only merges.

## Backlogsynchronisatie

Alle issuebronnen staan in `.github/backlog`. `node scripts/sync-transcription-backlog.mjs --check` controleert volledigheid, unieke taakcodes, bekende dependencies en cycli zonder netwerk of writes. `--apply` zoekt eerst alle open en gesloten remote issues, stopt bij dubbele taakcodes en maakt of actualiseert daarna exact één issue per bronbestand. Remote writes vereisen zowel expliciete toestemming als `ALLOW_GITHUB_WRITES=1`.

## Open blokkade

Geen remote backlogblokkade: GitHub is gecontroleerd en de issues zijn gesynchroniseerd. S0.1 blijft de inhoudelijke beslispoort.

## Afgesplitst repositorywerk

G0.1 behandelt uitsluitend de reeds bestaande high-severity dependency-auditbaseline. Het behoort niet tot de 15 productslices en mag hun scope niet verbreden.
