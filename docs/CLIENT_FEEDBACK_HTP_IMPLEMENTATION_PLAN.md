# HTP klantfeedback - gefaseerd implementatieplan

Datum: 2026-06-17

Doel: de ontvangen feedback omzetten naar kleine, controleerbare fases. Elke fase moet los te testen en te releasen zijn, zodat visuele verbeteringen, notificaties, access-regels, content en profielbugs elkaar niet blokkeren.

## Samenvatting prioriteiten

1. Visuele basis: dashboard lichter maken, blauw/paars richting vorige platform, plus echte light mode.
2. Notificaties: rechtsboven tonen, automatisch openklappen bij nieuwe/ongelezen meldingen, maar gebruiker behoudt controle.
3. Weekly/video updates: duidelijke access-keuzes, "Iedereen" kunnen selecteren, en accounts notificeren bij nieuwe video update.
4. Module titels: dubbele "Module 1: Module 1:" weergave oplossen.
5. Profiel/intake: tijd per week correct tonen als "3-5", zelfinschatting correct tonen zonder "Nog niet ingevuld/5".

## Fase 0 - Voorbereiding en baseline

**Doel**  
Voorkomen dat we bugs fixen op basis van aannames. Eerst vastleggen hoe het platform vandaag werkt.

**Scope**
- Maak screenshots van de belangrijkste studentroutes in desktop en mobiel:
  - `/dashboard`
  - `/modules`
  - `/weekly-updates`
  - `/notifications`
  - `/account`
- Maak screenshots van adminroutes die geraakt worden:
  - `/admin/videos`
  - `/admin/weekly-updates`
- Inventariseer bestaande data:
  - modules met `id`, `order_index`, `title`, `slug`, `is_published`;
  - access levels van testaccounts: gratis, full course, admin/mentor;
  - bestaande weekly updates met `access_tier`, `is_published`, `published_at`.

**Technische aandachtspunten**
- Werk op een aparte branch.
- Databasewijzigingen alleen via migrations.
- Maak voor datafixes eerst een export of lijst van huidige module records.

**Acceptatiecriteria**
- Er is een korte baseline-notitie of checklist met wat exact getest moet worden na elke fase.
- We weten welke module titels de dubbele prefix tonen.
- We weten welk access-level model vandaag in productie/staging gebruikt wordt.

## Fase 1 - Theme refresh: lichter dashboard en light mode

**Doel**  
Het platform minder zwart maken en visueel dichter bij het blauw/paars van het vorige platform brengen, zonder leesbaarheid of dark mode te breken.

**Scope**
- Update globale theme tokens in `app/globals.css`.
- Maak een expliciete light/dark theme-aanpak:
  - default kan system preference volgen;
  - gebruiker kan handmatig light/dark kiezen;
  - keuze blijft bewaard, bijvoorbeeld via cookie of localStorage.
- Voeg een compacte theme toggle toe in de shell, bij voorkeur rechtsboven in de app-header/topbar.
- Pas dashboard-oppervlakken aan waar ze te zwaar/donker aanvoelen.
- Controleer componenten die theme tokens gebruiken:
  - `components/AppShell.tsx`
  - `components/SidebarNavItem.tsx`
  - layout components in `components/layout/*`
  - cards/buttons/badges in `app/globals.css`
  - notification popover
  - admin shell, voor zover tokens direct meeveranderen.

**Fail-proofing en edge cases**
- Geen harde `dark:` styling laten winnen van de nieuwe light mode waar dat niet de bedoeling is.
- Contrast minimaal WCAG AA voor body tekst, knoppen en badges.
- Geen flash of wrong theme bij pageload: theme vroeg op `document.documentElement` zetten.
- Embedded video/Mux/Vimeo surfaces moeten in light mode nog steeds rustig ogen.
- Mobiele topbar en sidebar moeten niet te fel of te laag contrast krijgen.
- Loading states en skeletons moeten in beide themes leesbaar blijven.

**Acceptatiecriteria**
- Dashboard oogt duidelijk lichter en gebruikt blauw/paars als accent.
- Light mode is beschikbaar en blijft behouden na refresh.
- Dark mode blijft bruikbaar, maar minder "pikzwart".
- Geen tekst verdwijnt door te laag contrast.

**Verificatie**
- Desktop en mobiel screenshots vergelijken met baseline.
- `npm run build`
- Handmatige test: theme wisselen, refreshen, uitloggen/inloggen.

## Fase 2 - Notificaties rechtsboven en automatisch openen

**Doel**  
Meldingen prominenter maken: rechtsboven, direct open wanneer er iets nieuws/ongelezen is, en gebruiker kan ze zelf wegklikken.

**Huidige situatie**
- `components/ui/notification-popover.tsx` toont nu floating notifications onderaan rechts.
- `components/AppShell.tsx` toont de popover op alle protected pages behalve `/notifications`.
- Realtime hook bestaat via `useNotificationsRealtime(currentStudentId)`.

**Scope**
- Verplaats floating notification UI naar rechtsboven.
- Op desktop: naast of onder de top-right app controls plaatsen.
- Op mobiel: rekening houden met de mobiele header en safe-area, zodat het paneel niet over menu/logo valt.
- Open de popover automatisch wanneer:
  - er ongelezen notificaties zijn bij initial render; of
  - via realtime een nieuwe notificatie binnenkomt.
- Sluitgedrag:
  - gebruiker kan buiten de popover klikken of Escape gebruiken;
  - na handmatig sluiten niet meteen opnieuw openklappen voor dezelfde notificaties;
  - bij een nieuwe notificatie mag hij opnieuw openen.
- Zorg dat notificatie-items een duidelijke `Open` actie hebben.
- Nederlandse labels consistent maken: "Meldingen", "Openen", "Alles gelezen".

**Fail-proofing en edge cases**
- Als notificatietabellen/migrations ontbreken, moet de UI stil degraderen en niet crashen.
- Niet automatisch markeren als gelezen alleen omdat de popover openklapt; lezen gebeurt via `Open`, `Gelezen` of `Alles gelezen`.
- Geen infinite open/close loop na `router.refresh()`.
- Bij meer dan 99 notificaties count blijven cappen.
- Notificaties zonder `href` moeten nog steeds geopend/gelezen kunnen worden zonder navigatiefout.
- Realtime reconnect of dubbele events mogen geen dubbele UI-items tonen.
- Op `/notifications` zelf geen floating popover tonen.

**Acceptatiecriteria**
- Bij ongelezen melding opent de popover vanzelf rechtsboven.
- Wegklikken blijft gerespecteerd tot er een nieuwe melding is.
- `Open` navigeert naar de juiste plek en markeert die melding gelezen.
- `Alles gelezen` werkt en refresh/reset de badge correct.

**Verificatie**
- Test met studentaccount met 0, 1 en meerdere ongelezen meldingen.
- Test realtime insert in `notification_recipients`.
- Test mobiel viewport rond 375px breed.

## Fase 3 - Weekly updates access en notificaties bij publicatie

**Doel**  
Admins moeten bij video updates duidelijk kunnen kiezen wie toegang krijgt, inclusief "Iedereen". Studenten die toegang hebben tot een nieuwe video update krijgen een melding.

**Huidige situatie**
- `weekly_updates.access_tier` ondersteunt nu: `free`, `full_course`, `premium`, `mentor_membership`.
- UI in `components/admin/AdminWeeklyUpdatesManager.tsx` toont een single-select met labels Free, Full course, Premium, Mentorship.
- RLS toont momenteel in ieder geval:
  - `free` aan authenticated users;
  - `full_course` aan studenten met `access_level >= 2`;
  - admin via admin policy.
- Notificatie-infrastructuur bestaat (`notification_events`, `notification_recipients`), maar weekly-update publicatie lijkt nog geen notificaties aan te maken.

**Scope**
- Beslis en documenteer access-betekenis in code en UI:
  - "Iedereen" = alle ingelogde accounts, inclusief gratis;
  - "Full course en hoger" = geen gratis accounts, bijvoorbeeld `access_level >= 2`;
  - "Mentorship/Premium" alleen als er een betrouwbaar access-level of tagmodel voor bestaat.
- Korte termijn optie: herlabel `free` naar "Iedereen (incl. gratis)" als dat functioneel al klopt.
- Voeg alleen een DB-migratie toe als er echt een nieuw access-type nodig is, bijvoorbeeld `everyone` of een doelgroepentabel.
- Maak een centrale helper voor doelgroep-resolutie:
  - publicatie zichtbaar voor student;
  - notificatie-ontvangers voor publicatie;
  - admin preview/labels.
- Maak notificatie-event aan wanneer een weekly update voor het eerst gepubliceerd wordt:
  - trigger op overgang `is_published: false -> true`; of
  - server action in `app/actions/admin/weekly-updates.ts` na succesvolle create/update.
- Maak recipients alleen voor studenten die volgens dezelfde access-regel toegang hebben.
- Gebruik `unique (event_id, student_id)` en een idempotente publicatie-check om dubbele meldingen te vermijden.

**Fail-proofing en edge cases**
- Publicatie bewerken mag niet elke keer opnieuw notificaties sturen.
- Draft -> published stuurt wel notificatie.
- Published -> unpublished -> published: productbeslissing nodig. Advies: alleen opnieuw sturen als admin expliciet "opnieuw notificeren" kiest.
- Slugwijziging na publicatie mag bestaande notification `href` niet laten breken; update href of voorkom slugwijziging bij gepubliceerde updates.
- Access wijzigen na publicatie:
  - geen automatische notificatie naar nieuwe doelgroep zonder expliciete actie;
  - wel zorgen dat zichtbaarheid direct klopt.
- Mux video nog `preparing`: publicatie moet of geblokkeerd worden, of melding moet pas verstuurd worden wanneer video klaar is. Advies: blokkeer publicatie of toon duidelijke waarschuwing.
- RLS en notificatie-recipient query moeten exact dezelfde doelgroep hanteren.
- Admin/mentor access-level 3 niet per ongeluk verwarren met betalende mentorship-studenten als dat dezelfde kolom gebruikt.

**Acceptatiecriteria**
- Admin kan ondubbelzinnig "Iedereen" kiezen.
- "Full course en hoger" sluit gratis accounts uit.
- Student met toegang ziet weekly update en krijgt melding bij nieuwe publicatie.
- Student zonder toegang ziet de update niet en krijgt geen melding.
- Publicatie-update maakt geen dubbele meldingen aan.

**Verificatie**
- Testaccounts:
  - gratis account;
  - full-course account;
  - admin/mentor account;
  - eventueel premium/mentorship account als dat bestaat.
- Publiceer een draft update en controleer:
  - rows in `notification_events`;
  - rows in `notification_recipients`;
  - badge/popover in student UI;
  - zichtbaarheid op `/weekly-updates`.

## Fase 4 - Dubbele module titel oplossen

**Doel**  
Moduletitels tonen niet dubbel "Module", bijvoorbeeld geen "Module 1: Module 1: Introductie tot Trading".

**Scope**
- Los dubbele module-labeling op:
  - als `title` al begint met `Module X:`, toon niet nog eens "Module X:" ervoor;
  - advies: data opschonen naar title zonder prefix en UI behoudt `eyebrow="Module X"`;
  - voeg eventueel helper toe zoals `formatModuleTitle()` of `stripModulePrefix()` voor bestaande data.
- Controleer plekken waar module titels getoond worden:
  - `app/(protected)/dashboard/page.tsx`
  - `app/(protected)/modules/page.tsx`
  - `app/(protected)/modules/[slug]/page.tsx`
  - `components/admin/AdminContentManager.tsx`

**Fail-proofing en edge cases**
- Slugs uniek houden; bestaande links niet breken zonder redirect of behoud van slug.
- `order_index` niet aanpassen voor deze fix.
- Data cleanup moet idempotent zijn: opnieuw draaien mag geen extra tekst verwijderen.
- Prefix stripping mag alleen het verwachte patroon verwijderen, bijvoorbeeld `Module 1:` aan het begin, niet willekeurige tekst midden in een titel.
- Admin UI moet duidelijk blijven: `eyebrow="Module X"` of volgordenummer mag bestaan naast een schone titel.

**Acceptatiecriteria**
- Geen module toont "Module X: Module X:".
- Modulecards blijven hun modulevolgorde tonen.
- Bestaande modulelinks blijven werken.

**Verificatie**
- Dashboard, modules overzicht en module detail visueel controleren.
- Admin contentmanager openen en module titels controleren.

## Fase 5 - Profiel/intake bugs

**Doel**  
Profielgegevens tonen menselijk en foutloos.

**Scope**
- Vervang generieke `formatIntakeValue()` voor intake-keuzes door expliciete label mapping:
  - `0_2` -> `0-2 uur`
  - `3_5` -> `3-5 uur`
  - `6_10` -> `6-10 uur`
  - `10_plus` -> `10+ uur`
- Zelfinschatting tonen als:
  - `1/5` t/m `5/5` wanneer `confidence_score` geldig is;
  - `Nog niet ingevuld` wanneer waarde ontbreekt;
  - nooit `Nog niet ingevuld/5`.
- Controleer onboarding-completion logic:
  - `hasRequiredIntake()` vereist confidence score;
  - `onboardingIsComplete()` moet niet per ongeluk complete tonen als confidence ontbreekt, tenzij `completed_at` bewust als bron van waarheid geldt.
- Controleer of de best-effort update van `confidence_score` betrouwbaar genoeg is. Als de kolom bestaat, fout loggen of opslaan laten falen wanneer confidence niet opgeslagen wordt.

**Fail-proofing en edge cases**
- Oude onboarding rows zonder `confidence_score` correct tonen.
- Onbekende legacy values tonen als nette fallback, niet als ruwe underscore-string.
- `confidence_score` buiten 1-5 nooit tonen als geldig.
- Profielpagina mag werken wanneer onboarding migration nog niet bestaat of data incompleet is.

**Acceptatiecriteria**
- Tijd per week toont `3-5 uur`, niet `35` of `3 5`.
- Zelfinschatting toont geen suffix `/5` bij ontbrekende waarde.
- Intake aanpassen en opnieuw opslaan werkt.

**Verificatie**
- Test met bestaande student met volledige intake.
- Test met oude/incomplete intake.
- Test onboarding opnieuw invullen en profiel refreshen.

## Fase 6 - Integrale QA en release

**Doel**  
Zeker zijn dat de fases samen geen regressies veroorzaken in auth, gating, theme of notificaties.

**Scope**
- Build uitvoeren.
- Handmatige smoke test:
  - login;
  - dashboard;
  - modules en module detail;
  - weekly updates overzicht/detail;
  - notifications popover en center;
  - account/intake;
  - admin weekly updates;
  - admin videos/content.
- Regressietest met minstens drie rollen/accounts:
  - gratis;
  - full course;
  - admin.
- Visuele test in:
  - desktop breed;
  - tablet;
  - mobiel 375px;
  - light mode;
  - dark mode.

**Fail-proofing en edge cases**
- Controleer RLS met echte non-admin accounts, niet alleen service role/admin.
- Controleer dat notificaties niet lekken naar studenten zonder toegang.
- Controleer dat theme preference geen server/client hydration warnings veroorzaakt.
- Controleer dat module titelfixes niet bestaande progress/exam results breken.

**Acceptatiecriteria**
- `npm run build` slaagt.
- Geen console errors in primaire studentflows.
- Geen access leak voor weekly updates.
- Geen dubbele notificaties bij gewone edits.
- Klantfeedbackpunten zijn een voor een afgevinkt.

## Aanbevolen volgorde van uitvoering

1. Fase 0: baseline en data-inventory.
2. Fase 5: kleine profielbugs eerst oplossen voor snelle klantwaarde.
3. Fase 1: theme/light mode als eigen release, omdat dit veel UI raakt.
4. Fase 2: notificatiepositie en auto-open gedrag.
5. Fase 3: access + publicatie-notificaties, inclusief DB/RLS-test.
6. Fase 4: dubbele module titel herstellen.
7. Fase 6: integrale QA en release.

## Open vragen voor klant/product

- Betekent "Iedereen" bij weekly updates: alle ingelogde accounts inclusief gratis, of ook publieke bezoekers zonder login?
- Bestaat er een apart betaald "premium" of "mentorship" studenttype, of is `access_level = 3` alleen admin/mentor?
- Moet een weekly update melding verstuurd worden zodra de update gepubliceerd wordt, of pas zodra de video verwerkt en afspeelbaar is?
- Als een gepubliceerde weekly update wordt aangepast, moet er opnieuw een melding uit?
