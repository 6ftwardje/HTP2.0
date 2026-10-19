# Q2.4 — Eén Nederlandse naam en één canonieke link per beheerscherm

Written against: `169e6ddfadb34b1cf4d2ca59d6bf546e52cded08` (main, 19 oktober 2026).
Status: goedgekeurd door Ward op 19 oktober 2026; issuekoppeling in het prioriteitenplan. Onderdeel van [het prioriteitenplan](2026-10-19-prioriteiten-en-issuekoppeling.md).

## Evidence chain

- Surface: `/admin`, `/admin/videos`, `/admin/exams`, beheerzijbalk en mentor-inboxlinks.
- Problem: `app/admin/videos/page.tsx` toont 'Modules, lessons & media' en Engelse badges; `app/admin/exams/page.tsx` toont 'Exam management'. `AdminShell` noemt video's 'Lesvideo’s', overzicht noemt dezelfde route 'Modules en lessen'. Overzicht gebruikt `/admin/mentor-inbox`, zijbalk `/mentor-inbox`.
- Design evidence: Wards expliciete opdracht 3.1/3.2; directe presentatie-tegenspraak binnen dezelfde beheerroute. Geen nieuw ontwerp nodig.
- Owner: `components/admin/AdminShell.tsx`, `app/admin/page.tsx`, genoemde routeheaders en de routebereikte managers.
- Runtime: `AdminLayout` rendert `AdminShell`; overzichtslinks en de headers komen rechtstreeks uit de genoemde bestanden. `/admin/mentor-inbox/page.tsx` redirect naar `/mentor-inbox` met queryparameters.
- Scope: Nederlandse interfacecopy, gedeelde naamkeuze en nieuwe interne links.
- Uncertainty: 'Lesstoets' uit de liveobservatie komt niet overeen met de huidige mainzijbalk. Verifieer de uiteindelijke publicatie; neem de verkeerde labelstring niet als zoekvoorwaarde.

## Design decision

Gebruik hetzelfde schermlabel in zijbalk, overzicht en paginatitel. Behoud adressen en bestaande redirectcompatibiliteit. De vertaalscope bevat ook zichtbare badges, lege toestanden en bedieningscopy in de twee betrokken managers; interne provider-/veldwaarden blijven zoals ze zijn.

| Canoniek adres | Schermnaam |
| --- | --- |
| `/admin` | Platformbeheer |
| `/admin/videos` | Modules en lessen |
| `/admin/exams` | Examens |
| `/mentor-inbox` | Mentor-inbox |
| `/admin/students` | Studenten |
| `/admin/live-sessions` | Live marktsessies |
| `/admin/market-analysis` | Marktinzicht |
| `/admin/product-board` | Productbord |
| `/admin/documents` | PDF-beheer |

## Reuse

- Bestaande `PageHeader`, `SidebarNavItem`, `cb-badge` en Nederlandse interfacecopy als eigenaar.
- Exemplar: huidige Nederlandse kop-/beschrijvingcompositie van `/admin/live-sessions`.
- Geen nieuw navigatiesysteem nodig. Een klein gedeeld label-/routeobject mag alleen de werkelijk gedeelde linkmetadata bevatten; geen productbord- of routeherbouw.

## Changes

1. `app/admin/videos/page.tsx`: titel 'Modules en lessen'; Nederlandse eyebrow/beschrijving. Badges: `gereed`, `in verwerking`, `zonder video`, `lessen`, met passende enkelvoudsvorm. Beschrijving: 'Beheer modules, lessen, gratis toegang, volgorde, afbeeldingen en video-uploads.'
2. `app/admin/exams/page.tsx`: eyebrow 'Platformbeheer', titel 'Examens', beschrijving 'Beheer per module de vragenbank, antwoordopties en beschikbaarheid van examens.' Controleer `AdminExamManager` en `AdminContentManager` op werkelijk gerenderde Engelse UI-copy en vertaal die mee; Mux-/providernaam niet vertalen.
3. `AdminShell` en `app/admin/page.tsx`: gebruik de tabel voor schermlabels; korte taakbeschrijvingen blijven uitleggen wat je daar doet. Verander geen productbordinhoud of module-/examencompositie.
4. Nieuwe interne inboxlinks rechtstreeks naar `/mentor-inbox`. Behoud `/admin/mentor-inbox` als redirect inclusief queryparameters; niet verwijderen om 'één adres' af te dwingen.

## Scope

- Inherit: gerenderde beheerlinks naar genoemde schermen.
- Verify: rolfilter mentor-inbox, actieve navigatie, mobiel menu, bestaande directe URL's.
- Exclude: backendmeldingen buiten deze flows, productschemawaarden, productbordgedrag, vraagbank/editorlayout en modulevolgorde.

## Validation

- Product: admin vindt dezelfde schermnaam op alle drie ingangen; Engelse header/badges verdwijnen.
- Interface: 375/768/1440, licht/donker, 0/1/veel badges; lange Nederlandse teksten lopen niet buiten beeld.
- System: navigatierollen blijven zoals ze waren; legacy-inboxquery eindigt op dezelfde conversatie.
- Repository: `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`, `npm run backlog:check` groen; bestaande relevante tests draaien. Geen nieuwe test voor iedere vertaalstring.

## Stop conditions

- Stop wanneer een voorgestelde labelwijziging een andere schermfunctie blijkt te verbergen of een routerecht verandert.

## Design documentation

Na acceptatie dit naamcontract onder HTP-48 vastleggen. `Refs #58`, `Refs #57`; historisch Done niet heropenen. Eén nieuw Q2.4-issue/PR volgens CONTRIBUTING.
