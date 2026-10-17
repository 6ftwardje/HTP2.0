# F1 — lokale uitvoering en verificatie

Datum: 17 oktober 2026. Branch: `codex/htp-f1-visual-basis`. Startpunt: `ce6b4527101dc64ebcc80b7fa59fe52b60fe414f`, inclusief de bestaande niet-gecommitte wijzigingen. De kopie van de bron vóór F1 en bestandshashes staan lokaal onder `/tmp/htp-f1-before*`; bestaande wijzigingen worden behouden.

Ward heeft F1 expliciet goedgekeurd en D1 beslist: **Crypto amber #E39B4B**. Deze goedkeuring omvat lokale implementatie en verificatie van F1; F2, dependencies, datamodelmigraties, productie-uitrol en overige fasen vallen erbuiten. Lokale oplevering gaat vooraf aan eventuele PR/publicatie.

## Visuele richting en grenzen

Rustige grijsblauwe oppervlakken met drie helderheidslagen; paars voor actief/focus/primaire actie en gedempte marktkleuren. De bestaande paginavolgorde, leer-/marktgroepering, artikelkop/intro/regellengte/byline, thumbnails, disclaimer en reacties zonder comments blijven behouden. Geen nieuwe header, feedkaartstructuur, chips, meldingenlogica of video-/PDF-feature.

De bestaande publieke landing heeft een afzonderlijke, eerder vastgelegde visuele scope in PRODUCT.md/DESIGN.md. Deze fase vervangt die landing niet. Alleen de expliciet goedgekeurde logo-aanpassing wordt ook op login toegepast; het formulier en de publieke copy blijven staan.

## Lokale baseline — HTP-01

- Baseline in Next.js dev; uiteindelijke productiebuild lokaal op `http://127.0.0.1:3117`, met aparte gegenereerde buildbestanden en uitsluitend lokale Supabase API `http://127.0.0.1:54321`.
- Geen bestaande localhostservers gestopt of hergebruikt. Geen remote database-/configuratie-/opslag-/betalings-/mailwrites uitgevoerd.
- Lege lokale database voorzien van uitsluitend synthetische fixtures: vier rollen (gratis, Academy, mentor, admin), twee modules, vier lessen, vijf artikelen en een melding. Geen schema, policies of migrations gewijzigd.
- Vóór UI-wijziging: 78 route/rol/theme/breedtecontroles, alle HTTP 200, nul browserruntimefouten en nul horizontale documentoverflow. Student/admin in 1440/768/375px en licht/donker; gratis/mentor eveneens route- en gatecontroles.
- 54 basisscreenshots van dashboard, Marktinzicht, artikel, Academy-overzicht/detail, meldingen en geraakte beheerschermen staan in `output/playwright/htp-f1/before/`; `results.json` bevat de controle-uitkomsten.
- De lokale database mist bestaande functies/kolommen zoals `modules.is_free`, `legacy_academy_module_access` en de nieuwste chatstructuur. Bestaande fallbackmeldingen zijn vóór F1 zichtbaar in de dev-serverlogs. Dit dossier bewijst geen uitrol van die migrations of volledige actuele productie-RLS. Die achterstand wordt niet via F1 opgelost.

## HTP-02 — thema en kleurcontrast

Implementatie lokaal afgerond. Unitchecks voor de initialisatie: 3/3 geslaagd (opgeslagen keuze, donkerfallback onafhankelijk van systeem, geweigerde localStorage).

Bewuste AA-afwijkingen van het ruwe palet worden als semantische tokens vastgelegd: basisaccent #7C6CF0 blijft bestaan, maar heeft slechts 3,99:1 op wit en 4,37:1 op de donkere kaart. Kleine geselecteerde tekst gebruikt daarom een aparte lichte/donkere accent-inkt. Donkere tekst op primaire paarse knoppen; gedempt #6B7280 niet als kleine donkere bodytekst. Marktkleuren krijgen eveneens aparte AA-inktkleuren in light mode, terwijl de zes basiskleuren behouden blijven.

## Voortgang

F1 is lokaal gebouwd en technisch gecontroleerd. HTP-01 t/m HTP-05 staan **Te controleren** voor Wards visuele acceptatie; geen taak wordt vooruitlopend op review/merge Done genoemd. HTP-19 blijft **Geblokkeerd** voor ontbrekend reproductiemateriaal. HTP-47 blijft een vervolgende verificatietaak voor de resterende fasen; F1-bewijs is hier vastgelegd. **F2 is niet gestart.**

## HTP-19 — fout 153, uitsluitend diagnose

De YouTube-tak gebruikt `youtube-nocookie.com/embed/ID` in `components/VimeoPlayerCore.tsx`, zonder expliciete iframe-referrerPolicy. Broncontrole in app/layout, Next-config en netlify.toml vond geen globale no-referrer-instelling; de lokale HTTP-response bevat geen Referrer-Policy-header. Dat bewijst niet dat een host, extensie of browser elders dezelfde effectieve policy heeft.

Volgens de [officiële YouTube IFrame-reference](https://developers.google.com/youtube/iframe_api_reference#onError) duidt fout 153 op ontbrekende HTTP Referer of gelijkwaardige clientidentificatie; zie ook [YouTubes identificatievereisten](https://developers.google.com/youtube/terms/required-minimum-functionality#embedded-player-api-client-identity). Dit is context, geen bevestigde oorzaak van Wards screenshot.

De oorspronkelijke getroffen update/video-ID en omgeving zijn niet aangeleverd; de lokale database bevatte vooraf geen updates. De fout kon daarom niet met het getroffen materiaal worden gereproduceerd. Geen header-/embedgedrag aangepast. HTP-19 blijft Geblokkeerd voor gerichte reproductie; een eventueel herstel hoort in F4 na goedkeuring. F1-visuele acceptatie wordt hierdoor niet geblokkeerd.

## Resultaat per F1-taak

| Taak / issue | Implementatie en controlebewijs | Status |
|---|---|---|
| HTP-01 / #40 | 78 baselinegevallen, 54 screenshots; huidige rollen/routes/flags en lokale schemabeperking beschreven. Behoud van gate-/actie-/publicatie-/chatbroncode gecontroleerd ten opzichte van het F1-startpunt; bestaande contracttests slagen. | Te controleren |
| HTP-02 / #44 | Centrale tokens in app/globals.css; lib/theme.ts initialiseert vóór paint, ThemeToggle bewaart keuze en kan bij opslagweigering wisselen. Beide systeemvoorkeuren, opgeslagen licht/donker, refresh en echte logout/login gecontroleerd. | Te controleren |
| HTP-03 / #45 | Eén MarketTag met zes basistokens en themagebonden AA-inkt; Crypto amber. Bekende bestaande marktlabels gebruiken dezelfde component; Macro/Indices/Algemeen niet stil heringedeeld, geen datamodel veranderd. Zes echte componentvarianten apart getest. | Te controleren |
| HTP-04 / #46 | Drie semantische UI-kopniveaus; feedpadding desktop 27→18px en mobiel 24→16px, lesrijpadding 16→10px. Gedeelde RelativeDate met NL-label, Brussel/DST, veilige fallback en focus/hover-tooltip; exacte agenda-/deadlinevelden behouden. Artikelkop heeft op alle zes breedte/themacombinaties exact dezelfde fontgrootte, regelhoogte en gewicht als baseline; intro/byline/regellengte/disclaimer behouden. | Te controleren |
| HTP-05 / #47 | Bestaand transparant icoon met schaalbare merknaam, geen licht tegeltje; donker/licht volgt de container, login expliciet op donker. Logo op desktop/mobiel en login getest; originele logo-/thumbnailbestanden hashgewijs ongewijzigd. | Te controleren |
| HTP-19 / #48 | Bron, lokale responseheaders en officiële providerdocumentatie onderzocht; getroffen video en omgeving ontbreken. Geen referrer-/embedfix uitgevoerd. | Geblokkeerd |

## Uitgevoerde eindcontroles

- `npm test`: **283 geslaagde tests**, nul mislukt/overgeslagen. Daaronder zes gerichte nieuwe thema-/datumtests voor opslagweigering, systeemvoorkeur, NL-weergave, ongeldige invoer en Brussel/DST.
- TypeScript `tsc --noEmit --incremental false`: geslaagd. Een gelijktijdige eerste controle liep tegen door de build tijdelijk verwijderde gegenereerde typebestanden aan; na de build sequentieel herhaald, zonder bron-/compilerinstellingen te veranderen.
- Lokale Next-productiebuild: geslaagd; de uiteindelijke build wordt met `next start` op poort 3117 aangeboden. Geen deployment, push, dependencywijziging of applicatiedatamigratie.
- De uiteindelijke productiebuild daarna afzonderlijk gesmoked: dashboard, Marktinzicht, wachtwoordherstel, authfoutpagina en lesdetail geven alle HTTP 200, nul browserruntimefouten. De woordmarkering erft ook op vast donkere herstelpagina’s de juiste containerkleur.
- Gerichte ESLint-controle van nieuwe helpers/componenten/tests: geslaagd. Bestaande backlogvalidatie: geslaagd (17 oorspronkelijke transcriptieslices; HTP-taken zijn apart via het project gecontroleerd).
- Na de correctieronde: **78 route-/rol-/thema-/breedtegevallen**, alle HTTP 200 en dezelfde bestemmingen als baseline, nul pageerrors/horizontale overflow. 112 browserchecks plus drie gerichte vervolgchecks. Eén read-actioncheck keek te vroeg vóór de serverrefresh; wachten op de verdwenen knop en controle van persistente read_at bevestigden correcte werking. De test is aangepast, geen meldingenlogica gewijzigd. Het oorspronkelijke resultaat blijft bewaard naast de resolutie in `verification-summary.json`.
- **2.988 zichtbare tekstfragmenten** op vlakke platformoppervlakken gecontroleerd: nul open AA-contrastbevindingen. De eerste pass vond een paarse beheerlink en te sterk gedimde locked-contenttekst; in één correctiebatch geneutraliseerd. Thumbnail-labels kregen een ondoorzichtig donker tekstvlak, zonder de afbeeldingen zelf te wijzigen. Decoratieve verborgen overlaynummers tellen niet als leesbare content.
- Zes MarketTags: minimale gemeten ratio **5,53:1 donker / 5,41:1 licht**, boven de kleine-tekstgrens 4,5:1. Dit is een contrastcontrole van deze oppervlakken, geen volledige onafhankelijke WCAG-audit of meting van externe videospelers.
- Themafocus, denied storage, opgeslagen voorkeur na refresh en echte signout/sign-in, reduced-motion-tooltip, exacte datum via keyboard, zoekfunctie, bestaande reactie, melding lezen en vier legacyroutes gecontroleerd.
- Visuele beoordeling van desktop/tablet/mobiel, licht/donker, artikel-/Academy-/beheerschermen, login en componentvarianten. Baseline en bevestiging gebundeld; geen extra visuele scope of F2-werk toegevoegd.
- Mechanische designscan: 33 uitsluitend adviserende bevindingen tegen het aparte publieke DESIGN.md-raster, nul blokkerende bevindingen. Beschermde artikeltypografie niet aangepast om aan het publieke landingraster te voldoen.

## Bestandsgrens, datums en beperkingen

Applicatiewijzigingen betreffen alleen presentatie, thema en datumweergave. Gate-/billing-/publicatie-/chat-/Supabase-actions, datamodellen en migrations zijn niet door F1 gewijzigd. De werkmap bevat ander lopend werk, onder meer aan mentorchat-CI; dat is niet opgenomen in de F1-patch. Packages, lockfile, Next-config, .env en alle bestaande assets zijn ten opzichte van de F1-startsnapshot ongewijzigd.

Next voegde bij de afzonderlijke buildpaden tijdelijk gegenereerde typepaden toe; de F1-paden zijn verwijderd. De bestaande include-volgorde in tsconfig werd tijdens het parallelle werk anders geordend; er zijn voor F1 geen compileropties of blijvende F1-typepaden toegevoegd. Dit is niet teruggezet over mogelijk ander werk heen.

Relatieve datumweergave toegepast op publicatiemeta in feed/dashboard/artikel, updatetijd/historiek, meldingen, legacy-marktvideo-overzichten en beheerpublicatie-/studentdatums. Exact gebleven: komende livesessies/agenda, weekstart/periode, inhoudelijke deadlines, factuur-/toegangsperiodes en de chronologie in mentorchat. Dit zijn functionele datums buiten de publicatie-/metaweergave van F1. De oudere exacte formatter in lib/market-article.ts blijft als compatibiliteit bestaan; de artikelweergave gebruikt RelativeDate.

De lokale databaseachterstand uit de baseline blijft bestaan. Daardoor is geen bewijs geleverd voor de volledige nieuwste chat-/free-module-RLS in een uitgerolde omgeving. Examen-/media-/publicatie-/chatcontracten zijn gecontroleerd met bestaande tests en onveranderde bronlogica, niet met nieuwe productieacties of echte betalingen/extern videomateriaal. Dit is geen toestemming om die achterstand in F1 te migreren.

## Lokaal bekijken en bewijsbestanden

- Preview: [lokale productiebuild](http://127.0.0.1:3117/market-analysis).
- Synthetische lokale toegang: [LOCAL-ACCESS.md](../output/playwright/htp-f1/LOCAL-ACCESS.md). Dit bestand en sessiecookies zijn lokaal, niet op GitHub gezet.
- Bewijs: `output/playwright/htp-f1/before/` en `output/playwright/htp-f1/confirm/` (58 bevestigings-PNG's, resultaten en gerichte verificatie).
- Reproduceerbare browsercontrole: `HTP_F1_FIXTURE_FILE=/pad/naar/lokale-fixtures.json HTP_F1_BASE_URL=http://127.0.0.1:3117 node scripts/verify-htp-f1.mjs`. Het script accepteert alleen localhost en gebruikt uitsluitend de synthetische accounts; fixturegegevens/cookies blijven buiten Git.
- De eigen F1-bronpatch, onafhankelijke testlogs en bestandsmanifest staan lokaal onder `output/playwright/htp-f1/`. De patch vergelijkt met de vuile werkmap vóór F1, zodat ouder werk niet als F1 wordt gepresenteerd.

De vijf implementatietaken blijven Te controleren totdat Ward de lokale vormgeving accepteert en de passende integratiestap is afgesproken. Daarna kunnen zij met dit bewijs worden afgerond. Uitvoering stopt hier vóór F2.


## Releaseaanvulling HTP-49 — 17 oktober 2026

Ward keurt F1 plus de volledig klikbare updatekaart goed voor main. De release is apart opgebouwd op origin/main 6493196; ouder publiek/auth/email/avatarwerk uit de vuile werkmap is niet meegenomen. De drie contextverschillen in layout, login en StudentsTable zijn beperkt tot thema/logo/datum opgelost.

Op deze geïsoleerde versie: 238 tests geslaagd, TypeScript en productiebuild geslaagd. Vier aanvullende browsergevallen (1440/375, donker/licht): kaartpadding, samenvatting, thumbnail en Enter openen dezelfde update; één focusbare link, zichtbare focus, nul paginafouten/overflow. De eerdere 283 tests golden de ruimere lokale werkmap; beide aantallen hebben dus een andere bronbasis. Releasebewijs: output/playwright/htp-f1-release/ in de releaseworktree.

F2 is nu uitsluitend lokaal goedgekeurd. D4: alleen bel, openen op klik behouden. Uitvoering stopt na F2 vóór F3a.
