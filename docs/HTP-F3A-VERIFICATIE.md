# F3a — Marktcontract en Mux-bewijs, lokaal

17 oktober 2026. Ward heeft F2-publicatie en daarna uitsluitend lokale F3a goedgekeurd. **F2 staat op main 64f31369314f6a57c5a0fc1911460e476e2b44fc via [PR #60](https://github.com/6ftwardje/HTP2.0/pull/60). F3b is niet gestart.**

[Centraal scrumboard](https://github.com/users/6ftwardje/projects/3) · [HTP-12 #61](https://github.com/6ftwardje/HTP2.0/issues/61) · [HTP-20 #62](https://github.com/6ftwardje/HTP2.0/issues/62) · [Complete backlog](HTP-BACKLOG.md).

## Omgeving en grenzen

Branch `codex/htp-f3a-local`, vanaf gereleasete F2; dezelfde geïsoleerde managed worktree. Productiebuild op `http://127.0.0.1:3118`, lokale Supabase **htp-f2-local** API 64321 / Postgres 64322. Alleen synthetische accounts en lokale datawrites. De oorspronkelijke vuile werkmap en oude Supabase-stack zijn behouden. Geen dependency-, configuratie-, billing-, RLS- of productie-databasewijziging.

F2: PR-policy, CI (tests/types/lint/build/audit), verse Supabase/chat-integratie en Netlify-preview waren groen vóór squash. De CI op de daadwerkelijke main-merge is eveneens geslaagd. Release-issue #59 is Done. De twee F2-migraties zijn gecommit; remote database-uitrol blijft afzonderlijk onder de vastgelegde baselinepoort #28. De clientfallback op de bestaande RPC-baseline is in F2 geverifieerd. Dit rapport claimt geen productie-database-uitrol.

Ward verduidelijkte tijdens F3a: **Vimeo en YouTube worden niet meer gebruikt; alle nieuwe video-updates lopen via de gekoppelde Mux-integratie.** Read-only inventaris van de geconfigureerde contentdatabase: vijf updates, alle vijf Mux, gereed en public playback. Geen nieuwe Mux-assets/upload/sync/instellingen of betaalde verwerkingscalls. Browserproeven lezen bestaande Mux-media; API-/analyticswrites zijn geblokkeerd. Playback-ID’s en accountcredentials blijven buiten Git. Vimeo/YouTube-afhandeling blijft in de code voor eventuele historische inhoud; geen nieuwe proef of vervangingsframework voor die providers.

## HTP-12: expliciet compatibiliteitscontract

| Begrip | Autoriteit en mapping |
|---|---|
| Markten | `weekly_updates.markets`: geordende, gededupliceerde lijst. Crypto `crypto`, Forex `forex`, Aandelen `stocks`, Goud `gold`, Commodities `commodities`, Trading `trading`. Historische `macro`, `indices`, `general` blijven afzonderlijk en kiesbaar; Algemeen wordt niet automatisch Trading, Macro wordt niet Fundamenteel, Commodities wordt niet Goud. |
| Oude categorie | `update_structure.version=1` en `category` blijven leesbaar. Nieuwe volledige formulierinzendingen projecteren hun eerste tag op `category`; `market` krijgt de eerste van de zes documentmarkten of null. Beide zijn compatibiliteitsvelden, geen volledige taglijst. Geen tweede marktarray in JSON. |
| Oude records/formulieren | `getUpdateMarkets` verenigt opgeslagen array, enkelvoudige markt en concrete structured categorie zonder de bron te muteren. De oude categorie Algemeen is bij aanwezige tags een paraplu. Oude formulieren zonder marktkeys behouden de opgeslagen tags; een expliciet leeg nieuw formulier geeft een fout. Bij nieuw oud-formaat general zonder tags blijft de historische Macro-default bestaan; nieuwe formulieren kiezen expliciet. |
| Soort inhoud | `weekly_updates.type` blijft `weekly_outlook` / `market_update` / historische `live_session`; `content_format` blijft video/chart/text. Geen omzetting van bestaande typen. |
| Sjabloon / invalshoek | `update_structure.type` blijft setup/analysis/news/education; perspective blijft technical/fundamental/combined of null. Het document noemt sommige invalshoeken “type”; die worden niet als nieuwe markt of als vervanging van het bestaande sjabloon opgeslagen. |
| Week en hoofdstukken | `week_start_date`, afgeleid ISO-weeknummer en `period_label` hergebruikt. Bestaande weekdatum blijft exact gelijk bij opslaan. Bestaand `{title,seconds}` krijgt alleen optioneel `market`; geen parallel chaptermodel en geen AI-draftpublicatie. |

Nieuwe en oude editorpaden, quick composer, server actions, leden-/beheerfilters, detailtags en de bestaande dashboardprojectie gebruiken de volledige marktindeling. De vorm van de feed, navigatielagen, weekhero en sticky/actieve hoofdstukken blijven F3b. Oude `/updates/[market]`-queries matchen ook arraytags en historische structured categorieën vóór limit/toegangsfiltering.

Handmatige hoofdstukken blijven tekstregels `mm:ss Titel` / `hh:mm:ss Titel`; optioneel ` | marktcode`, bijvoorbeeld `12:40 Forex | forex`. Client, action en SQL bewaren het marktveld bij opnieuw openen/opslaan. Ongeldige minuten/seconden, negatieve/fractionele tijden, dubbele/aflopende tijden, onbekende markt, een markt buiten de geselecteerde tags, of een start op/na de bekende positieve videoduur geven een fout. Onbekende/0-duur leidt niet tot een verzonnen maximum. Oude hoofdstukken zonder markt blijven geldig. Defensieve leesprojectie negeert onbruikbare historische items zonder de opgeslagen JSON te herschrijven.

## Migratie, databehoud en herstel

`supabase/migrations/20261017120000_htp_f3a_market_contract.sql` verruimt alleen de bestaande markt-/structuurconstraints en voegt één chaptervalidator toe. Geen UPDATE van bestaande content. De migratie is tweemaal op dezelfde lokale baseline toegepast; checksum van alle bestaande updatekolommen én van de bestaande policies bleef gelijk:

- content voor/na: `48120112e5085c84cc653b40097bc19f`;
- policies voor/na: `53395da2bde7a36481888f08fe6c0564`.

Daarna zijn drie aanvullende lokale reviewfixtures aangemaakt. Alle veertien huidige lokale records voldoen aan de nieuwe hoofdstukvalidator. Een privé-dump van vóór F3a staat onder `/tmp` (0600).

De chapterconstraint is bewust **NOT VALID**: nieuwe/gewijzigde rijen worden direct gecontroleerd, eventuele ongeldige historische productierijen worden niet stil verwijderd of door een blinde validatie geblokkeerd tijdens uitrol. Voor een toekomstige release: inventariseer `not valid_market_chapters(chapters,video_duration_seconds,markets)`, beoordeel afwijkingen, controleer werkelijke schema-/RLS-baseline en valideer de constraint pas na correctie met inhoudelijke toestemming. Lokale nulmeting is geen bewijs over alle productiehistoriek.

Herstel: houd de additieve marktverruiming aan zolang nieuwe waarden bestaan; een oude enum terugzetten zou nieuwe tags blokkeren. Bij applicatierollback geen oude editor op nieuwe multi-marktcontent laten schrijven; eerst beheerwrites pauzeren en tag-/chapterexport vergelijken. Geen data of geschiedenis verwijderen. De geïsoleerde lokale omgeving kan vanuit de privé-dump worden hersteld; productieherstel vergt een eigen goedgekeurd plan. De historische baseline-/betaalcutover uit #28 is niet geactiveerd.

## HTP-20: providerbewijs

De actieve scope is Mux. De actuele officiële [Mux React API](https://www.mux.com/docs/guides/player-api-reference/react) beschrijft rate-/seekprops en callbacks; de [Mux controls/hotkeys-documentatie](https://www.mux.com/docs/guides/player-customize-look-and-feel) beschrijft focusgebonden bediening. De geïnstalleerde speler is **3.13.0**. Onderstaande runtimecontrole betreft bestaande public playback op de echte lokale app in geïnstalleerde Chrome; mobiel betekent Chrome-touch-/viewportemulatie, geen fysieke iPhone/Safari-acceptatie.

| Controle | Werkelijk resultaat / beperking |
|---|---|
| Snelheid API | 0,5 / 0,75 / 1 / 1,25 / 1,5 / 2 daadwerkelijk gezet en teruggelezen, desktop en mobiele emulatie. Dit is een tijdelijke proef, nog geen opgeslagen voorkeur. |
| Huidige knop/menu | Desktop toont de knop en menu-items `1x, 1.2x, 1.5x, 1.7x, 2x`. Slow rates ontbreken; bij 375px is de snelheidsknop verborgen. De API kan de gevraagde waarden wel uitvoeren. HTP-21 moet de eigen keuze-/weergave expliciet configureren; niet al in F3a opgelost. |
| Pitch | Het onderliggende HTML-video-element rapporteert `preservesPitch=true` op alle zes rates, in beide deviceklassen. Geen aparte akoestische meting of garantie voor onbeproefde browsers. |
| Seek/events | Bestaande hoofdstukknoppen 0/10/20 seconden plus opnieuw hetzelfde hoofdstuk: seek en play geslaagd. `timeupdate`, `seeked`, `ended`, `ratechange`, play/pause werkelijk ontvangen. Verifier wacht op controller-events; een propertyset is niet gelijk aan voltooide UI-synchronisatie. |
| Toetsen/focus | Links/rechts 10s, spatie, M, F werken met spelerfocus; focus in een invoerveld bedient de video niet. Geen nieuwe paginabrede shortcuts toegevoegd. |
| Fullscreen/controls | Fullscreen in geïnstalleerde Chrome en mobiele emulatie geslaagd; toegankelijke benoemde native controles geïnspecteerd. Fysieke iOS/Safari/Android en screenreader zijn niet apart geaccepteerd. |
| Poster | Automatische Mux-poster aanwezig. De bestaande wrapper geeft de update-thumbnail nog niet door: dat blijft HTP-18/F4. |
| Autoplay | Fresh-context `play()` was hier toegestaan. Dat is uitsluitend deze browseruitkomst, geen garantie voor mobiele browserpolicy. De productwrapper blijft zonder autoplay; hoofdstukstart na gebruikersklik is getest. |
| Account / beveiliging | Werkelijke huidige updates: vijf gereedstaande public Mux-playbacks. Deze proef accepteert geen nieuwe signed-media-/domainrestrictieconfiguratie; de bestaande guard blijft behouden. |
| URL-tijdstip / actief hoofdstuk | Alleen het bestaande knop-/seekcontract getest; geen URL-tijdstipimplementatie of actieve/sticky hoofdstukken toegevoegd. Dat hoort bij HTP-24/F3b. |

Vimeo/YouTube zijn per expliciet productbesluit geen actieve provider. Historische inventaris: de bestaande Vimeo-adapter gebruikt SDK seek/ended, de YouTube-iframe heeft geen gekoppelde IFrame API/events; vervangen daarvan valt buiten F3a. De officiële [Vimeo speed-help](https://help.vimeo.com/hc/en-us/articles/12426285015441-About-playback-speed-controls) beschrijft slow rates en zichtbare controls, terwijl [parameters](https://help.vimeo.com/hc/en-us/articles/12426260232977-About-Player-Parameters) en [SDK-documentatie](https://github.com/vimeo/player.js) aanvullende account-/embedbeperkingen noemen. Dat is geen bewijs van het HTP-account. De [YouTube API](https://developers.google.com/youtube/iframe_api_reference) laat ondersteunde rates per video opvragen; de [embedparameters](https://developers.google.com/youtube/player_parameters) beschrijven eigen toetsen. Geen account-/pitch-/autoplaygarantie voor inactieve providers. HTP-19/153 blijft een afzonderlijk historisch onderzoek, niet de blokkade van de huidige Mux-scope.

## Acceptatiebewijs en stop

| Controle | Bewijs en uitslag |
|---|---|
| Unit/action/access | **250 tests geslaagd, 0 mislukt of overgeslagen**. Alle vier sjablonen met meerdere markten, oude formulieromissies, expliciet leeg, ongeldige tags/tijden/duur en behoud van author/date/history/URL. Oude quick-composerlimieten blijven getest. |
| SQL/migratie/RLS | Tweemaal dezelfde migratie, nul content-/policywijzigingen; 27 markt × formatfixtures, oude/nieuwe hoofdstukken, malformed/null/duur, free/level2/admin en geweigerde non-adminwrites. Transactionele fixtures teruggedraaid; opnieuw succesvol op de inmiddels gevulde reviewomgeving. |
| Echte opslag | Structured video, historisch tekstbericht en weekvooruitblik via browser → server action → lokale DB; alle tags/hoofdstukken/typen/auteurs/datums/URLs/inhoud gelijk na opslaan. Leeg maken van weekmarkten en ongeldige chapterregel geven een fout zonder write. |
| Filters/toegang | Tien leden-/beheerfiltergevallen voor secundair Goud/Trading en Macro/Indices/Algemeen, plus gratis lijst/directe toegang geweigerd. Veertien gedraggevallen; dertien contract-/filtergevallen na de laatste formulierrandgevalcorrectie opnieuw bevestigd. |
| Mux | Twee deviceklassen, bestaand werkelijk account/public media. Zes rates + pitchflag, bestaande chapterclicks/herhaling, events/ended, focus-/invoerveldisolatie en fullscreen geslaagd. Controlsnapshots en matrix hierboven; geen garantie voor fysieke mobiele browsers of signed media. |
| Beeld/bediening | 24 combinaties van beheereditor/weekly editor/ledenfilter/detail × 1440/768/375 × beide thema’s, geen documentoverflow of ongehanteerde paginafout. Schermen visueel geïnspecteerd. Gerichte eindbevestiging van nieuwe markt-/chaptervelden: twaalf gevallen, keyboard-checkbox en 2px focusring; **3.012 actieve tekstfragmenten, nul contrastfouten**. |
| Build/policy | TypeScript, lint en lokale productiebuild geslaagd; alleen bestaande img-waarschuwingen. Backlogpolicy: zeventien slices geldig. Mechanische designscan: nul bevindingen. Geen volledige onafhankelijke WCAG-/screenreader-audit. |

Lokale commits: **726c615** (HTP-12 contract/editor/action/SQL), **6829c38** (HTP-20 Mux-/browserverifier). F3a is uitsluitend lokaal; deze commits zijn niet gepusht. Boardkaarten #61/#62 zijn Done voor de gecontroleerde lokale scope, niet voor publicatie. HTP-47 houdt integrale F10-QA open; HTP-48 blijft Ready voor de volgende faseoverdracht.

Bewijsmap `output/playwright/htp-f3a/`: `unit.log`, `typecheck.log`, `build.log`, `sql.log`, `migration-repeat.log`, `browser-results.json`, `contract-confirm-results.json`, `confirm-results.json`, controlsnapshots, 24 overzichtsbeelden en twaalf gerichte veldbeelden. De eerste gerichte inspectie vond een bestaande rode verplichte-veldster met onvoldoende contrast in donker; binnen de gewijzigde editor hersteld. Verifierdiagnostiek bewaart ook de tussentijdse selector-/eventvolgordeproblemen; alleen de genoemde finale resultaten gelden als acceptatiebewijs.

Reproduceren vanuit de managed worktree met de bestaande privé-fixtures:

```bash
LOCAL_SUPABASE_ENV_FILE=/privé/lokaal.env \
HTP_F2_FIXTURE_FILE=/privé/accounts.json \
HTP_F3A_FIXTURE_FILE=/privé/f3a.json \
node scripts/verify-htp-f3a.mjs
```

Het script weigert remote app-/databasehosts en niet-synthetische accounts. Bestaande Mux-playback mag worden gelezen; remote provider-/analyticswrites worden geblokkeerd. De browserfixture wijst naar de lokale synthetische records, niet naar productiewrites. Lokale review: [Marktinzicht met Goudfilter](http://127.0.0.1:3118/market-analysis?market=gold) en `/admin/market-analysis`. Inloggegevens uitsluitend in `output/playwright/htp-f3a/LOCAL-ACCESS.md` (0600).

Niet uitgevoerd: F3b-feed/weekhero/hoofdstukredesign, snelheidsvoorkeur of serverpositie uit F4, PDF’s, providervervanging, remote schemawijzigingen, betaalactivering, productie-datawrites, Mux-upload of verwerkingscalls. F3a wordt niet gepusht. **Stop vóór F3b; die fase vereist Wards expliciete goedkeuring.**
