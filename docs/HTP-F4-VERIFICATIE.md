# F4 — Mux-bediening, posters en hervatten

17 oktober 2026. **F3b gepubliceerd via [PR #72](https://github.com/6ftwardje/HTP2.0/pull/72), main `2c103b6c31e7450d21fcd973a2533d824102c620`. F4 uitsluitend lokaal uitgevoerd en geverifieerd. Stop vóór F5a.**

[Centraal scrumboard](https://github.com/users/6ftwardje/projects/3) · [Complete backlog](HTP-BACKLOG.md) · [Fasenplan](HTP-FASENPLAN.md) · [Video-/voortgangscontract](HTP-F4-CONTRACT.md).

## Besluit, scope en omgeving

Ward keurde F3b-publicatie en daarna lokale F4-uitvoering goed. D10 is expliciet beantwoord: **“95% voor weergave; bestaande lesgates behouden (aanbevolen)”**. De nieuwe bereikte videovoortgang geeft dus ‘Bekeken’ weer, terwijl bestaande completion-actions, `progress.watched`, `weekly_update_views`, intake-, module- en examengates hun huidige betekenis behouden. De hoogste bereikte positie is een presentatie-indicator, geen bewijs dat elke seconde bekeken of beluisterd is. Vanaf 95% volgt geen automatische lesafronding of unlock.

Branch **`codex/htp-f4-local`**, managed worktree `/Users/wardjanssen/.codex/worktrees/htp-f1-release/Het Trade Platform 2.0`, vanaf genoemde main. Backend/migratie/tests **`9e5f9f7`**, speler/UI **`edc7a6f`**, herhaalbare browserproeven **`b8aba40`**. Deze F4-commits zijn niet gepusht; geen F4-PR of remote migratie.

Lokale productiebuild op [Marktinzicht](http://127.0.0.1:3118/market-analysis), Supabase `htp-f2-local` (API 64321 / Postgres 64322), geïnstalleerde Chrome en mobiele emulatie. Synthetische free-/Academy-accounts, twee testupdates en twee opeenvolgende lessen. Bestaande public Mux-media uitsluitend gelezen; provider-/analyticswrites geblokkeerd. De toonproef gebruikt lokaal gegenereerde media via browserinterceptie en uploadt niets. Geen nieuwe dependencies, configuratie, productiecontentwijzigingen, betaalde verwerking of betaalactivering. De oorspronkelijke vuile werkmap is behouden; alleen planningsdocumenten worden daar veilig gespiegeld.

## Taken en resultaat

| Taak | Gecontroleerd resultaat / bron |
|---|---|
| [HTP-18 / #74](https://github.com/6ftwardje/HTP2.0/issues/74) | `MarketPostContents`, les-/updatewrappers, `VimeoPlayerCore` en `MuxLessonPlayer` geven de bestaande thumbnail door als poster. Geldige custom poster is vóór eerste Mux-render beschikbaar; ontbrekende/kapotte afbeelding valt terug op de providerposter. Geen extra speeloverlay die focus/bediening overneemt. Signed-tokenpoort blijft vóór Mux-mount; playback-, thumbnail- en storyboardtoken blijven doorgegeven. |
| [HTP-21 / #75](https://github.com/6ftwardje/HTP2.0/issues/75) | Zes snelheden: 0,5/0,75/1/1,25/1,5/2, zichtbare bediening inclusief mobiel, voorkeur per gebruiker, veilige opslagweigering en accountwisseling. Native pitchcorrectie waar ondersteund. Mux-controllerhotkeys uit; eigen Space/±10s/M/F alleen bij passende spelerfocus. Invoervelden/native knoppen/sliders worden ontzien; één sprong, statische terugmelding en reduced-motion behouden. |
| [HTP-22 / #73](https://github.com/6ftwardje/HTP2.0/issues/73) | Additieve `video_positions` met exacte eigenaar en één les/update, unieke sleutels, vaste Mux-identiteit zonder JWT, gevalideerde positie/duur/hoogste positie en revisie. RLS leest alleen eigen actuele toegankelijke video’s; writes uitsluitend via geauthenticeerde RPC met toegangs-/versie-/boundscontrole. CAS, sessie/volgnummer en idempotente retries voorkomen stille conflicten. Bestaande watched-historie blijft intact. |
| [HTP-23 / #76](https://github.com/6ftwardje/HTP2.0/issues/76) | `use-video-position` slaat circa iedere 10s en bij pauze op; bij >1× korter naar rato, 5s bij 2×. Pauze tijdens een lopende write bewaart daarna alsnog het laatste sample. Eén write tegelijk, maximaal drie pogingen met backoff, expliciete herstel-/overnameknop. Nieuwe sessie biedt hervatten of opnieuw beginnen; expliciet hoofdstuk/URL heeft voorrang. `VideoProgressProvider` en gedeelde thumbnailcomponenten tonen balk/Bekeken in bestaande feed/hero/dashboard-/vervolgkaarten en Academy-leslijsten. |

Alle vier **Done voor de geverifieerde lokale scope**. Bord na synchronisatie teruggelezen: **49 unieke HTP-IDs, 25 Done / 15 Backlog / 8 Geblokkeerd / 1 Ready**, alle **67** bestaande bordkaarten behouden. De vier gekoppelde issues zijn afgesloten met afgevinkte criteria en bewijs. HTP-47 blijft Backlog voor integrale F10-acceptatie, HTP-48 Ready voor doorlopend bordonderhoud. HTP-19/YouTube-153 blijft historisch Geblokkeerd zonder getroffen video. Er is geen nieuwe collectie-app gebouwd; die bestaat nog niet en hoort bij F8. Legacy Vimeo/YouTube blijven bij hun bestaande gedrag; geen nieuwe live-acceptatie voor inactieve providers.

## Acceptatiebewijs

| Controle | Uitslag |
|---|---|
| Unit/API/render | **277 tests geslaagd; nul mislukt of overgeslagen.** Strikte invoer/origin/werkelijke Host, eigenaar/accountwissel, safe storage, hervatgrens en snelheidsinterval. Signed renderproef: geen token → geen Mux-mount; aanwezige drie tokens en poster onveranderd doorgegeven. Bestaande suite blijft groen. |
| SQL en migratie | Additieve migratie lokaal toegepast en herhaald; rollback-only SQL-suite geslaagd. Eigen/vreemde/anon/ingetrokken rechten, directe writes geweigerd, ongeldige duur/NaN/positie, versievervanging, dubbele/oude requests, CAS/takeover, verwijderde authgebruiker, 95%-grens en oude watched-timestamp gecontroleerd. Nieuwe opslag wijzigt geen bestaande completion- of toegangspolicies. |
| Werkelijke browserflows | **13 controlegroepen** met echte Mux-playback: poster, zes snelheden, pause/reload/resume, URL-voorrang, focus-/select-/fullscreenbediening, tiensecondenopslag, twee browsers en expliciete overname, mobiele storageweigering, 95% zonder volgende les, Academy-balken en ingetrokken toegang/vervanging. Echte gelijktijdige API-writes leveren één winnaar en één conflict. |
| Fouten/lifecycle | **10 extra groepen**: vertraagde ACK plus pauze bewaart de nieuwste positie, 2×-timer rond vijf seconden, drie retries zonder lus plus expliciet herstel, tabsluiten/laatste ACK, kapotte/ontbrekende poster, signed fail-closed zonder lokale signingkey, einde-video unlockt de volgende les en accountwisseling scheidt snelheid/positie. |
| Pitch | Werkelijk native media-element achter Mux met synthetische 440Hz-HLS. Bij alle zes snelheden gemeten circa **438,74Hz** met pitchcorrectie aan; negatieve controle 0,5× met correctie uit circa **220,72Hz**. Dit is een objectieve Chrome-meting, geen handmatige luistertest of garantie voor alle browsers. |
| Beeld/bediening | **24 gevallen**, video/les/feed/Academy × desktop 1440/tablet 834/mobiel 375 × licht/donker. Eén batched review en één bevestigingsronde. Geladen Mux-speler, hervatten, zichtbare mobiele snelheid, thumbnailvoortgang en bestaande compositie gecontroleerd; geen documentoverflow of ongehanteerde paginafouten. Bestaand badge-/gedimdtekstcontrast in de geraakte leszijbalk gericht hersteld. |
| Contrast | **1.720 actieve tekstfragmenten, nul gedetecteerde AA-tekstcontrastfouten** in de bevestigingsronde. Afbeeldingen en providerinterne controls vallen buiten deze vlakke tekstmeting; geen volledige onafhankelijke WCAG-/screenreader-audit. |
| Technisch | TypeScript, lint en lokale productiebuild geslaagd; alleen bestaande img-waarschuwingen. Bestaande transcriptiebacklogcheck geslaagd (17 geldige slices), whitespacecontrole groen, mechanische designscan nul bevindingen. |

Lokaal bewijs onder `output/playwright/htp-f4/`: `unit.log`, `typecheck.log`, `lint.log`, `build.log`, `sql.log`, migratielogs, `browser-results.json`, `extra-results.json`, `browser.log`, `extra.log`, `visual/`, `contact-sheet.png`, `design-scan.json` en `board-final-status.json`. Privéaccounts, sessies, media-inventaris en keys blijven buiten Git en het bord.

Tussentijdse harnesscorrecties betroffen herhaalbaar resetten van beide synthetische gebruikers en het afwachten van play-promises. Alleen bovenstaande finale resultaten zijn bewijs. Een echte origin/Host-afwijking in de lokale Next-runtime en pauze tijdens een lopende write zijn in de implementatie gecorrigeerd en gericht hergetest.

## Herhalen en herstel

Met de bestaande private synthetische fixtures en loopback-server gestart:

```bash
LOCAL_SUPABASE_ENV_FILE=/privé/lokaal.env \
HTP_F2_FIXTURE_FILE=/privé/accounts.json \
HTP_F4_FIXTURE_FILE=/privé/f4.json \
node scripts/verify-htp-f4.mjs
```

Daarna dezelfde variabelen voor `node scripts/verify-htp-f4-extra.mjs` (toonproef vereist lokale `ffmpeg`, maakt zo nodig 12s HLS in genegeerde output). Scripts weigeren remote app-/databasehosts en niet-synthetische accounts. De hoofdproef reset alleen posities/completion van deze twee lokale F4-fixturelessen/-updates; de extra proef test daarna de bestaande ended-completion. SQL-suite draait met `psql -v ON_ERROR_STOP=1` tegen de lokale container en eindigt in rollback.

Veilige herstelroute bij een latere release: eerst oude applicatieversie terugzetten; de additieve tabel kan blijven staan zonder oude leerdata te wijzigen. Een destructieve schema-rollback pas afzonderlijk beoordelen en na export van de nieuwe posities uitvoeren; nieuwe RPC’s/policy/cleanuptrigger/tabel zijn afgebakend, bestaande `progress`/views/entitlements worden niet teruggeschreven of herberekend. De historische remote baselinepoort #28 blijft apart open; deze lokale proef is geen remote migratiebewijs.

## F3b-release en stoppoort

[PR #72](https://github.com/6ftwardje/HTP2.0/pull/72) is na groene policy, CI, verse database-/chatintegratie en Netlify-preview gesquasht naar main **2c103b6**. [Main-CI](https://github.com/6ftwardje/HTP2.0/actions/runs/39063500834) en [main-policy](https://github.com/6ftwardje/HTP2.0/actions/runs/39063501878) zijn groen; release-issue #71 Done.

**Beperkingen:** pagehide/visibility/unmount is best-effort; een procescrash, netwerkuitval of apparaatuitval kan de laatste onbevestigde positie verliezen. Er is geen onbeperkte offline queue. Een conflict vraagt expliciete keuze. Signed-gates/tokens zijn lokaal gecontroleerd, maar geen live signed-accountlevering zonder lokale signingkey. Browserbewijs betreft Chrome en mobiele emulatie, geen fysieke iOS/Safari-/Firefox-acceptatie. Mux-playback-id identificeert media; vervang die bij andere media. Een gewone herstart verlaagt de hoogste bereikte voortgang niet.

**Bewust niet uitgevoerd:** F4-push/publicatie, remote schema-/datawijzigingen, nieuwe providers, absolute beveiligingsclaims, PDF’s/F5a en latere fasen, nieuwe dependencies/configuratie of betaalcutover. **Stop vóór F5a.** Volgend voorstel: eerst HTP-25 PDF-contract en afgebakende proef (D7/D8) beoordelen; pas binnen expliciet goedgekeurde scope volgen opslag, watermark en viewer. Er zijn geen open F4-productbesluiten.
