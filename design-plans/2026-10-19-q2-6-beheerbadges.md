# Q2.6 — Afwijkingen zichtbaar, normale Marktinzicht-items rustig

Written against: `169e6ddfadb34b1cf4d2ca59d6bf546e52cded08` (main, 19 oktober 2026).
Status: goedgekeurd door Ward op 19 oktober 2026; issuekoppeling in het prioriteitenplan. Onderdeel van [het prioriteitenplan](2026-10-19-prioriteiten-en-issuekoppeling.md).

## Evidence chain

- Surface: `/admin/market-analysis` en de lijst van `AdminWeeklyUpdatesManager`.
- Problem: Wards observatie 3.4 benoemt vijf à zes badges. Main rendert achtereenvolgens media-, transcript-, publicatie-, toegang-, type-/markt-, classificatie- en archiefbadges in dezelfde titelrij.
- Design evidence: expliciete opdracht: alleen afwijkingen krijgen een badge, gepubliceerd/compleet is normaal.
- Owner/runtime: `components/admin/AdminWeeklyUpdatesManager.tsx`, functies `statusBadge`, `transcriptBadge` en lijstmap; deze component wordt door het bestaande beheerscherm geladen. Filters en editor zitten in dezelfde manager.
- Scope: lijstpresentatie en uitklapbare aanvullende filters; betekenis/publicatie/transcriptstatus blijven in bestaande modellen.
- Uncertainty: livegegevens en aantallen zijn niet in deze planning gelezen. Transcript ontbreekt kan normaal zijn, vooral wanneer nooit verwerking is gestart.

## Design decision

Een gewone gepubliceerde geldige update toont titel, thumbnail en rustige metadata; geen 'Klaar', 'Gepubliceerd' of 'Iedereen op platform'-badge. Gebruik badges uitsluitend voor toestand die aandacht vraagt. Behoud alle details en handelingen in de editor.

## Reuse

- `cb-badge`, huidige status-/accesslabelhelpers, `needsClassification`, `needsUpdateFollowUp`, `suggestsUpdateArchive` en bestaande `RelativeDate`.
- Exemplar: bestaande view 'Opvolging nodig' gebruikt al domeinlogica; maak geen tweede definitie van wat fout of onvolledig is.
- Hooguit een pure lijstprojectie voor meldingen; geen nieuw status-/transcriptmodel.

## Changes

1. Titelrij: geen normale succesbadges. Toon 'Concept', 'In verwerking', 'Verwerking mislukt', 'Nog indelen', echte opvolging en archiefsuggestie uitsluitend wanneer de bestaande predicate dat bewijst. 'Geen video' alleen bij een video-item dat die echt nodig heeft, nooit bij tekst/chart/PDF.
2. Geen transcript is geen standaardwaarschuwing. Alleen mislukte/gestarte verwerking of een concrete bestaande publicatievereiste geeft een uitzondering. Behoud transcript starten/review/AI-controls in de detail-editor; start geen externe verwerking.
3. Type, markten, auteur en datum naar gewone compacte metadata; toegang blijft in editor volledig expliciet, een afwijkend beperkte toegang kan in de lijst als gewone duidelijke metadata. Geen wijziging van `access_tier` of publicatiecriteria om een badge te laten verdwijnen.
4. Toon maximaal twee afwijkingsbadges in een lijstitem, in volgorde fout → onvolledig → verwerking → concept → overige opvolging. Bij meer: tekstknop '+n aandachtspunten' opent de bestaande editor waarin alle concrete toestanden benoemd staan. Geen verborgen blokkade zonder aanwijzing.
5. Zes bestaande views/tellingen behouden. Zoekveld blijft direct beschikbaar; categorie/type/auteur/setupstatus samen achter een knop 'Filters'. Bij actieve aanvullende filters altijd zichtbare samenvatting/aantal en 'Wis filters'; statusfilter alleen waar relevant. De ledenlijstdrempel van Q2.10 geldt hier niet.

## Scope

- Inherit: alle contentformats in deze beheerlijst.
- Verify: lege selectie, concept/publicatie, mediafouten, ontbrekende rubricering, beperkte rechten, actieve filters en het blijven selecteren/bewerken van hetzelfde item.
- Exclude: composer/publicatieflow herontwerpen, AI-/Mux-aanroepen, statuswaarden veranderen, historische content automatisch rubriceren/archiveren, F6-publicatie.

## Validation

- Product: gewoon gepubliceerd tekst/chart/video-item heeft geen succes-/standaardbadge. Een mislukte video of onvolledig item valt op en de editor legt oorzaak/actie uit.
- Interface: 0/1/3+ afwijkingen, lange titel, alle filters actief, desktop/mobiel/licht/donker. Geen titel verdrongen door een badgewand.
- System: alle bestaande predicates en acties behouden; afgesloten filters verliezen hun actieve waarden niet; wissen werkt.
- Repository: betekenisvolle tests voor afwijkingsprojectie/filterbehoud indien logica wijzigt; `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`, `npm run backlog:check` en relevante bestaande tests groen.

## Stop conditions

- Stop als een noodzakelijke uitzondering alleen kan worden bepaald door nieuwe productregels te verzinnen. Laat die metadata dan leesbaar in de editor en leg het ontbrekende contract vast; verander geen rechten of externe workflows.

## Design documentation

Na acceptatie uitzonderingsbeleid vastleggen onder HTP-48; `Refs #20`, `Refs #29`. Dit is presentatiewerk, geen afronding van open transcriptie-/AI-issues.
