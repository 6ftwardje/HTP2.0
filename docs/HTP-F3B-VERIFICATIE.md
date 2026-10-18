# F3b — Feed, weekvooruitblik en artikelvervolg

**Release-aanvulling 17 oktober 2026:** F3b is op Wards expliciete opdracht gepubliceerd via [PR #72](https://github.com/6ftwardje/HTP2.0/pull/72), main **2c103b6c31e7450d21fcd973a2533d824102c620**. PR- en main-CI, policy, verse database-/chatintegratie en Netlify-preview groen; release-issue #71 Done. Geen remote migratie of betaalcutover. F4 is daarna afzonderlijk lokaal goedgekeurd en geverifieerd; [actuele overdracht](HTP-F4-VERIFICATIE.md), **stop vóór F5a**. Onderstaande tekst bewaart de oorspronkelijke lokale F3b-acceptatie; de toenmalige stop-/publicatiezinnen zijn historisch.

17 oktober 2026. **F3a staat op main 0fd99e2ddd0c27440be9a0b9cc157951fbf9d703 via [PR #64](https://github.com/6ftwardje/HTP2.0/pull/64). F3b is uitsluitend lokaal uitgevoerd en gecontroleerd. Stop vóór F4.**

[Centraal scrumboard](https://github.com/users/6ftwardje/projects/3) · [Complete backlog](HTP-BACKLOG.md) · [Fasenplan](HTP-FASENPLAN.md) · [Ontwerpbesluit](HTP-F3B-ONTWERP.md).

## Goedkeuring, omgeving en afbakening

Ward vroeg F3a naar main te pushen en daarna F3b lokaal uit te voeren. Bij de twee vooraf getoonde kaartcomposities antwoordde hij: “Doe wat volgens jou het meest logisch is.” Gekozen: A, beeld links op 42% van de desktopkaart, compacte kaart voor dashboard/vervolg. Actueel/Open setups/Archief blijven tot F6, één inhoudsfilter Alles/Tekst & charts/Video en dynamische marktchips vanaf twee toegankelijke markten. Open update blijft zichtbaar binnen één volledige kaartlink. PDF krijgt pas in F5 een werkelijk format en actie.

Branch **codex/htp-f3b-local**, vanaf F3a-main, in de bestaande managed worktree `/Users/wardjanssen/.codex/worktrees/htp-f1-release/Het Trade Platform 2.0`. Applicatie/testcommit **8b503c6**, herhaalbare browserverifiers **6779c87**. Geen F3b-branch of commit gepusht en geen F3b-PR aangemaakt.

Productiebuild op [localhost Marktinzicht](http://127.0.0.1:3118/market-analysis), lokale Supabase **htp-f2-local** (API 64321 / Postgres 64322). Synthetische free-, Academy- en adminaccounts. De oorspronkelijke vuile werkmap en oudere lokale database zijn behouden. Alleen lokale fixture-, opslag- en editorwrites; bestaande public Mux-media zijn gelezen. Geen remote database-/providerwrites, nieuwe dependencies/configuratie, betaalde verwerking of betaalactivering. F3b introduceert geen databasemigratie.

## Gecontroleerde taken

| Taak | Resultaat en bewijs |
|---|---|
| [HTP-13 / #67](https://github.com/6ftwardje/HTP2.0/issues/67) | `lib/market-feed.ts` en `MarketInsightLibrary`: vaste marktvolgorde, instelbare `MIN_ITEMS_FOR_FILTERS = 0`, chips pas vanaf twee markten met gepubliceerde toegankelijke inhoud. Titel/samenvatting zoeken, één inhoudsfilter; charts horen bij tekst. Bestaande tabs en setupstatus blijven bereikbaar. Geen zichtbare teller; lege selectie biedt Toon alle updates en 1–2 resultaten een rustig vervolg. |
| [HTP-14 / #68](https://github.com/6ftwardje/HTP2.0/issues/68) | Gedeelde `MarketUpdateCard` over feed, dashboardrail en vervolg. Bestaande thumbnail, duidelijke fallback, decoratieve playoverlay, avatar/naam/relatieve tijd, tags rechts en neutraal type. Dun eerste-marktaccent, twee gereserveerde samenvattingsregels met fallback, één focusbare link zonder geneste acties. Native dashboardrail en reduced-motion blijven werken. |
| [HTP-15 / #69](https://github.com/6ftwardje/HTP2.0/issues/69) | Weekhero gebruikt alleen een echte gepubliceerde toegankelijke outlook in passende Actueel/Alles/markt-/zoekcontext; geen dubbele rij. Periode/marktlabels, eerlijke eerdere/komende week en geen lege hero. Marktlinks komen uitsluitend uit expliciet gemarkeerde gevalideerde hoofdstukken en openen `?t=seconden`. Brussel, DST en jaargrens getest. De sectiekop Marktinzichten impliceert geen onterecht tijdsfilter op oudere berichten. |
| [HTP-16 / #70](https://github.com/6ftwardje/HTP2.0/issues/70) | `followingMarketUpdates` kiest de eerstvolgende recentere publicatie, of de vorige bij de nieuwste, plus de recente outlook. Bij de huidige outlook komt een andere recente update. Alleen echte kandidaten, nooit eigen/dubbele/concept/ontoegankelijke inhoud; 0/1/2 kaarten toegestaan. `MarketFollowing` staat tussen Nuttig en de disclaimer, twee kolommen op desktop en gestapeld op mobiel. |
| [HTP-17 / #65](https://github.com/6ftwardje/HTP2.0/issues/65) | Legacy samenvatting/context optioneel in editor. Leeg verborgen, korte tekst als contextlabel, voldoende volledige zin als sectie. Structured kernboodschap blijft publicatievereiste en wordt niet dubbel als Samenvatting getoond. Gevulde takeaways zijn een echte `ol`; alleen korte voorloopnummering wordt genormaliseerd, geen decimalen, jaartallen of interne financiële waarden. Echte opslag bewaart body/HTML/intro/titel/auteur/publicatiedatum/marktvolgorde. |
| [HTP-24 / #66](https://github.com/6ftwardje/HTP2.0/issues/66) | Sticky rail waar desktopruimte beschikbaar is (vanaf 1280px); daaronder een inklapbare lijst direct onder de video. Actieve staat uit werkelijke timeupdate/seeked-events. Herhaalde klik krijgt een nieuwe seeknonce, URL-tijd wacht op metadata, legacyalias werkt. Ongeldig/buiten-duur geeft bruikbare feedback; browserweigering laat het tijdstip klaarstaan met handmatige afspeelinstructie. Geen hoofdstukken levert geen lege rail. Onondersteunde oudere provider toont leesbare tijden en uitleg in plaats van dode knoppen. |

Alle zes taken zijn **Done voor de geverifieerde lokale scope**, geen publicatieclaim. HTP-47 blijft Backlog voor integrale F10-acceptatie; HTP-48 blijft Ready voor doorlopend bordonderhoud.

## Databehoud en gevonden correcties

De editor herschikt bestaande geselecteerde markten niet meer op basis van de DOM-volgorde van checkboxen. Behouden markten houden hun opgeslagen volgorde; nieuwe selecties sluiten aan, verwijderde selecties blijven verwijderd. Dat beschermt ook het eerste marktaccent. Actie- en echte formulier/SQL-roundtriptests controleren dit.

Charts laden rechtstreeks met de browsersessie uit de bestaande beschermde route, zonder een afbeeldingsproxy die de sessie verliest. De videogradient ligt niet over de chart; oorspronkelijke kleuren en verhouding blijven behouden. De route controleert de ouderpost en diens werkelijke toegangsniveau: gepubliceerde gratis chart voor free toegestaan, afgeschermde chart geweigerd, concept alleen voor admin. Afbeeldingsfouten gebruiken de bestaande initialenfallback in plaats van een blijvende laadanimatie.

Feed-auteurs gebruiken de bestaande toegangsgestuurde `market_post_author`-RPC, gegroepeerd per gecrediteerde auteur/publicatienaam. Alleen naam, avatarpad en student-id worden geprojecteerd. De clientfeed ontvangt geen mentor-e-mailadres. Auteurssnapshots bij artikelen blijven behouden; avatarafhandeling en assetgates blijven van kracht. Vervolgkandidaten worden pas ná de toegangsgate van de geopende post geladen; geweigerde posts leveren geen kandidaten, enrichment of Mux-tokens op.

Titel-, intro-, byline- en prozastijlen en regellengte zijn behouden. Alleen de hoofdstukcompositie krijgt op brede desktop een buitenkolom. De zinconventie is conservatief: vier woorden met letters en eindleesteken, met veelvoorkomende eindafkortingen uitgesloten; dit is geen grammaticale of AI-beoordeling en herschrijft de inhoud niet.

## Acceptatiebewijs

| Controle | Uitgevoerd resultaat |
|---|---|
| Unit/action/access/render | **266 tests geslaagd; 0 mislukt of overgeslagen.** 1/5/30 items, 1/3 markten, content-/zoekcombinaties, 0/1/2 vervolgkandidaten, gelijke tijden, nieuwste/outlook/archief, financiële nummering, context/afkortingen, auteursprojectie en servertoegang. Rendererproef voor lege hoofdstukken en inactieve providerfallback. |
| Echte browserflows | Negen vastgelegde groepen: free/Academy-gates, hero/tijdlinks/geen duplicaten, filters/leeg/klein/archief/setup, volledige kaart via toetsenbord, artikelcontext/ol/vervolgfooter, lege/afkortingscontext, Mux seek/herhaling/actieve tijd/sticky, tijd-URL/alias/fallback en mobiele disclosure. Werkelijke editor → action → lokale SQL-opslag; ongeldige structured kernboodschap geeft fout zonder write. |
| Mux | Bestaande werkelijk geleverde public Mux-video op desktop en mobiele Chrome-emulatie; eerste/middelste/laatste hoofdstuk, hetzelfde hoofdstuk opnieuw, URL en actuele events. Autoplayweigering ook gecontroleerd met expliciete foutinjectie. Gepubliceerde enrichmentprojectie blijft van drafts gescheiden. |
| Charts/toegang/fouten | Echte lokale chartopslag en geauthenticeerde levering. Browserbeeld laadt, free chart **200**, betaalde chart voor free **403**, anoniem **401**, geen betaalde feedkaart bij free. Unitcases voor concept/missing/wrong-path vóór download. Geïnjecteerde thumbnailnetwerkfout toont fallback. Laatste gerichte chartcontrole bevestigt beide thema’s zonder videoschaduw. |
| Beeld/bediening | 24 combinaties van feed/video/artikel/dashboard × 1440/834/375 × licht/donker, geen documentoverflow of ongehanteerde paginafout. Eén gerichte eindbevestiging van zes scherm-/themacombinaties met geladen Mux, actieve focus en vervolgkaarten; daarnaast kaart/chart/fout/editorbeelden. Schermen en contactvellen visueel geïnspecteerd. Focusring 2px of sterker; mobiele chips scrollen binnen de eigen rij. |
| Contrast | **2.610 actieve tekstfragmenten**, nul gedetecteerde AA-tekstcontrastfouten over basis- en gerichte controle. Afbeeldingen en providerinterne controls vallen buiten deze tekstmeting; geen volledige onafhankelijke WCAG-/screenreader-audit. |
| Build/type/policy | TypeScript en lokale productiebuild inclusief lint geslaagd; uitsluitend bestaande img-waarschuwingen. Bestaande transcriptiebacklogcheck: zeventien unieke geldige slices. Diff-whitespacecheck groen; mechanische designscan nul bevindingen. |

Bewijs: `output/playwright/htp-f3b/` met `unit.log`, `typecheck.log`, `build.log`, `backlog-check.log`, `browser-results.json`, `contact-sheet.png`, `visual/`, `confirm/confirm-results.json`, gerichte beelden en `chart-final/results.json`. Tussentijdse testharnessproblemen met streaming-DOM, eventvolgorde en te exacte selectors/focusmetingen zijn gecorrigeerd; alleen de genoemde finale resultaten gelden als bewijs. Het brede beeldrondje bevat ook de laadstaat van de speler; de gerichte bevestiging controleert de daadwerkelijk geladen Mux-speler.

Herhalen met de bestaande privé-fixtures, vanuit deze worktree en met de loopback-app gestart:

```bash
LOCAL_SUPABASE_ENV_FILE=/privé/lokaal.env \
HTP_F2_FIXTURE_FILE=/privé/accounts.json \
HTP_F3B_FIXTURE_FILE=/privé/f3b.json \
node scripts/verify-htp-f3b.mjs
```

Gebruik dezelfde variabelen voor `node scripts/verify-htp-f3b-confirm.mjs`. De scripts weigeren remote app-/databasehosts en niet-synthetische accounts; bestaande Mux-delivery mag worden gelezen, provider-/analyticswrites zijn geblokkeerd. De lokale synthetische fixtureposts blijven beschikbaar voor review. Inloggegevens en sessies staan uitsluitend in de privé-/genegeerde lokale toegangsdossiers, niet in Git of het scrumboard.

## F3a-release en stoppoort

[PR #64](https://github.com/6ftwardje/HTP2.0/pull/64) is pas na groene PR-policy, CI, verse Supabase-/chatintegratie en Netlify-preview naar main gesquasht. De [CI op main 0fd99e2](https://github.com/6ftwardje/HTP2.0/actions/runs/39060732930) en [main-policy](https://github.com/6ftwardje/HTP2.0/actions/runs/39060733594) zijn eveneens geslaagd. Release-issue #63 is Done. De eerder vastgelegde remote database-/baselinepoort #28 is hiermee niet stilzwijgend opgelost of geactiveerd.

**Bewust niet uitgevoerd:** F3b push/publicatie, F4-posters/snelheidsvoorkeur/positieopslag/hervatten, nieuwe videoprovider, PDF’s, F6 pin-/zonebetekenis, dependencies/configuratie, remote schema-/datawijzigingen en betaalcutover. Vimeo/YouTube zijn inactief volgens Ward; behouden code en fallback zijn geen nieuwe live-provideracceptatie. De runtimeproef betreft public Mux en Chrome-emulatie, geen garantie voor alle fysieke browsers of signed playback.

**Stop vóór F4.** Er zijn geen nieuwe productbeslisvragen die de beoordeling van F4 blokkeren. Het voorstel blijft HTP-18/21/22/23 op basis van het Mux-contract: posterdoorgifte, passende snelheidsbediening en veilige hervatpositie. Start daarvan uitsluitend na Wards expliciete goedkeuring.
