# F5a — Private PDF’s, watermerken en toegankelijke viewer

**Publicatieopdracht 18 oktober 2026:** Ward keurt F4/F5a naar main goed via [release-PR #84](https://github.com/6ftwardje/HTP2.0/pull/84) / [issue #83](https://github.com/6ftwardje/HTP2.0/issues/83). De actuele productbordrelease 4dd8206 is behouden. Gecombineerd: 298 tests, typecheck, lint en backlogcheck groen; hosted CI/verse database/preview worden vóór merge gecontroleerd en in de PR vastgelegd. F5b mag daarna uitsluitend lokaal; stop vóór F6. Hieronder beschreven eerdere stoppoorten en niet-publicatie gelden voor hun historische acceptatiemoment. Geen remote featuremigratie of betaalactivering inbegrepen.

18 oktober 2026. **D7/D8 expliciet door Ward goedgekeurd. HTP-25/#77, HTP-26/#78, HTP-27/#79 en HTP-28/#80 zijn lokaal uitgevoerd en geverifieerd. Geen F4-/F5a-push; stop vóór F5b.**

[Bord](https://github.com/users/6ftwardje/projects/3) · [Complete backlog](HTP-BACKLOG.md) · [Goedgekeurd contract](HTP-F5A-CONTRACT.md) · [Fasenplan](HTP-FASENPLAN.md) · [Historische geïsoleerde proef](HTP-F5A-PROEF.md).

## Goedkeuring en omgeving

Ward koos **“Bestaande rechten overnemen (aanbevolen)”** voor D7 en **“Voorgesteld contract (aanbevolen)”** voor D8. Dat omvat dezelfde update-/volledige modulerechten, geen volledige PDF-cursus op basis van eerste-lespreview, canvas met een gecontroleerde selecteerbare leesversie, serverwatermark naam/e-mail/datum, beheerderlog met 30-dagenverwijdering en aanvankelijk 3 MiB input/150 pagina’s (4 MiB output).

Branch `codex/htp-f5a-local`, managed checkout `/Users/wardjanssen/.codex/worktrees/htp-f1-release/Het Trade Platform 2.0`, gestapeld op lokale F4 `f2bf0c3`. Backend/dependencies/migratie **9682a6c**, reader/beheer **8b4e5b0**, verificatie **c820f63**, rendererlicentie **74969b5**, grote-afbeeldingcorrectie/proef **26c82d2**, gelogde leeslevering **6ba23eb**. Geen F5a-PR of branch gepubliceerd. De oorspronkelijke vuile checkout behoudt applicatiecode/configuratie/dependencies; alleen planningsdocumenten worden daar met hashcontrole gespiegeld.

Lokale productiebuild [PDF-beheer](http://127.0.0.1:3118/admin/documents), lokale Supabase `htp-f2-local`, API 64321/DB 64322. Uitsluitend synthetische free-, Academy-, tweede Academy- en beheerderaccounts met `example.invalid`. Geen productiecontent, remote schema, externe providerwrites of betaalcalls. Billing blijft dormant. Lokale testtoegang staat in het genegeerde privébestand `output/playwright/htp-f5a/LOCAL-ACCESS.md`, niet in Git/GitHub.

## Uitvoering per taak

| Taak | Resultaat en bestanden |
|---|---|
| HTP-25 / #77 | Contract/rechtenmatrix, referentie- en codeonderzoek, 120-pagina-stressproef en expliciete D7/D8-keuze afgerond. De eerdere proefserver was geen productauthenticatiebewijs; onderstaande integratie levert dat afzonderlijk. |
| HTP-26 / #78 | Additieve `20261018180000_htp_f5a_private_documents.sql`, `lib/pdf/http.ts`, `/api/admin/documents` en `/api/documents`. Private bucket met restrictieve policy voor alle directe operaties, ook bij oudere brede policies. Metadata/objectpad niet rechtstreeks leesbaar voor leden; de geautoriseerde GET-projectie bevat geen leesinhoud. Exact één ouder; volledige module-/intake-/legacyrechten of actuele updaterechten hergebruikt. Begrensde multipart-body, echte PDF-parse, titel/HTML opschonen, pagina-/bestandsgrenzen en bronchecksum. Upload-/deletefouten houden herstelbare, ontoegankelijke metadata; versie-CAS beschermt edits. |
| HTP-27 / #79 | `lib/pdf/transform.ts` markeert de geleverde bytes met Noto Sans/fontkit. Vier volledige diagonale markeringen per pagina, 9% opacity; passend voor portrait/landscape. E-mail komt uit **geverifieerde Auth**, naam uit het huidige profiel, datum Europe/Brussels. Geen gedeelde persoonscache. Alleen de server kan succesvolle openacties registreren; hercontrole van actuele toegang/versie en lock op de levende Auth-gebruiker vóór loginsert. Uniek verzoek-ID per eigenaar/document voorkomt dubbele retryregels. Alleen beheerders zien het log; geen IP, user-agent, tokens of e-mailduplicaat. |
| HTP-28 / #80 | `ProtectedPdfViewer` met native dialog, vaste kop/toolbar, pagina-/zoom-/passendbediening, focus/Escape/herstel, loading/fout/retry en maximaal drie canvassen van elk maximaal twee miljoen pixels. Interceptie uitsluitend binnen canvasviewer; print verbergt beschermde inhoud. Selecteerbare semantische leesstand én zelfstandige `/documents/[id]/reading` via `AccessiblePdfReader`: dezelfde serverpoort en markering, onafhankelijk van PDF.js/worker/PDF-bytes. `PdfDocumentsManager` en `/admin/documents` bieden upload, conceptpreview, gecontroleerde leesversie, publiceren/bewerken, verwijderherstel en openlog. |

Alle vier **Done voor de geverifieerde lokale scope**. HTP-47 blijft Backlog voor integrale F10-acceptatie; HTP-48 Ready voor doorlopend bordonderhoud. F5b bijlagen/feed/Academytabs/rubrieken/Toolbox/leespositie zijn niet gebouwd.

## Verificatie

| Controle | Gecontroleerde uitslag |
|---|---|
| Unit en grenzen | **284 tests geslaagd, nul mislukt/overgeslagen.** Bestaande regressies behouden; zeven PDF-tests voor veilige metadata/semantische HTML, origin versus daadwerkelijke Host, begrensde chunked bodies, ID-traversal, Brusselse daggrens, ongeldige/te grote/interactieve PDF, Unicode/landscape en geïnjecteerde overgrote library-output die vóór uitlevering wordt geweigerd. |
| SQL / migratie | Migratie lokaal toegepast en herhaald; rollback-SQL-suite geslaagd. Eerste-lespreview ≠ volledige PDF; gratis module na echte intake en legacyrecht behouden; Academy/update/concept/admin/anon/onbekend/verwijderde Auth. Directe metadata/storage/logwrites geweigerd, geen ledenlog, actuele rechten/versie, idempotentie en herstel van JWT-context in de uitsluitend servertoegankelijke logfunctie gecontroleerd. Oude leer-/completion-/toegangspolicies niet gewijzigd. |
| HTTP / echte browser | **15 hoofdgroepen + 10 aanvullende groepen**, werkelijke adminformulier → API → private opslag → persoonlijke PDF → worker/canvas. Twee sessies krijgen verschillende, volledige Unicode-markeringen op portrait en landscape; concurrente retries leveren één log per openactie. Anoniem/onvoldoende rechten/intake/concept/ingetrokken/expired session, origineel/GET/range/origin/account-/versiebypass en ongeldige uploads getest. |
| Fouten / lifecycle | Werkelijke opslaglimietfout laat een herstelbaar errorconcept achter. Geforceerde DB-deletefout na objectverwijdering blijft fail-closed en kan opnieuw worden verwijderd. Ontbrekend bronbestand levert geen succesvolle openlog. Netwerkuitval heeft Nederlandse feedback en expliciete retry. Snelle close/reopen, focusring, Ctrl/S-context-/printscope, zichtbaarheid na rechtenintrekking en accountwisseling verwijderen oude canvassen. Invoer 999/leeg/0 klemt of herstelt correct; toetsenbord blijft bruikbaar. |
| Grote afbeelding | Een bronafbeelding van **5.000.000 pixels** blijft aantoonbaar blauw/zichtbaar in de mobiele canvaspixelproef; het canvas blijft onder twee miljoen pixels. De PDF.js-instelling die grote afbeeldingen kon overslaan is verwijderd. Aanvullend bewezen: GET-metadata levert geen beschermde leesinhoud; de leesinhoud loopt via de geautoriseerde en idempotent gelogde POST. |
| Bron en identiteit | **Drie gerichte aanvullende controles:** gewijzigde bronbytes met dezelfde grootte worden op SHA-256 geweigerd vóór levering/log; opnieuw openen na naamswijziging levert acht actuele markeringen over twee pagina’s; geraden publieke storage-URL levert het origineel niet. Een vervalste `students.email` verandert de watermarkmail niet: Auth blijft de bron. |
| Retentie | **Eén actieve pg_cron-taak, elke minuut**; de werkelijk geplande taak verwijderde een 31 dagen oude synthetische regel, zonder handmatige purge-aanroep. Laatste jobstatus `succeeded`. API/RLS tonen sowieso alleen de laatste 30 dagen. Geen fictieve bewaartermijn zonder uitvoering. |
| Leesversie / semantiek | Zelfstandige leesroute per toetsenbord geopend terwijl workerassets geblokkeerd zijn: geen worker-/PDF-verzoek, geen canvas, wel selecteerbare tekst en koppen/tabel in de toegankelijkheidsboom (`reading-accessibility.yml`). Publicatie vereist een door beheerder bevestigde volledige leesversie. Dit is geen automatische inhoudelijke vergelijking of handmatige VoiceOver/NVDA-audit. |
| Beeld / contrast | **24 schermgevallen**: canvasviewer, interne leesstand, zelfstandige leesroute en beheer × 1440/834/375 × licht/donker. Gerichte bevestiging na de eerste review; geen documentoverflow of wegvallende kopbalk. **2.582 actieve tekstfragmenten, nul gedetecteerde AA-tekstcontrastfouten**, exclusief canvaspixels/native browsercontrols; geen volledige onafhankelijke WCAG-audit. Geen ongehanteerde paginafouten in de finale browserresultaten. |
| Technisch / dependencies | Typecheck, lint, productiebuild, bestaande backlogcheck, syntax/whitespace en designscan geslaagd. Alleen bestaande img-waarschuwingen. Gepinde PDF.js-worker/fonts/wasm lokaal gegenereerd door prebuild/predev; geen runtime-CDN. Font staat aantoonbaar in de server-filetrace. Auditbaseline: 7 high/3 moderate/0 critical, **identiek aan vóór deze wijziging; geen nieuw advisorypakket**. Geen automatische brede dependencyfix uitgevoerd. |

Bewijs onder `output/playwright/htp-f5a/integration/`: `unit.log`, `typecheck.log`, `build.log`, `lint.log`, `sql.log`, migratielogs, `results.json`, `extra-results.json`, `source-results.json`, `retention-readback.json`, browserlogs, contrastresultaten, toegankelijkheidsboom, `visual/`, contactvel en bordreadback. Alleen synthetische PDF’s/tekstextracties in de genegeerde output. Tussentijdse harnesscorrecties: echte gepubliceerde tekstfixtures gebruiken `content_format=text` en vereiste body/intakevelden; `Vary` bevat naast Cookie ook Next-routerheaders; init-script vangt opslagweigering in originloze frames af. Alleen finale resultaten gelden als bewijs.

## Technische grenzen en herstel

Private originelen en actuele autorisatie zijn de toegangsbarrière; de ontvanger krijgt voor canvas een persoonlijk gemarkeerde PDF. **Screenshots, OCR, byte-extractie, watermerkverwijdering en kopiëren blijven technisch mogelijk.** De semantische leesversie is bewust selecteerbaar. Reeds geleverde inhoud kan na intrekking niet worden teruggenomen; de viewer hercontroleert bij terugkeer naar de tab en wist dan de oude weergave.

Input maximaal 3 MiB/150 pagina’s; output maximaal 4 MiB. Alleen vlakke PDF’s zonder encryptie, scripts, formulieren, bijlagen of interactieve annotaties/links. De eerste stressproef van 18,6 MB bewijst rendergedrag, geen toegestane productie-upload. De canvas-RGBA-grens is 24 MB; totaal browser-/worker-/imagegeheugen kan hoger zijn. Bewijs is Chrome met mobiele emulatie, geen fysieke iOS/Safari-/Firefox-acceptatie.

Noto Sans ondersteunt onder meer Latijnse, Griekse en Cyrillische glyphs. Ontbrekende PDF-glyphs krijgen een expliciete U+codepointvorm; de leesversie behoudt Unicode. De watermarknaam is begrensd op 200 codepoints. Lettertype/copyright/licentie en herkomsthash staan in `assets/pdf-fonts/`. Vier herhaalde markeringen met 9% opacity betekenen niet exact 9% geometrische dekking.

Een ouder kan pas worden verwijderd nadat de gekoppelde PDF’s zijn verwijderd; FK-restrict voorkomt verweesde objecten. F5b-integratie moet die volgorde ook in de inhoudseditor begeleiden. Bij mislukte upload: foutconcept verwijderen en opnieuw uploaden. Bij mislukte delete: staat deleting/error blijft ontoegankelijk en de beheerder kan herhalen. Bronbestand/metadata vervangen gebeurt via nieuwe upload/versie, geen stille wijziging van een objectpad.

Geen remote uitrol. Een latere release moet de historische repositoryissue **#28** (schema-/betaalpoort, niet HTP-28/#80), Node-/Netlify-adapter, private bucket, cron-rechten/-taak en gegenereerde assets apart valideren. Lokale buffering is geen Netlify-productieproef. Veilige rollback: applicatieversie terugzetten en nieuwe tabellen/private bucket voorlopig behouden; destructieve verwijdering pas na export van nieuwe documenten/logs beoordelen. Bestaande cursusvoortgang wordt niet teruggeschreven of herberekend.

## Herhalen en stoppoort

`npm ci`, daarna `npm run build` (prebuild kopieert de gepinde assets); migratie en `tests/sql/htp-f5a-private-documents.sql` uitsluitend tegen de afgesproken lokale database. De operationele private fixturebestanden zijn lokaal gegenereerd; wachtwoorden, sessies en keys horen niet in Git.

```bash
LOCAL_SUPABASE_ENV_FILE=/privé/lokaal.env \
HTP_F5A_FIXTURE_FILE=/privé/f5a-accounts-en-ouders.json \
HTP_PDFTOTEXT=/pad/naar/pdftotext \
node scripts/verify-htp-f5a.mjs
```

Dezelfde variabelen voor `scripts/verify-htp-f5a-extra.mjs` en `scripts/verify-htp-f5a-source.mjs`, in die volgorde. `scripts/verify-htp-f5a-image.mjs` maakt zo nodig met de bestaande Sharp-dependency een synthetische `five-megapixel.jpg` (2000×2500, egaal blauw). Scripts weigeren remote hosts/niet-synthetische accounts; ze muteren alleen hun eigen lokale fixtures en herstellen foutinjecties. De extra sessieproef maakt een lokaal verlopen JWT zonder tokenwaarden te loggen. Publiceer de output of privétoegang niet.

**Bewust niet uitgevoerd:** F4/F5a push of PR, remote migraties/configuratie, echte PDF-contentmigratie, nieuwe abonnementen, F5b-integratie/leespositie/rubrieken/Toolbox, betaalcutover, volledige AT-/browser-/penetratieaudit en absolute kopieerbeveiliging. **Stop vóór F5b.** Volgend voorstel: dezelfde foundation in updatebijlagen en Academy opnemen (HTP-29/30), met vooraf gecontroleerde echte bestanden/leesversies en expliciete rubriekmapping; Toolbox blijft bij zijn eigen inhoudsbesluit.
