# F2 — Lokale uitvoering en verificatie

17 oktober 2026. Ward keurde F2 uitsluitend lokaal goed: **alleen het belletje, openen op klik behouden**. De in-scope criteria zijn gecontroleerd. **Stop vóór F3a.**

[Scrumboard](https://github.com/users/6ftwardje/projects/3) · [Backlog](HTP-BACKLOG.md) · [Fasenplan](HTP-FASENPLAN.md).

## Releasegrens en commits

F1 plus HTP-49 staan op main **1067df4**, via [PR #51](https://github.com/6ftwardje/HTP2.0/pull/51). CI inclusief chat-/database-integratie is geslaagd. Het volledige kaartvlak is in de schone lokale productiebuild getest met muis en Enter, desktop/mobiel en licht/donker: één focusbare link per kaart.

F2 staat uitsluitend lokaal op **codex/htp-f2-local**, vanaf die main-commit, in `/Users/wardjanssen/.codex/worktrees/htp-f1-release/Het Trade Platform 2.0`. De oorspronkelijke vuile werkmap is behouden. **Geen F2-push, F2-PR, productie-uitrol of remote databasewijziging.** De lokale gebruikersscope gaat voor de repositoryaanbeveling om vroeg een PR te openen.

| Lokale commit | Resultaat / taak |
|---|---|
| ebcf8d5 | meldingenmodel, 30-dagenteller, paginering en SQL-bewijs; HTP-09/10 |
| 602ec4e | bronopen-lezen na autorisatie en ontbrekende inhoud; HTP-10 |
| e74b2b4 | accountmenu, bovenbalk en uitsluitend bel; HTP-07/08/11 |
| a0d3734 | dashboardbasis en passende carrousel; HTP-39 |
| 695eb8c | legacyfilters en querycompatibiliteit; HTP-06 |

Packages, lockfile, Next-config, compilerconfig, env-bestanden en bestaande assets zijn ongewijzigd. Lokale testconfiguratie en synthetische data staan onder `/tmp`.

## Opgeleverd gedrag en bronpaden

Zijbalk: Dashboard → Academy → Mentorchat, of Studentvragen voor echte mentorrollen → Marktinzicht → Live marktsessies volgens de bestaande toegangspoort. Onderin avatar+naam met Profiel, Admin alleen voor niveau 3, Hulp en Uitloggen. Bestaande chatdraftschoonmaak behouden. De gedeelde bovenbalk heeft bel/thema van 44 × 44 px, ook op chat-, admin- en meldingenroutes, zonder overlap.

De bel opent alleen op klik. Badge rood/wit, 9+ vanaf tien en weg bij nul. Vijf recente items, type-iconen, relatieve datum, ongelezenpunt en verwijderen zonder navigatie. Het overzicht sorteert ongelezen eerst, daarna gelezen, elk op aanmaakdatum/ID aflopend. Gelezen is gearceerd en gedimd via kleur met leesbaar contrast. Eén inhoudsactie, apart verwijderkruis; geen Openen/Gelezen-knoppen. Alles-gelezen werkt voor de volledige eigen zichtbare set.

`archived_at` is soft delete per ontvanger. De badge telt eigen zichtbare ongelezen niet-verwijderde deliveries tot **30 × 24 uur** oud. SQL gebruikt 720 uur; de UTC-fallback blijft rond zomertijd gelijk. Oudere deliveries blijven gepagineerd bereikbaar. Bestaande event-/recipient-RLS en participantrollen blijven autoriteit; typepresentaties verlenen geen nieuwe rechten of campagnes.

Bronlezen gebeurt bij daadwerkelijke clientmount na de paginapoort voor updates, getoonde livesessies en toegestane modules/lessen. Prefetch en de preview openen schrijven niets. Chat houdt zijn zichtbare public-sequence-contract. Ontbrekende inhoud krijgt Nederlandse feedback en een dashboardlink; null-href krijgt expliciete feedback en blijft herstelbaar.

Het dashboard verbergt lege beheerblokken, zet drie secundaire beheerlinks bovenaan en behoudt composer/mentorvragen/leeractie. De rail past één/twee/drie hele kaarten in de beschikbare breedte en ondersteunt pijlen, toetsenbord en touch. Legacyroutes behouden marktfilter, dubbele querywaarden, tijdparameter en hash. Het bewaren van `?t=` belooft nog geen seekgedrag: provider-/hoofdstukwerk blijft F3a/F3b.

Bronnen: `components/AccountMenu.tsx`, `PlatformTopbar.tsx`, `AppShell.tsx`, `components/admin/AdminShell.tsx`, `components/notifications/*`, `lib/notifications.ts`, `lib/notification-policy.ts`, `app/actions/notifications.ts`, `components/SourceNotificationRead.tsx`, protected meldingen-/bron-/not-found-pagina’s, `RecentMarketUpdatesFeed*` en de twee nieuwe F2-migraties.

## Databasebaseline en behoud

De bestaande lokale database (54321/54322) had vier synthetische F1-accounts en een afwijkend migratieregister. Privé-backup `/tmp/htp-f2-before.dump` (0600). Dertien ontbrekende main-migraties waren geïnventariseerd. Zeven zijn additief toegepast; daarna botste de bestaande `chat_mentor_config` met een niet-geregistreerde chatmigratie. De keten is gestopt zonder die tabel te verwijderen of een reset. Die historische afwijking is niet als opgelost gemarkeerd.

F2 gebruikt daarom de afzonderlijke, ongebonden lokale Supabase-omgeving **htp-f2-local**, API `127.0.0.1:64321` / Postgres `64322`. De volledige gereleasete main-keten plus twee F2-migraties is daar toegepast met synthetische accounts. Onuitgebrachte publieke/email-migraties uit de oorspronkelijke werkmap zijn uitgesloten.

Voor een toekomstige rollback: herstel de vorige main-definitie van `get_my_notification_shell` en verwijder de nieuwe page/source-RPC’s en pagineringsindex. Behoud events, recipients, `read_at` en `archived_at`; draai gebruikersstatus niet blind terug. Productiebaseline en migratie-uitrol vergen een afzonderlijke opdracht.

## Uitgevoerd bewijs

| Controle | Uitslag |
|---|---|
| Tests | **241 geslaagd, 0 mislukt/overgeslagen**; bestaande toegangsacceptatie voor beide betaalmodi met gemockte providers. Nieuwe SourceRead-boundary alleen in toegestane content. |
| TypeScript/lint/build | geslaagd; lint alleen bestaande img-waarschuwingen. Bestaande backlogpolicy: 17 slices geldig. |
| Meldingen-SQL | 65 deliveries; exact 29/30/31 dagen en andere tijdzone, read/delete, paginering zonder gaten/dubbels, typen, volledige bulk, andere ontvanger/event intact, anoniem geweigerd, idempotent bronlezen. Teruggedraaid. |
| Bestaande chat-SQL | alle drie suites privacy/routing, e-mail/read-races en profielen/presence geslaagd en teruggedraaid. Onafhankelijke RLS-orakel aangepast aan vijf items/type/leeftijd; privacyasserties behouden. |
| Authenticated integratie | gratis A/B, mentor en niet-betrokken admin; historische staff-overdelivery verborgen. Exacte RLS-vergelijking; lokaal warm shellmaximum 5,2 ms. Tijdelijke fixtures/routing hersteld. |
| Meldingenbrowser | 65 items, 0/1/9/10/9+, vijf preview-items zonder lezen, soft delete zonder navigatie, event/andere ontvanger intact, transportfout+retry, null-href, bulk over alle pagina’s en >30 dagen, twee tabs, dubbele events en reconnect zonder documentreload, leegstaat. |
| Terugval/fouten | oude RPC-shape met testteller 999 afgewezen; ontbrekende page/source-RPC gebruikt correcte queries. Bronretry en SQL-laadfout/herstel getest; geen fout als lege inbox. |
| Bronlezen | update/live/module/les en zichtbaar chatbericht; geen read bij prefetch/preview, refresh idempotent, ontoegankelijke/ontbrekende bron direct ongelezen. Meldingklik leest en toont bij verdwenen bron de beschikbaarheidsmelding. |
| Account/header | 8 menu-/rol-/breedtegevallen, 10 header-/chat-/admin-/mobielgevallen; Escape/pijlen/focusherstel, gelijke controls en geen overlap. Vijf aparte rollen ook in lokale betaalsimulatie, met de hieronder benoemde activatiegrens. |
| Dashboard | nul versus vier vragen/vier concepten/drie sessies; lijsten begrensd tot drie; beheerknoppen, hele railkaarten, pijlen en keyboard op drie breedtes. Gevulde toestand na leegstaatbeelden hersteld. |
| Oude routes | 18 rol-/routegevallen, gratis/afgeschermd, filter/query/hash behouden; externe providerrequests geblokkeerd. |
| Beeldronde | **66 combinaties** op 1440/768/375, beide thema’s, 6 popupmetingen en account-/drawerstaten; geen ongehanteerde paginafouten. Twee mobiele overflowgevallen in bestaande studententabel gevonden en hersteld met relatieve scrollcontainer. |
| Bevestiging | **16 gerichte gevallen**, nul overflow/paginafouten/actieve-tekstcontrastfouten; **1.252 tekstfragmenten**. Eerste ronde: 3.708 fragmenten, twaalf observaties waren semantisch uitgeschakelde paginalinks (contrastvrijstelling); deze zijn ook uit de tabvolgorde gehaald. Ruwe resultaten bewaard. |
| Overige bediening | native swipe, reduced motion, drawer-focuslus/body-scrollherstel, 200%-equivalent (720 CSS-/1440 fysieke pixels), native video-fullscreen-probe zonder shellcontrols. Geen echte providerplayback of fysieke-deviceclaim. |
| Designscan | afgerond, **0 bevindingen**; screenshots visueel bekeken. Geen volledige onafhankelijke WCAG-audit. |

Bewijs: `output/playwright/htp-f2/verification-summary.json`, `behavior-results.json`, `visual/` (78 PNG’s), `confirm/` (17 PNG’s), `route-matrix.csv` en gerichte JSON-/testlogs.

Reproduceren: `LOCAL_SUPABASE_ENV_FILE=/privé/lokaal.env HTP_F2_FIXTURE_FILE=/privé/fixtures.json HTP_F2_BASE_URL=http://127.0.0.1:3118 node scripts/verify-htp-f2.mjs`. Het script weigert remote hosts/accounts buiten `example.invalid`, maakt tijdelijke fixtures en herstelt de bestaande fixturestatus.

## Bekende activatiegrens en stop

De primaire preview gebruikt de huidige **slapende betaalmodus**. Een extra lokale simulatie met `PAID_PRODUCTS_ENABLED=1` bevestigt dat de UI-poort een niveau-1-abonnee met entitlement herkent. Main-migratie `20260922020000_restore_level_two_content_access.sql` houdt de database echter **bewust** op niveau-2-toegang voor private updates/livesessies. De niveau-1-abonnee krijgt in die gemengde simulatie dus geen private update of sessiedata. Dit is de bestaande product-/schema-activatiepoort uit [#28](https://github.com/6ftwardje/HTP2.0/issues/28), geen geslaagde end-to-endbetaaluitrol. De cutover is niet geactiveerd of stil gerepareerd. Voor betaalrelease moeten serverflag en bewezen RLS-cutover samen worden goedgekeurd/getest.

Niet uitgevoerd: productie-/externe datawrites, betalingen, e-mailverzending, provideracceptatie/YouTube-153-herstel, F3a-marktcontract of latere fasen. Reviewdata/media zijn synthetisch; geen nieuwe assets nodig voor F2.

De zeven F2-taken zijn **Done voor de goedgekeurde lokale scope**. HTP-47 heeft dit deelbewijs maar blijft open voor F10; HTP-48 blijft de faseoverdracht ondersteunen. [Lokale preview](http://127.0.0.1:3118/notifications). Inloggegevens uitsluitend lokaal in `output/playwright/htp-f2/LOCAL-ACCESS.md` (0600).

**F3a en iedere volgende fase wachten op afzonderlijke expliciete goedkeuring.**
