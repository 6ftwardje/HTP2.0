# HTP feedback: gefaseerd uitvoeringsplan

**Publicatieopdracht 18 oktober 2026:** Ward keurt F4/F5a naar main goed via [release-PR #84](https://github.com/6ftwardje/HTP2.0/pull/84) / [issue #83](https://github.com/6ftwardje/HTP2.0/issues/83). De actuele productbordrelease 4dd8206 is behouden. Gecombineerd: 298 tests, typecheck, lint en backlogcheck groen; hosted CI/verse database/preview worden vóór merge gecontroleerd en in de PR vastgelegd. F5b mag daarna uitsluitend lokaal; stop vóór F6. Hieronder beschreven eerdere stoppoorten en niet-publicatie gelden voor hun historische acceptatiemoment. Geen remote featuremigratie of betaalactivering inbegrepen.

18 oktober 2026. **D7/D8 expliciet geaccepteerd. F5a/HTP-25 t/m 28 lokaal uitgevoerd en geverifieerd; F4/F5a niet gepusht. Stop vóór F5b.** [Bord](https://github.com/users/6ftwardje/projects/3) · [Backlog](HTP-BACKLOG.md) · [Contract](HTP-F5A-CONTRACT.md) · [F5a-bewijs](HTP-F5A-VERIFICATIE.md).

Elke onderstaande fase/deelfase krijgt afzonderlijke goedkeuring. Een goedgekeurde fase geeft geen toestemming om de volgende automatisch uit te voeren. Bij extra scope of onopgeloste criteria terug naar Backlog/Geblokkeerd; geen stilzwijgende uitbreiding. Er zijn geen datums of uren beloofd.

## Keuze van volgorde

De PDF begint bij visueel systeem, feed, outlook en artikelvervolg. Dat blijft de richting, met vier technische aanpassingen:

1. Shell/navigatie en meldingen samen vóór feedwerk: dezelfde header, accountzone en badges hoeven dan maar één keer structureel te veranderen. Dashboard krijgt alleen de concrete opruiming die hierbij past.
2. Marktmodel en providercontrole vóór feed/outlook. Daardoor gaan Goud/multi-markt, weekhoofdstukken en bestaande setup-/pinstructuur niet verloren. Hoofdstukken worden meteen met feed/detail verbonden, niet na een tweede detailredesign.
3. Video-positie vóór retentie, en beschermde PDF's in twee afzonderlijk beoordeelbare deelreleases. PDF-ontwerp behandelt ook de ontbrekende Academy-rubrieken en toegankelijkheid; dit is geen kleine viewerplug-in.
4. Fout 153 krijgt vroeg een diagnose naast de visuele basis. Herstel volgt alleen met bevestigde oorzaak en goedgekeurde scope. Loginmedia kan wachten op assets; dit blokkeert de kernervaring niet.

HTP-48 (bord/besluitlog) loopt door elke fase; HTP-47 levert per fase de relevante verificatie en aan het einde de integrale controle. Tests worden per verandering uitgevoerd, geen eindeloze herhaling zonder nieuwe aanleiding.

## Algemene start- en afrondingspoort

**Voor starten:** Ward keurt de concrete fase goed; relevante besluiten vastgelegd; benodigde assets aanwezig; actuele branch/commit/lokale wijzigingen opnieuw geïnventariseerd; taakinhoud en dependencies klaar. Maak bij uitvoering één issue per slice en behoud draft-ID/bordkaart volgens `CONTRIBUTING.md`; status In uitvoering vóór codewerk, WIP 1 per uitvoerder.

**Bij datamodellen:** eerst gerichte controle van werkelijk toegepast schema, constraints, policies en featureflags in de afgesproken testomgeving. Historische baselinekwestie [#28](https://github.com/6ftwardje/HTP2.0/issues/28) niet blind oplossen door alle migrations opnieuw te draaien. Maak een additieve migratie en herstel-/databehoudplan; geen productie-uitrol als impliciet deel van een lokale featureopdracht.

**Per fase afgerond:** ieder in-scope criterium aantoonbaar gecontroleerd, relevant typecheck/build en gedrags-/SQL-/browserbewijs opgeslagen met datum, commit, omgeving, rol en fixture. Screenshots desktop 1440px/tablet 768px/mobiel 375px, beide thema's waar geraakt; keyboard/focus/AA/reduced-motion waar relevant. Auth, toegang en bestaande inhoud blijven werken. Taken pas Done na acceptatie; resterende onzekerheid expliciet Geblokkeerd/Te controleren. Release naar productie is een afzonderlijke handeling met passende opdracht.

## F1 — Visuele basis, behoud en gerichte diagnose

**Doel en taken:** gedeelde basis verfijnen zonder productstructuur te veranderen. HTP-01, HTP-02, HTP-03, HTP-04, HTP-05, HTP-48; HTP-19 uitsluitend diagnose. HTP-47 als verificatiepoort.

**Binnen:** behoudbaseline, donker als fallback met bestaande keuze gerespecteerd, gelijkwaardig licht, oppervlakken/tekst/actieaccent, zes markttokens/MarketTag, drie UI-kopniveaus en ritme, relatieve-datumutility en toepassing op bestaande lijsten, logoweergave zonder licht tegeltje. Identificeer de foutvideo voor 153 en leg bevindingen vast; ontbrekende reproductie-input blokkeert alleen die diagnose, niet het visuele pakket.

**Buiten:** nieuwe header/sidebar, meldingenlogica, feedlayout/filters, datamigraties, PDF's, loginvideo, artikeltypografieredesign en wijzigingen aan afhankelijkheden/hosting. Geen definitieve uitspraak over fout 153 zonder reproductie.

**Geraakt:** `app/layout.tsx`, `app/globals.css`, `ThemeToggle`, `Brand`, gedeelde layout-/typografiecomponenten; huidige dashboard-/Academy-/feed-/meldingenlijsten waar classes/datumopmaak worden toegepast. `AdminShell` en publieke/authsurfaces alleen controleren op directe tokenregressie; hun afzonderlijke stijl niet ongevraagd vervangen. Geen datamodel.

**Vooraf:** alleen D1 (Crypto amber/groen) blokkeert de gekozen MarketTag. Voor logo is geen nieuw asset nodig als de voorgestelde combinatie van het bestaande transparante icoon met themagekleurde merknaam wordt gebruikt; in de visuele acceptatie kan later een officiële full-variant worden gekozen. De overige hexwaarden zijn het documentvoorstel; AA-afwijkingen onderbouwen, niet verborgen aanpassen.

**Test en klaar:** HTP-01-baseline, themapersistentie/geen opslag/refresh/systeemfallback, relatieve tijd/DST, contrast/focus en screenshots van bestaande routes. Bewijs van behouden artikelhiërarchie/thumbnails/zoekgedrag en geen nieuwe datawrites. Klaar als HTP-01 t/m 05 aantoonbaar voldoen; HTP-19 heeft diagnose of eerlijk afgebakende vervolgtaak. **Afgerond en na goedkeuring gereleaset via PR #51.**

## F2 — Shell, meldingen en dashboardbasis

**Doel en taken:** één rustige navigatie-/meldingeningang en minder lege beheerblokken. HTP-06 t/m 11, HTP-39; HTP-48/47.

**Binnen:** bestaande routes verifiëren, avatar/accountmenu, adminzichtbaarheid, echte bovenbalk met gelijke controls, mobiele drawer, gedeelde meldingenbron/30-dagenteller/softdelete/typegegevens/bronopen-lezen, vijf-itempreview en overzicht met ongelezen eerst. Concrete dashboardopschoning (lege blokken, beheeracties bovenaan, bewuste railrand).

**Buiten:** bezoekmoment/nieuwregel, nieuwe moduledelivery als complete notificatiecampagne, mailherontwerp, nieuw dashboardconcept, marktmodel/feed en videoresume.

**Geraakt:** `AppShell`, `SidebarNavItem`, `useMobileDrawer`, `AdminShell`, protected layout; `notification-popover`, `lib/notifications`, eventvisibility/RPC/RLS/realtime en actions; `/notifications` met eventuele compatibele `/meldingen`-alias; dashboard/RecentMarketUpdatesFeed. Model: bestaande events/recipients/read_at/archived_at uitbreiden/hergebruiken waar nodig.

**Vooraf:** D4 besloten door Ward: alleen bel; huidig openen op klik behouden, geen auto-open. Typen mappen zonder private staff-/mentorinformatie breder zichtbaar te maken. Gerichte databasebaseline. Geen nieuwe assets.

**Test en klaar:** rollen en directe URLs, 0/1/9/10/>50 meldingen, 29/30/31-dagentelling, nul-href, verwijderen, directe bronopen, dubbele realtime-events/reconnect, fout/retry/ontbrekende migration, chatworkspace/mobile/safe areas en alles-gelezen over volledige set. Klaar als alle badges dezelfde waarheid tonen en notificatierechten/leeractie/composer intact zijn.

**Uitvoering F2:** HTP-06 t/m 11 en HTP-39 Done voor de lokale scope; 241 tests, SQL-/RLS-/browserbewijs, 66 beeldcombinaties en gerichte bevestiging in [F2-verificatie](HTP-F2-VERIFICATIE.md). D4 gesloten: alleen bel, openen op klik. Daarna op expliciete opdracht gereleaset via PR #60, main 64f3136, groene CI en verse DB-/chatintegratie. Ward heeft vervolgens F3a lokaal goedgekeurd. Geen remote database-uitrol. Betaalactivering blijft afzonderlijk onder #28/productbesluit.

## F3a — Marktcontract en providerbewijs

**Doel en taken:** gegevens en afspeelmogelijkheden helder vóór de nieuwe feed. HTP-12, HTP-20; HTP-47/48.

**Binnen:** expliciete mapping van markt/type/invalshoek voor legacy en structured posts; meerdere markten incl. Goud/Trading zonder verlies van macro/indices/historiek. Weekdatum/periode/hoofdstukken hergebruiken en markt aan hoofdstuk kunnen koppelen. Werkelijke provider/browser/accountmogelijkheden toetsen; Ward bevestigt tijdens F3a dat uitsluitend Mux actief is. Vimeo/YouTube behouden alleen hun bestaande legacyafhandeling.

**Buiten:** grote visuele feed, nieuwe zones/pincollecties, snelheids-/positieopslag en PDF's. Nog geen aannames over providerdefaults als implementatie presenteren.

**Geraakt:** `lib/types`, markt-/updatestructuurhelpers, editor/actions, `weekly_updates`-constraints/JSON-contract en gerelateerde queries. Providerwrappers alleen als afzonderlijk goedgekeurde proef, niet al een nieuw playerframework.

**Vooraf:** mapping bestaande categorieën en echte schema-/RLS-baseline; testmedia/provideraccount. Bij ontbrekende productbetekenis een mappingvoorstel voorleggen vóór migratie. Geen bestaande auteurs/publicatiemomenten/URLs of financiële labels herschrijven.

**Test en klaar:** oude/nieuwe updates met 1/meerdere markten, arrays/structured-save-roundtrip, SQL/actionvalidatie en databehoud; providerproef legt ondersteund/beperkt/onbekend vast voor poster/seek/snelheden/pitch/events/shortcuts. Klaar met geaccepteerd contract en beperkingenmatrix; daarmee kan F3b zonder gokken starten.

**Uitvoering F3a:** HTP-12 en HTP-20 Done voor de lokale scope. Contract 726c615, providerverifier 6829c38; 250 tests, herhaalbare additieve migratie zonder content-/RLS-writes, echte browser/action/DB-roundtrips en Mux-proef. 24 beeldcombinaties plus twaalf gerichte editor-/AA-/focusbevestigingen. Ward bepaalt dat Mux de enige actieve provider is. [Contract, beperkingen en volledig bewijs](HTP-F3A-VERIFICATIE.md). Daarna op expliciete opdracht gereleaset via PR #64, main 0fd99e2; PR- en main-CI groen. Geen remote databasemigratie. F3b is afzonderlijk lokaal goedgekeurd; D2/D3 zijn vastgelegd in het F3b-ontwerpbesluit.

## F3b — Feed, weekritueel en artikelvervolg

**Doel en taken:** de kernervaring herkenbaar en doorlopend maken. HTP-13 t/m 17, HTP-24; HTP-47/48.

**Binnen:** goedgekeurde eenvoudige navigatielagen/dynamische chips, gedeelde feedkaart met marktkleur/auteur/avatar/relatieve datum, grotere bestaande thumbnail, twee samenvattingsregels en één kaartactie. Weekvooruitblikhero met markt-timestamps, consistente lege/kleine-resultaatstaat. Twee relevante vervolgkaarten; hoofdstukken sticky/actief/mobiel inklapbaar; context/ol-takeaways herstellen, inclusief editor en legacycontent.

**Buiten:** huidige artikeltypografie vervangen, bestaande thumbnails opnieuw maken, reacties uitbreiden, videopositie opslaan, archiefgegevens verwijderen of nieuwe pin-/zonemodellen bouwen.

**Geraakt:** `MarketInsightLibrary` en CSS Module, gedeelde kaart/MarketTag, dashboardfeed waar gedeeld, Marktinzicht route/querys, `MarketPostLayout/Contents`, hoofdstuk-/seekverbinding en wrappers, update-editor. Modelaanpassing alleen voortbouwend op F3a, geen tweede chaptermodel.

**Vooraf:** D2/D3, twee voorgestelde thumbnailcomposities en goedgekeurde navigatiecombinatie. Werkelijke outlookinhoud, thumbnail en betrouwbare tijdstempels; zonder echte huidige outlook geen fictief weekblok. De beperkingenmatrix uit [F3a](HTP-F3A-VERIFICATIE.md) is leidend: alleen Mux actief, geen native garantie voor onbewezen browsers of signed media; slow-ratebediening en posterdoorgifte pas in F4; URL-seek hoort bij HTP-24 binnen F3b.

**Test en klaar:** 1/5/30 updates, 1/3 markten, beperkte rechten, lang/geen/legacy content, archiefcontext, 0/1/2 vervolgkandidaten; één focusbare contentlink, hoofdstukklik/actieve staat/timestamp-URL en oude aliases. Structuur en vrije artikels apart testen. Klaar als alle in-scope acties werkelijk werken; hero met dode marktlinks is geen afgeronde fase.

**Uitvoering F3b:** HTP-13 t/m 17 en HTP-24 Done voor de lokale scope. Variant A na gedelegeerde keuze van Ward; tabs blijven tot F6, Open update blijft binnen één kaartlink. Gedeelde kaart/feed, echte weekhero en veilige vervolgselectie, optionele artikelcontext/ol en Mux-hoofdstukken uitgevoerd. [Ontwerp](HTP-F3B-ONTWERP.md) · [Acceptatiebewijs en beperkingen](HTP-F3B-VERIFICATIE.md). Daarna op expliciete opdracht gepubliceerd via PR #72, main 2c103b6; PR-/main-CI en verse database-/chatintegratie groen. Ward keurde F4 afzonderlijk lokaal goed.

## F4 — Video: bediening, posters en hervatten

**Doel en taken:** langere video's bruikbaar in meerdere sessies. HTP-18, HTP-21, HTP-22, HTP-23; HTP-19 herstel alleen als diagnose dit rechtvaardigt; HTP-47/48.

**Binnen:** juiste poster waar ondersteund, langzame snelheden en voorkeur, pitch/zichtbare controls/shortcuts conform providerbewijs, eigen positieopslag en hervatten, bekekenmarkeringen/thumbnailbalken. HTP-19 blijft historisch geblokkeerd zonder getroffen video; geen onbewezen 153-herstel.

**Buiten:** dashboardretentie, PDF-leespositie, automatisch omzetten van alle video's naar één provider, hostingheaders aanpassen op vermoeden en onverwachte verandering van examengates.

**Geraakt:** gedeelde Mux/Vimeo/YouTube-wrappers, Lesson/WeeklyUpdate-autocomplete, actions, progresshelper/RLS en nieuwe of uitgebreide videopositieopslag, bestaande feed-/Academy-thumbnails. Collecties bestaan nog niet (F8). Bestaande watched-historie behouden.

**Vooraf:** D10 voor F4 door Ward besloten: 95% alleen voor weergave; bestaande completion-/les-/examengates behouden. Hoogste positie bepaalt Bekeken, geen bewijs van alle bekeken seconden. Revisieconflict stopt writes tot expliciete overname. Bezoek/updates-gevolgd-telling blijft F8; providerbeperkingen uit F3a. Gerichte migratiebaseline en testmedia. Bij ontbrekende externe mogelijkheden geen universele pitch-/autoplaygarantie.

**Test en klaar:** ondersteunde snelheden/pitch horen en zien; toetsen tijdens playerfocus en typen; voorkeuropslag geblokkeerd; twee apparaten, pauze/reload/offline/sluiten, vervangende video en ingetrokken toegang. Periodieke writes circa 10s; sluitflush best-effort. Geen heropening op onjuiste video/positie, geen nieuwe ontgrendellek. Fout-153-herstel alleen sluiten als werkende én getroffen video zijn vergeleken.

**Uitvoering F4:** HTP-18/21/22/23 Done voor de lokale scope op `codex/htp-f4-local`. Additieve eigenaarsopslag/versie/RLS, posters, zes snelheden, focusbediening, expliciet hervatten en gedeelde voortgangsweergave. Geen wijziging van oude completion-actions of gates. [Contract](HTP-F4-CONTRACT.md) · [Acceptatiebewijs en grenzen](HTP-F4-VERIFICATIE.md). Lokale migratie, geen remote uitrol of F4-push. **Stop vóór F5a.** Volgende voorstel blijft eerst HTP-25 PDF-contract/proef met D7/D8, daarna pas HTP-26/27/28 binnen expliciet goedgekeurde scope.

## F5a — PDF-fundament en gedeelde viewer

**Doel en taken:** een geteste, eerlijke PDF-keten voordat deze overal wordt ingebouwd. HTP-25 t/m 28; HTP-47/48.

**Binnen:** eerst ontwerp/proef en besluitpoort HTP-25. Daarna private objectopslag, geautoriseerde uitlevering, watermark, beperkt openlog en één herbruikbare viewer met zoom/paginanummers/sluiten/focus/loading/herstel. Proef omvat groot document en mobiel geheugen.

**Buiten:** volledige Academyherstructurering, productiecontentmigratie, alle updates al voorzien van bijlagen, Toolbox en absolute kopieerbeveiliging.

**Geraakt:** toekomstige private PDF-metadata/objectrelaties, routes/actions/storage/RLS, watermark-/logmechanisme en één viewer. PDF-library/worker pas kiezen na dependencyreden; geen nieuw pakket impliciet goedgekeurd omdat de PDF pdf.js noemt.

**Vooraf:** D7/D8: rechten/rubriekrelatie, grenzen/renderer, canvas zonder tekstlaag versus AA, toegankelijke route, naam/e-mail/datum in watermark en logbewaring. Synthetische documenten volstaan voor proef, echte cursusassets pas F5b. Na proef een expliciete ontwerpacceptatie vóór definitieve implementatie binnen deze fase wanneer de gekozen aanpak van het voorstel afwijkt.

**Test en klaar:** anon/verkeerde gebruiker/ingetrokken recht/draft/expired/range/cache verzoeken, geen cross-user watermark of publieke object-URL; grote/kapotte/versleutelde PDF, mobiel zoom/scroll, keyboard/assistieve route. UI-knoppen verbergen is geen bewijs van bescherming. Klaar als de werkelijke toegang en rendering aantoonbaar voldoen aan het gekozen contract en beperkingen zichtbaar gedocumenteerd zijn.

**Uitvoering F5a, 18 oktober:** Ward koos D7 bestaande rechten en D8 voorgesteld contract. HTP-25/#77, 26/#78, 27/#79 en 28/#80 lokaal Done: private opslag/toegang, serverwatermark/adminlog/werkelijke 30-dagenretentie, gedeelde viewer/zelfstandige semantische leesroute en beheer. [Contract](HTP-F5A-CONTRACT.md) · [Alle acceptatiecontroles/grenzen](HTP-F5A-VERIFICATIE.md). 284 tests, SQL, echte upload/HTTP/browser-/bron-/cronproeven en 24 schermgevallen. Uitsluitend lokale additieve migratie en noodzakelijke gemelde dependencies/assettracing; geen remote uitrol of push. **Stop vóór F5b.** Echte PDF’s/leesversies, rubricatiemapping en Toolboxinhoud zijn voor F5b nog te controleren; dit besluit keurt geen fictieve content of nieuwe abonnementen goed.

## F5b — PDF's in updates, Academy en Toolbox

**Doel en taken:** hetzelfde PDF-fundament op de juiste inhoudsplekken aanbieden. HTP-29 t/m 32; HTP-47/48.

**Binnen:** updatebijlagen inclusief tekst+PDF zonder video, feed/detail-openactie, additieve rubriek-modulemapping, Academytabs met URL-state en geen lege tabs, PDF-kaarten, beheer/upload/ordening/verwijderen, laatst gelezen pagina. Eenvoudige Toolboxlijst met PDF/link/bestand alleen wanneer inhoud en rechten zijn vastgesteld.

**Buiten:** calculators bouwen, nieuwe handelsinstrumenten, hele cursusinhoud schrijven, bestaande video-/modulevolgorde verwijderen en elke Toolboxdownload automatisch als beschermd PDF behandelen.

**Geraakt:** update-editor/publicatievalidatie, feed/detail, gedeelde viewer, Academyoverzicht/module/rubriekroutes, admincontent en metadata/rechten, per-gebruiker PDF-leespositie.

**Vooraf:** F5a aanvaard, D7 met rubriekmapping en rechten, echte PDF's/covers/titels/korte beschrijvingen/volgorde. Ontbrekende Toolboxinhoud mag als apart nog geblokkeerd deel buiten een expliciet verkleinde release blijven; dit besluit vastleggen, niet leeg als voltooid tonen.

**Test en klaar:** meerdere bijlagen, upload/publicatiefout, geen video, aparte kaart-/PDF-focusactie, gated assets en ingetrokken toegang. Tabs/URL/back/lege inhoud; rollen gratis/Academy/subscriber/legacy/admin, bestaande examens/voortgang/links en twee-apparatenleespositie. Klaar per expliciet goedgekeurde scope, met alle bijbehorende taken bewezen; geen stil overslaan van Toolboxcriteria.

## F6 — Zones, collecties en vindbaar archief

**Doel en taken:** setups als denkkader en leerzame content blijvend vindbaar. HTP-33 t/m 36; HTP-47/48.

**Binnen:** naam/statuscontract met behoud van bestaande entry/doelen/invalidering/historiek, zichtbare Ongeldig als in lijsten, actieve en alle afgelopen zones, beheer. Collectiepinning/volgorde/duur/echte voortgang; archief uit ledennavigatie maar in zoeken/directe links/admin behouden.

**Buiten:** signalendienst, automatische koop/verkoopacties, bestaande mislukkingen wegpoetsen of tijdelijke actuele pinposities stil omzetten in onbeperkte collecties.

**Geraakt:** updatestructuur/constraints/actions, workflowcontrols en editor, feedtabs/zoekselectie, routealiases, collectie/pinmetadata en beheer; gedeelde kaarten/MarketTags.

**Vooraf:** D5/D6; een expliciete reviewlijst voor niet-eenduidig te mappen historische statussen. Naam/slug pas wijzigen na besluit. F4 nodig voor echte gedeeltelijke videovoortgang in reeksen.

**Test en klaar:** vijf staten/transities en alle oude status+reasonvarianten, ongeldige/afgelopen/archived zones zichtbaar; meer dan twee pinned items in meerdere reeksen, reorderconcurrency; archiefzoekwoord vanuit standaardingang en oude directe links; non-admin rechten en neutrale statussen. Geen verdwenen historiek of fictieve voortgang.

## F7 — Loginmedia en éénmalige welkomervaring

**Doel en taken:** sterke eerste indruk met betrouwbare accountflows. HTP-37, HTP-38; HTP-47/48.

**Binnen:** loop/poster/gradient/copy links, bestaand formulier rechts en mobiele/reduced-motionfallback. Eenmalige welkommodal voor nieuwe accounts en heropenen via accountmenu.

**Buiten:** publieke homepage vervangen, authenticatie herschrijven, uitrollen naar bestaande gebruikers alsof ze nieuw zijn, nog niet aangeleverde media genereren.

**Geraakt:** login/StudentAuthForm en CSS, broninstellingen media, profieldatabase/state met cutovermigratie, welkomcomponent en accountmenu; authcallbacks alleen als de bestaande flow dit vereist.

**Vooraf:** D9, loopvideo+poster+welkomstvideo+definitieve tekst en goedgekeurde modalopbouw. Beide bronnen zijn configureerbaar. Deze fase kan pas starten wanneer assets beschikbaar zijn; overige fases wachten daar niet op.

**Test en klaar:** oude/nieuwe accounts rond cutover, meerdere tabs/apparaten, skip/einde/Escape/buitenklik/heropenen, focus; registratie/reset/invite/checkoutreturn/onboarding en offer-intent. Traag netwerk/autoplayblokkade/geen video/reduced-motion en mobiel; een defecte video blokkeert login nooit.

## F8 — Retentie op echte bezoek- en leesgegevens

**Doel en taken:** zien wat nieuw is en waar je gebleven bent. HTP-40 t/m 44; HTP-47/48.

**Binnen:** stabiele vorige-bezoeksnapshot en eigen item-openstatus, nieuwregel/labels, volgende module/rubriekkaart, replayketen, rustige voortgang per rubriek/maand en één Verder-kijkenkaart.

**Buiten:** gamification, nieuwe punten/streaks/badges, groot dashboardredesign zonder gesprek, aanwezigheid herdefiniëren en bekekenratio's verzinnen.

**Geraakt:** studentbezoek-/itemstatus, dashboardaggregatie/UI, feed/Academy/PDF-labels, modulefooter, livesessiequeries/kaart en replaylink. Video-/PDF-positie en rubriekmapping uit eerdere fasen hergebruiken.

**Vooraf:** D10/D11/D12: sessiegrens, gevolgd-definitie, nieuwlabelkleur en plaatsing naast de huidige leerhero. F4/F5b voor werkelijke progress/rubrieken/PDF. `last_seen` en chatpresence niet zonder bewijs als vorige bezoekmoment inzetten.

**Test en klaar:** nieuw account/twee bezoeken/refresh/twee apparaten, geopende labels weg, grenspublicaties/DST/maand, locked of verwijderd vervolg, laatste module/rubriek en geen beschikbare opname. Eén consistente telling, geen reset op pageload en geen dubbele primary CTA.

## F9 — Betekenisvolle reacties en beperkt beheerinzicht

**Doel en taken:** contentfeedback zonder commentruis. HTP-45, HTP-46; HTP-47/48.

**Binnen:** drie goedgekeurde betekenissen, configuratie max vijf, migratie huidige Nuttig, één reactie/wisselen/intrekken, drempelaantallen, optimistic rollback/motion en adminverdeling/minste reacties 30 dagen.

**Buiten:** comments, sociale feed, nieuwe individuele gedragsprofielen en conclusies over kwaliteit op basis van alleen absolute aantallen.

**Geraakt:** bestaande reactietabel/RPC/RLS, UsefulReaction/action en beperkt adminoverzicht. Player/tokens blijven stabiel tijdens reageren.

**Vooraf:** labels/emoji's/betekenissen en rapportselectie vastleggen bij deze fase; bestaande unique-key en aantallen behouden, databasebaseline controleren.

**Test en klaar:** eigen/andere reactie, wissel/intrek/dubbelklik/fout, 0/1/4/5 tellers, autorisatie en datamigratie, reduced-motion/keyboard, afspelende video onderbreekt niet; 29/30/31-dagenrapport en nulreacties correct.

## F10 — Integrale acceptatie en eventuele releasevoorbereiding

**Doel en taken:** geaccepteerde delen samen bewijzen. HTP-47; HTP-48 dossieroverdracht.

**Binnen:** ketentest van alle daadwerkelijk goedgekeurde/geleverde fasen, open punten expliciet reconciliëren, criteria/bewijs/bordstatus nalopen en release-/rollbacknotitie voorbereiden.

**Buiten:** nog niet goedgekeurde taken alsnog implementeren, ongeteste taken Done maken of zonder releaseopdracht productie wijzigen.

**Geraakt:** test-/bewijsdossier en planningsdocumenten; applicatie-aanpassingen alleen als nieuwe afgebakende reparatietaak met passende toestemming.

**Vooraf:** fasebewijzen beschikbaar en open restscope geaccepteerd. Geen automatische Done-overname uit bestaande MU/M1-issues.

**Test en klaar:** gehele rollen-/toegangs-/route-/device-/themematrix en belangrijkste foutpaden, met SQL/non-adminrequests waar relevant; typecheck/build en passende CI. Klaar wanneer de afgesproken scope aantoonbaar geaccepteerd is en beperkingen/restpunten traceerbaar zijn. Een afzonderlijke productie-uitrol wacht op de daarvoor gegeven opdracht.

## Besluit en fasepoort

**D1 besloten door Ward op 17 oktober 2026: Crypto wordt amber (`#E39B4B`). F1 mag lokaal worden geïmplementeerd en geverifieerd.** Zie [F1-uitvoering en bewijs](HTP-F1-VERIFICATIE.md).
Alle andere productbesluiten en ontbrekende media worden pas bij hun betreffende fase voorgelegd. Voor F1 wordt voorlopig bestaand transparant icoon + themagekleurde merknaam voorgesteld; geen nieuw logoasset nodig om die fase uitvoerbaar te maken.

Na lokale oplevering van F1 stopt het werk vóór F2. F1 geeft geen toestemming voor implementatie van een volgende fase of productie-uitrol.
