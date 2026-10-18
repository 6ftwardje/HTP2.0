# Adminproductbord

Admin-MVP, 18 oktober 2026. Route: `/admin/product-board`, bereikbaar via **Productbord** in het beheermenu en **Productontwikkeling volgen** op het adminoverzicht. Afgebakende publicatie: issue [P1.0 / #81](https://github.com/6ftwardje/HTP2.0/issues/81), vanaf main `2c103b6`. Alleen productbordcode; overige lokale features vallen buiten deze release.

## Gebruik

- **Development:** kaarten uit bestaand GitHub Project 3, inclusief conceptkaarten. Backlog en Ready staan samen onder Te doen; Ready blijft herkenbaar als Startklaar. Bezig, Te controleren, Klaar en Geblokkeerd blijven gescheiden. GitHub blijft de bron voor developmentstatus; Klaar betekent geen automatische productiepublicatie.
- **Teamtaken:** gedeelde taken buiten development, met titel, omschrijving, toetsbaar resultaat, prioriteit, admin als eigenaar en deadline. Aanpassen/verplaatsen gebeurt met een toetsenbordbruikbaar formulier. Geblokkeerd vereist een volgende actie; Klaar vereist resultaat en bewijs/feedback. Taken worden in Supabase opgeslagen, niet in browseropslag of GitHub.
- **Werkperiode:** elk bord heeft een eigen doel, begin/einde en feedback voor bijsturing. Dit is één bewerkbare actuele periode, zonder historische sprints of sprinttoewijzing. Totale voortgang telt alle kaarten, onafhankelijk van zoekfilters en werkperiode. Eerdere feedback overschrijven vereist zelf bewaren; de UI vermeldt dit.
- Zoek op titel, resultaat of eigenaar; filter op fase/status of teameigenaar. Het bord ververst iedere minuut als de pagina zichtbaar is en geen formulier openstaat. Formulieren behouden invoer bij fouten. Versienummers voorkomen het overschrijven van gelijktijdige wijzigingen.

## Ingebruikname

1. Uitsluitend `supabase/migrations/20261018000000_product_board.sql` is op 18 oktober 2026 atomair toegepast en geregistreerd op de gecontroleerde productiedatabase. De bestaande `is_platform_admin()`-functie is behouden. De historische migratiebaseline heeft afwijkingen; er is geen blanket `db push`, baseline-reparatie of andere featuremigratie uitgevoerd. Ontbreekt het schema op een andere omgeving, dan blijft development zichtbaar en worden schrijfacties uitgeschakeld met een foutmelding.
2. `GITHUB_PROJECT_READ_TOKEN` is als **serversecret** in Netlify ingesteld, uitsluitend met Functions-scope voor production en deploy-preview. De bestaande geauthenticeerde GitHub-toegang is gebruikt; geen token wordt gecommit of in een lokaal omgevingsbestand opgeslagen. De app doet uitsluitend GraphQL-leesrequests, zonder fetchcache; bij iedere automatische verversing wordt de nieuwste projectstatus gelezen. Er worden vanuit het platform geen GitHub-issues of projectstatussen gewijzigd.
3. Zonder token verschijnt een expliciet gedateerde momentopname uit `lib/data/development-board.json`. Vernieuw deze met `npm run product-board:sync` vanuit een geauthenticeerde `gh`-sessie en neem het gewijzigde bestand mee in de volgende release. De knop Vernieuwen haalt de opgeslagen snapshot opnieuw op, maar synchroniseert die niet met GitHub. Bij een GitHub-storing valt live lezen terug op deze gedateerde snapshot.

Alle gegevens zijn uitsluitend voor `students.access_level = 3`. Pagina, serveracties en RLS controleren adminrechten. Gewone sessieclient voor databasebewerkingen; bestaande serveraudit wordt afgewacht na een geslaagde mutatie. Er is geen GitHub-token in clientprops of browsercode. Geen verwijderactie in deze MVP; corrigeren en heropenen gebeurt via Aanpassen/verplaatsen.

## Bewijs

- Op de oorspronkelijke lokale werkmap slaagden 293 tests. Op de geïsoleerde main-release slagen 280 tests, inclusief 14 productbordtests voor normalisatie, validatie, autorisatie vóór datatoegang, eigenaartoewijzing, conflictbescherming, live GitHub-status/paginering/cachegedrag en foutafhandeling. Het verschil betreft andere, niet gepubliceerde lokale features en vier nieuwe integratietests.
- `npx tsc --noEmit --incremental false`, gerichte ESLint en productiebuild slagen.
- 27 lokale browserchecks met synthetische accounts: creëren, herladen, gedeelde sessies, blokkeren, bewijs voor afronding, doel/feedback, filters, lege zoekresultaten, vier scherm/themacombinaties, geen paginaoverflow/JS-fouten, 404 voor studenten/gratis accounts en loginredirect zonder sessie. Twee afzonderlijke admins openen gelijktijdig taak- en doelformulieren: vernieuwen tijdens bewerken behoudt de oorspronkelijke versie, een conflicterende save overschrijft niets en de expliciete herlaadlink opent de nieuwste versie.
- SQL/RLS op de lokale database: admin leest/schrijft, gewone student leest geen rijen en kan niet muteren, anonieme rol kan geen tabellen lezen. De proef draaide in een transactie met rollback.
- De echte GitHub GraphQL-leesquery is geverifieerd: 67 projectkaarten, volledige paginering. Geen externe writes.
- Onafhankelijke visuele eindcontrole: sluit aan op de adminomgeving. De gevonden conflictproblemen zijn hersteld en in de gerichte tweede review als opgelost beoordeeld. Ontwerpdocumentatiecontrole bevestigt hergebruik van de bestaande admintokens; de afzonderlijke publieke ontwerpdocumentatie is behouden.
- Browserharnas: `HTP_PRODUCT_BOARD_FIXTURES=/pad/naar/private-synthetische-fixtures.json node scripts/verify-product-board.mjs`. Alleen localhost toegestaan. Fixtures bevatten `users[{role,studentId,cookies}]`; geen sessies of credentials committen. Beelden en `acceptance.json` staan lokaal onder `.impeccable/review/product-board/` (gitignored).

De gebruiker heeft de livegang en GitHub-koppeling expliciet opgedragen. Uitrol gebeurt via issue #81 en een afgebakende PR met CI; productiemigratie, deployment en live verificatie worden met werkelijk resultaat in die releaseadministratie vastgelegd. De bestaande werkmap met ander werk blijft behouden.

Rollback bij uitrolproblemen: verwijder eerst de navigatielink of zet de vorige applicatierelease terug en bewaar de additieve tabellen; geen teamdata verwijderen als rollback.
