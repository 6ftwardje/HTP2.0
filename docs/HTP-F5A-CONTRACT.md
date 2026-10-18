# F5a — PDF-contract en afgebakende proef

18 oktober 2026. **Goedgekeurd door Ward op 18 oktober 2026: D7 bestaande rechten overnemen; D8 voorgesteld contract.** Ward vroeg de uitvoering van issues te hervatten. HTP-25 / [#77](https://github.com/6ftwardje/HTP2.0/issues/77) is lokaal gestart; HTP-25 is geaccepteerd; HTP-26/27/28 worden aansluitend lokaal uitgevoerd. F4 blijft lokaal op commits 9e5f9f7 / edc7a6f / b8aba40; geen toestemming voor F4-publicatie afgeleid. Stop vóór F5b.

Bron: feedbackdocument rubriek 11, PDF-pagina’s 27–29 (gedrukt 26–28), referenties 3/4; basisregels PDF-pagina 5. De formuleringen uit de PDF zijn eisen/voorstellen voor dit contract en geen zelfstandige uitvoeringsopdracht.

## D7 — Goedgekeurd toegangscontract

| Context | Goedgekeurd gedrag | Codebewijs / gevolg |
|---|---|---|
| PDF bij update | Erft publicatiestatus en werkelijke toegangsrechten van precies die update; geen afzonderlijk ruimer PDF-abonnement. | `lib/weekly-update-access.ts`, `app/api/market-updates/[id]/images/[index]/route.ts`, actuele `can_read_market_post` in migratie 20261007020000. |
| Academy-PDF | Verplicht gekoppeld aan één bestaande module. Volledig moduleleesrecht volgens `canOpenModuleWithIntake`: betaald niveau, expliciet gratis met afgeronde intake of bestaande legacyrechten. Eerste-lespreview verleent geen volledig PDF-cursusrecht. | `lib/module-access-policy.ts`, `lib/module-gate.ts`, actuele modulefunctie in migratie 20261014000000. Modulevolgorde/examens/completion veranderen niet. |
| Toolbox-PDF | In F5b dezelfde expliciete modulekoppeling/rechten; geen universeel toegankelijke Toolbox-bestanden. | Toolbox en rubriekentiteit bestaan nog niet. Nu geen rubricatie, content of calculator verzinnen. |
| Rubrieken | Presentatiegroepering later F5b; geen impliciete nieuwe entitlementlaag. Rubriek → bestaande module(s) eerst expliciet mappen. | Geen rubriekentiteit aangetroffen; huidige modulevolgorde behouden. |
| Beheer | Bestaande beheerderguard voor upload/verwijderen, conceptpreview en openlog. Mentor krijgt dit niet automatisch. Leden zien geen andere gebruikers of loggegevens. | Bestaande serverrollen hergebruiken; aparte RPC-/routechecks blijven nodig. |

Een PDF-versie heeft één expliciete oudercontext (update óf module), geen ‘toegang tot één van meerdere ouders’ als impliciete verbreding. Cross-context hergebruik krijgt afzonderlijke gekoppelde metadata. Onbekende/verwijderde ouder, concept, ingetrokken recht en vervallen sessie: standaard weigeren. Alle latere bindings-/metadata-/byte-/leesversieverzoeken opnieuw autoriseren; geen vertrouwen op alleen zichtbare feedkaart of uploadmetadata van de client.

## D8 — Goedgekeurd beschermings- en toegankelijkheidscontract

- Private originelen, geen storagebron-URL of downloadknop aan leden. Geautoriseerde serverlevering geeft alleen een **persoonlijk gemarkeerde** PDF. Browserbytes, screenshots, OCR en verwijderen van watermerken blijven technisch mogelijk; geen absolute kopieerbeveiliging.
- Paginaweergave via eigen PDF.js-canvas met lokaal meegeleverde worker; geen native PDF-iframe. Geen selecteerbare tekstlaag in deze stand. Toegankelijke **leesversie onder dezelfde rechten** is verplicht vóór publicatie: semantische HTML met gecontroleerde tekstvolgorde en beschrijvingen van inhoudelijke charts/tabellen. Automatische PDF-tekstextractie is alleen een redactiestart, geen bewijs van een correcte leesversie. Deze leesversie mag selecteerbaar zijn; toegankelijkheid wordt niet met globale copyblokkades ondermijnd.
- Serverwatermerk op elke pagina: naam + e-mail + datum van openen (Europe/Brussels), herhaald diagonaal, 9% opacity als vertrekpunt. Renderleesbaarheid beoordelen; 9% opacity is geen exacte geometrische dekking. Naam/gegevens uit het actuele geauthenticeerde profiel, nooit uit verzoekvelden. De leesversie toont dezelfde markering in leesbare vorm.
- Openlog: documentversie, oudercontext, intern gebruikers-ID, tijdstip en geslaagd openen. Beheerder kan de actuele naam tonen. **30 dagen bewaren**, daarna daadwerkelijk verwijderen; geen IP, user-agent, tokens of duplicaat-e-mail in log. Geen log bij geweigerde toegang; technische geaggregeerde fouttellers zonder documentinhoud. Idempotent verzoek-ID voorkomt dubbele openregels door retries. Operationele cleanup vereist vóór productie aantoonbare uitvoering; geen papieren bewaartermijn.
- Binnen de canvasviewer alleen contextmenu/slepen en Ctrl/Cmd+S/P/C afremmen waar bruikbaar. Buiten de viewer en binnen de leesversie geen globale interceptie. Printstijl verbergt de beschermde viewer. Zoom, native browserzoom, toetsenbord, Escape, zichtbare focus en focusherstel blijven werken.

**Expliciet goedgekeurd door Ward:** D7 hierboven; en D8 inclusief de selecteerbare toegankelijke leesversie, volledige naam/e-mail/datum in watermark, beheerderinzage en bewaartermijn 30 dagen. De expliciete antwoorden van Ward leveren de contractacceptatie; de proef blijft technisch bewijs.

## Goedgekeurde levering en grenzen

Start met **maximaal 3 MiB input, maximaal 150 pagina’s en maximaal 4 MiB gepersonaliseerde output**. Dat is een bewust kleine eerste grens; grotere cursusbestanden worden leesbaar geweigerd en moeten worden geoptimaliseerd/gesplitst. Een ruimere limiet vraagt afzonderlijke transport-/hostingvalidatie. Deze grenzen zijn door Ward geaccepteerd en lokaal gecontroleerd; geen claim over gemeten productiecapaciteit.

Reden: de repository gebruikt Netlify/Next. Netlify documenteert 6 MB buffered payload met base64-overhead voor binary, circa 4,5 MB effectief, tegenover 20 MB streaming. Een lokale server bewijst het gedrag van de Netlify-adapter niet. Zie [officiële payloaduitleg](https://www.netlify.com/knowledge-base/how-to-add-a-backend-api-endpoint-with-netlify-functions/) en [Functions API](https://docs.netlify.com/build/functions/api/). Daarom geen grote geproxyde serverresponse beloven voordat adapter-/previewbewijs bestaat.

Uitgevoerde endpoints: beheerder-upload met begrensde multipart-body en daadwerkelijke PDF-parse, geauthenticeerde openactie voor PDF én leesinhoud met origincontrole en idempotent verzoek-ID; persoonlijk PDF-resultaat in response, geen signed bron-URL aan leden. `Cache-Control: private, no-store, max-age=0`, `Vary: Cookie`, `nosniff`, geen gedeelde gepersonaliseerde cache. Versie/naam/e-mail/datum opnieuw uit de servercontext halen. Byte-ranges naar originelen nooit doorgeven: na dezelfde toegangspoort een volledige 200-response of een expliciete afwijzing; PDF.js krijgt de begrensde volledige bytebuffer. Reeds geleverde bytes kunnen na intrekking niet worden teruggenomen.

Uitgevoerd additief model: versieerbare PDF-metadata met exact één ouder, private objectkey, geschoonde titel, input-/outputlimieten, pagina-aantal en draft/ready/deleting/error-staat; toegankelijke leesinhoud; afzonderlijk beperkt openlog. Private bucket krijgt een restrictieve direct-readpolicy zoals de chartbucket, omdat een oudere brede storagepolicy anders toegang kan geven. Upload-/verwijderfouten blijven herstelbaar; publiceren pas met gereed bestand én gecontroleerde leesversie. Geen bestaande tabel of entitlement herschrijven.

## Renderer, dependencies en proef

Werkelijk in de app gebruikt: **pdfjs-dist 6.4.299** (Apache-2.0, Node >=22.13), **pdf-lib 1.17.1** (MIT) en **@pdf-lib/fontkit 1.1.1** (MIT), exact gepind na de geïsoleerde proef. Noto Sans Regular/OFL wordt op de server als subset ingebed; herkomst/hash/licentie staan in `assets/pdf-fonts/`. Node lokaal 22.14, CI-major 22. Prebuild/predev kopiëren worker/fonts/wasm en distributielicentie uit het gepinde pakket; de font staat in de server-filetrace. Geen runtime-CDN. Audit gelijk aan de bestaande appbaseline; geen nieuwe advisory. Grote bronafbeeldingen worden niet stil overgeslagen: de aparte 5MP-proef controleert zichtbare inhoud met begrensde canvassen.

[PDF.js-voorbeelden](https://mozilla.github.io/pdf.js/examples/) en [API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html) onderbouwen viewport-/worker-/geheugenkeuzes. [Mozilla FAQ](https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions) adviseert canvassen alleen rond zichtbare pagina’s te houden. De proef houdt maximaal drie canvassen met maximaal twee miljoen pixels per canvas: maximaal 24 MB canvas-RGBA. Dit begrenst niet de volledige renderer-/image-/worker-/browsermemory.

Proefbron: `scripts/probes/htp-f5a/` — generator, loopbacklaboratorium en browserverifier. Synthetische 1-pagina-, 120-pagina/image-heavy-, beschadigde en versleutelde PDF. Groot stressbestand is circa 18,6 MB en dus bewust **buiten** de voorgestelde uploadgrens: het toetst rendergedrag, niet productie-acceptatie. Alleen vaste fictieve personen; geen echte accounts, productie-URL’s of storage. De laboratoriumserver heeft geen productauthenticatie en is alleen aan 127.0.0.1:3120 gebonden; zijn headers zijn geen bewijs van toegangsbeveiliging.

## Vervolgcriteria

HTP-25 pas Done wanneer D7/D8 expliciet zijn gekozen, proefresultaten beoordeeld en het definitieve contract is vastgelegd (nu voldaan). Daarna HTP-26 opslag/toegang, HTP-27 watermerk/logging en HTP-28 gedeelde viewer met echte lokale integratie. F5b contentbindingen, rubriektabs, Toolbox en leespositie blijven buiten deze fase. F4-publicatie en remote migratie-/hostingwijzigingen zijn niet inbegrepen in hervatten.


## Lokale uitvoering na acceptatie

HTP-25 t/m 28 zijn lokaal geverifieerd; [actuele acceptatie](HTP-F5A-VERIFICATIE.md). De eerdere proefbeschrijving hierboven blijft als ontwerpgeschiedenis behouden. De app gebruikt nu de drie gemelde gepinde packages (PDF.js, pdf-lib en fontkit), een gelicentieerde Noto Sans en self-hosted worker/fonts/wasm met upstreamlicentie. Volledige bijlagen-/rubriek-/Toolboxintegratie blijft F5b.

Implementatiedetails: gewone vlakke PDF’s zonder scripts, encryptie, formulieren, bijlagen of interactieve annotaties/links; bronhashcontrole vóór PDF-levering; ouder-FK restrict zodat eerst gekoppelde documenten worden verwijderd. De leesversie heeft ook een eigen route zonder PDF.js of PDF-bytes en kan daarmee onafhankelijk van de canvasrenderer worden gebruikt. De e-mailmarkering komt uit Auth; de profielnaam wordt begrensd op 200 codepoints. Ontbrekende Noto-glyphs worden in het PDF-watermerk expliciet als U+codepoint weergegeven; HTML behoudt Unicode. Retentie is lokaal werkelijk bewezen via één actieve minuuttaak. Geen remote uitrol en geen F4-/F5a-push.

De GET-projectie bevat uitsluitend titel/pagina-aantal/versie/status/leesbeschikbaarheid; geen volledige leesinhoud of bronpad. Zowel PDF als leesversie worden via de geautoriseerde, idempotent gelogde POST geleverd (6ba23eb).
