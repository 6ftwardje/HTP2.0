# HTP — prioriteiten en bouwplan na de livebevindingen van 19 oktober 2026

Status: **goedgekeurd door Ward op 19 oktober 2026; eerste bouwpakket lokaal geleverd, in review.**
Peildatum: 19 oktober 2026, Europe/Brussels.
Geschreven tegen actuele GitHub-main **`169e6ddfadb34b1cf4d2ca59d6bf546e52cded08`**.

## Hoofdadvies

De drie gemelde launchproblemen zijn inmiddels gericht behandeld in **[Q2.0 / #95](https://github.com/6ftwardje/HTP2.0/issues/95)** en **[PR #96](https://github.com/6ftwardje/HTP2.0/pull/96)**. Begin met een korte heracceptatie van die bestaande oplossing. Bouw daarna eerst betrouwbare naam-/telefoongegevens en uitsluiting van testaccounts, vervolgens het ledendashboard en de weekvooruitblik, daarna de beheer- en weergaveverbeteringen. Laat de lopende transcriptie-, retentie- en reactiebacklog daar niet tussendoor groeien.

Dit is een reconciliatie van de aangeleverde lijst met actuele issues, projectkaarten en broncode. Het is **geen nieuwe eigen livegebruikersproef of productie-data-audit**. Waar livebewijs wordt genoemd, komt dat uit PR #96 en het bijbehorende herstelverslag. De oorzaak van ontbrekende namen en de herkomst van achtergelaten herstelaccounts zijn nog niet bewezen.

## 1. Planningbaseline vóór groen licht

Rechtstreeks uit GitHub gelezen:

| Bron | Actuele stand | Betekenis |
| --- | --- | --- |
| Repository | 80 issues: 48 gesloten, 32 open | Open: 17 todo, 14 review, 1 blocked; geen issue in uitvoering aangetroffen. |
| [Bestaand Project 3](https://github.com/users/6ftwardje/projects/3) | 70 kaarten: 44 Done, 13 Te controleren, 9 Backlog, 3 Geblokkeerd, 1 Ready | Telt ook drafts; bevat niet alle repository-issues. Dit is geen percentage productievoltooiing. |
| F1–F5b | Release-PR's #51, #60, #64, #72, #84 en #90 samengevoegd | Applicatiefunctionaliteit gepubliceerd; productie-schema was niet volledig meegegaan. |
| Q2.0 | #95 gesloten; #96 samengevoegd op 19 oktober, 09:53 Brussel | Detail-/bijlagenherstel, contextlogging, thematische 404 en schema-preflight. CI op actuele main geslaagd. |
| F6, HTP-33 t/m 36 | #91–94 gesloten/Done voor **lokale** acceptatie | Niet op main gepubliceerd. Zones/collecties zijn dus niet automatisch live. |
| F7–F9 | Drafttaken HTP-37/38 en HTP-40 t/m 46 | Loginmedia/welkomstvideo, retentie en uitgebreidere reacties blijven afzonderlijke scope. |
| Integrale acceptatie | [#49 / HTP-47](https://github.com/6ftwardje/HTP2.0/issues/49) open | Eerdere faseproeven sluiten de integrale eindacceptatie niet af. |
| Historische databasebaseline | [#24](https://github.com/6ftwardje/HTP2.0/issues/24) review; [#28](https://github.com/6ftwardje/HTP2.0/issues/28) backlog | Q2.0 heeft alleen noodzakelijke ontbrekende migraties hersteld. Geen volledige reconciliatie. |
| Overige open lijnen | #2–16 transcriptie/AI; #17 dependencybaseline; #48 YouTube-153 geblokkeerd | Geen onderdeel van deze prioriteitenronde, behalve regressiebehoud. |

De 13 projectkaarten Te controleren zijn #18–24 en #29–34. Sommige implementaties zijn ondertussen via andere releases verschenen. Hun criteria moeten individueel worden herbeoordeeld; automatisch sluiten op basis van een latere release is onjuist. #17 staat bovendien open in de repository maar ontbreekt in deze Project-3-snapshot; ook #95 staat daar niet op. Het productbord is daardoor geen volledige repository-inventaris.

### Q2.0: wat is bewezen en wat niet?

`docs/MARKTINZICHT-HERSTEL-2026-10-19.md` op main beschrijft de bewezen oorzaak: ontbrekende `list_visible_pdf_documents` en PDF-tabellen, later ook ontbrekende `read_video_position`. De ouderpost was gepubliceerd en toegankelijk. Het probleem was een applicatie/schema-uitrolverschil, niet een noodzakelijk nieuw abonnement.

PR #96 rapporteert 309 geslaagde tests, typecheck/build, lokale rechten-/SQL-proeven, werkende ingelogde feed en alle vijf gepubliceerde detailroutes, werkende bijlagen-RPC, 404 in beide thema's en ontvangen contextlogs. De gerichte schema-uitrol staat beschreven. Er waren geen echte productie-PDF's: een geslaagde lege bijlagenlijst bewijst geen echte productie-upload/download. De algemene wens om alle relevante stille foutpaden te loggen is breder dan #95 en blijft Q2.1 hieronder.

## 2. Volledige koppeling van Wards lijst

Q2.1–Q2.10 zijn na Wards groen licht aangemaakt en aan bestaand Project 3 gekoppeld. De oorspronkelijke HTP-48-kaart is met behoud van item-ID omgezet naar #97 (repositorycode H1.48).

| Punt | Bestaande dekking | Besluit / uitvoerplek |
| --- | --- | --- |
| 1.1 Alle details falen | #95, #96; eerder #22 en HTP-17/#65 | Heracceptatie op bestaande oplossing; alleen bij bewezen regressie #95 heropenen of gericht regressieissue. Geen dubbele featuretaak. |
| 1.2 Bijlagenfout + stille catches | #95; bijlagenfeature HTP-29/#85 | Bijlagenherstel heracceptatie; bredere foutlogging in **Q2.1**. |
| 1.3 Lichte 404 | #95/#96 voegt `app/not-found.tsx` toe | Heracceptatie licht/donker; geen nieuw issue. |
| 2.1 Ontbrekende namen | Chatprofielen #42 verwant; geen eigen herstelissue | **Q2.2**, samen met telefoon en begroeting. Geen herbouw chat. |
| 2.2 Verplicht telefoonnummer | Kolom bestaat; registratie verzamelt het niet | **Q2.2**, één gezamenlijk profielaanvulscherm. |
| 2.3 Herstel-testaccounts | Geen specifiek bestaand issue | **Q2.3**: betrouwbare identificatie, serverfiltering, mailuitsluiting en testopruiming. |
| 3.1 Engels examens/video's | HTP-06/#58 en HTP-39/#57 beperkte voorgeschiedenis | **Q2.4**, zie [beheerbenamingen](2026-10-19-q2-4-beheerbenamingen.md). |
| 3.2 Drie namen / inboxalias | #58 beschermt oude links | **Q2.4**: nieuwe links canoniek; oude redirects behouden. |
| 3.3 Sessieformulier en oude datum | Bestaand sessiebeheer; HTP-43 is replayketen, andere scope | **Q2.5**, zie [sessieformulier](2026-10-19-q2-5-sessieformulier.md). Datum eerst reproduceren: main gebruikt al nu + 7 dagen. |
| 3.4 Te veel beheerbadges | #20 editor; #29 composer; workflowmodel bestaat | **Q2.6**, zie [beheerbadges](2026-10-19-q2-6-beheerbadges.md). Geen transcriptieherbouw. |
| 4.1 Kaart-/hoverkleur | HTP-02/#44 afgerond met expliciete oude waarden | **Q2.7**, gerichte nieuwe ontwerpbeslissing; [tokens](2026-10-19-q2-7-donkere-oppervlakken.md). |
| 4.2 Oud weekblok | HTP-15/#69 ondersteunt juist oude outlook met label | **Q2.8**: nieuw maximum één kalenderweek terug; ook op dashboard hergebruiken. |
| 4.3 Hele rij klikbaar | HTP-49/#50 en HTP-14/#68 geleverd | Behouden en testen; alleen zichtbare CTA verwijderen in **Q2.9**. |
| 4.3 Geen vulzin bij lege beschrijving | #68 vereiste inhoudsfallback / twee regels | **Q2.9**, [redactionele kaart](2026-10-19-q2-9-redactionele-kaart.md). |
| 4.3 Dubbel label Video | #68 / gedeelde `MarketUpdateCard` | **Q2.9**: alleen het generieke label Video weg; echte inhoudstypes blijven. |
| 4.3 Crypto-pill bij metadata | #68 plaatste tags expliciet rechts | **Q2.9**: alle markttags samen bij auteur/tijd, niet alleen Crypto verplaatsen. |
| 4.3 Zoekveld/Inhoud pas vanaf 12 | HTP-13/#67; archiefbehoud HTP-36/#91 lokaal | **Q2.10**, [kleine lijsten](2026-10-19-q2-10-kleine-lijsten.md). Archiefzoeken blijft bereikbaar. |
| 4.3 Welkom terug, rous | #34 dashboard; bron `displayFirstName` kapitaliseert niet | **Q2.2**: echte voornaam tonen, alleen presentatie kapitaliseren. |
| 4.3 Leeg ledendashboard | **#32 / MU-7** en **#34 / MU-9** staan al open | #32 uitvoeren/herverifiëren voor toegankelijke updates; Q2.8 levert weekblok; #34 rol-/layoutacceptatie. Geen derde algemeen dashboardissue. |

## 3. Conflicten en hoe we ze oplossen

1. **Nieuw verzoek versus eerder aanvaard kaartcontract.** #68 en `docs/HTP-F3B-ONTWERP.md` schrijven zichtbare Open-update-tekst, twee samenvattingsregels met fallback en tags rechts voor. Q2.9 vervangt precies deze presentatieregels. De hele-kaartlink en zelfstandige PDF-acties blijven. #68/#50 blijven historisch Done; nieuwe criteria horen in het vervolgissue.
2. **Nieuwe kleuren versus afgeronde F1.** #44 vereist `#161A21`/`#1D222B`. Goedkeuring van Q2.7 vervangt uitsluitend donker `--card` door `#1A1F29` en `--surface-hover` door `#232936`. Achtergrond, tekst, randen, marktkleuren en lichtthema blijven volgens de opdracht.
3. **Weekblok versus bestaande fallback.** #69 accepteerde oudere weken zonder leeftijdsgrens. Q2.8 begrenst dit tot de vorige Brusselse kalenderweek. Een beloofde verschijndag/tijd vereist echte redactieplanning; zonder die bron geen verzonnen publicatiebelofte.
4. **Kleine lijst versus vindbaar archief.** #67 houdt zoeken beschikbaar; lokale #91 maakt zoeken juist de toegang tot oude inhoud. Drempel 12 geldt voor de ongewijzigde actuele selectie vóór zoeken/inhoudsfilter, niet voor het resterende zoekresultaat. Een bestaande actieve zoekopdracht mag zijn bediening niet verliezen. Archiefzoeken blijft onafhankelijk beschikbaar. Q2.10 begint op main en integreert later met F6; het publiceert F6 niet.
5. **Dashboardcriteria spreken elkaar historisch tegen.** #32 zegt feed boven lesmodule; #34 zegt volgende leeractie én actualiteit in eerste viewport; #57 accepteerde de huidige leerbasis zonder groot redesign. Voorstel: compacte bestaande leeractie behouden, weekblok en recente inzichten direct erna; geen dubbele leer-CTA of lege tussencards. Dit is de expliciete nieuwe rangschikking voor #34, geen opdracht voor heel F8.
6. **Naamprobleem is nog een hypothese.** Registratie schrijft al `full_name` naar Auth-metadata. `ensureCurrentStudent` kopieert metadata alleen bij ontbrekende studentrij; bestaande lege rijen worden niet aangevuld en telefoon wordt niet gekopieerd. `StudentsTable` toont bij een lege naam `—`, niet Onbekend. Een opgeslagen placeholder of een ander aanmaakpad is dus mogelijk. Vergelijk livegeaggregeerde cohortgegevens en inspecteer de werkelijke Auth-trigger vóór de reparatie.
7. **Verplichte profielgegevens versus accountflows.** Een Auth-identiteit mag technisch bestaan tijdens verificatie/invite/herstel. Productregel wordt: geen normale platformtoegang zonder volledig profiel. Zet niet blind NOT NULL op historische rijen en breek geen password recovery. Het aanvulscherm is verplicht; de bestaande uitgebreide intake blijft een aparte flow. Welkomstvideo HTP-38 blijft uitgesteld.
8. **Testaccounts verbergen versus betrouwbaarheid aantallen/mail.** Alleen clientrijen filteren lost exports, tellingen en ontvangerselectie niet op. Gebruik dezelfde serverregel; verwijder geen accounts op een ruim e-mailpatroon. De exacte password-recovery-generator is in main niet aangetroffen; eigenaar/bron moeten worden gevonden.
9. **Done versus live.** F6 Done betekent lokaal geaccepteerd. Productieherstel #95 betekent niet dat Toolbox, volledige migratiebaseline of alle PDF-scenario's live geverifieerd zijn. Geen blanket `supabase db push`, betaalcutover of F6-push meesmokkelen.
10. **Werkmap versus bouwbasis.** Deze checkout staat op `codex/htp-f1-visual-basis`, HEAD `ce6b452`, met omvangrijk gewijzigd/ongetrackt werk; onder andere e-mailwerk dat niet op main staat. Voer het goedgekeurde pakket uit vanaf actuele main in een passende geïsoleerde checkout. Neem geen lokale features mee omdat ze toevallig hetzelfde bestand raken.

## 4. Uitvoerbare werkpakketten

### Voorstart — HTP-48 bestaand draft + heracceptatie #95

- HTP-48 blijft de eigenaar van backlog-/bewijsreconciliatie. Behoud de bestaande kaart bij omzetting naar een issue; verwar code HTP-48 niet met GitHub-issue #48 (dat is YouTube/HTP-19).
- Voeg na groen licht de gekozen Q2-issues toe aan bestaand Project 3, met relaties naar de bestaande issues. Nieuwe Q2-codes opnieuw op uniciteit controleren. Refs-relaties gebruiken, afgeronde historische issues niet heropenen voor gewijzigde voorkeuren.
- Hercontroleer #95 met lid met toegang, lid zonder toegang en admin: lijst→detail, directe CPI/FED-URL, ontbrekende slug, bijlagen zonder/met testdocument in lokale/previewomgeving, donkere/lichte 404. Toegangsmelding onderscheiden van technische fout.
- Lees actuele main en #95/#96 opnieuw. Bij teruggekeerd PGRST202 of renderdigest eerst incident herstellen; geen UI-verbetering als oplossing opvoeren.
- Bewijsrapport per taak: commit, omgeving, rol, synthetische fixture, resultaat, beperkingen. Geen productiepersoongegevens in het dossier.

### Q2.2 — Naam + telefoon + eenmalige profielaanvulling (M, eerste bouwprioriteit)

**Eigenaarbestanden:** `components/auth/StudentAuthFormCore.tsx`, `lib/students.ts`, `app/auth/{callback,confirm}/route.ts`, `lib/auth-redirect.ts`, `lib/supabase/middleware.ts`, `app/(protected)/layout.tsx`, `app/admin/layout.tsx`, `lib/admin/access.ts`, account-/chatprofielprojecties en `app/(protected)/dashboard/page.tsx`.

**Eerst bewijzen:** geaggregeerde aantallen ontbrekende/lege/placeholdernamen, metadata-met-naam versus student-zonder-naam, telefoonvulling en aanmaakpaden normaal/invite/import/service/legacy. Inspecteer werkelijke triggers/RLS; repo alleen bewijst de liveoorzaak niet. Houd aantallen en conclusies over; geen persoonslijst in GitHub.

**Implementatiecontract:**

1. Eén normalisatie/validatie voor naam en telefoon, gedeeld door registratie en serveractie. Naam trimmen, lege/uitsluitend witruimte/placeholder Onbekend weigeren; normale internationale namen behouden, geen verplichte twee woorden. Telefoon met landkeuze (standaard België, Nederland en internationale invoer toegestaan), op server valideren en als internationaal nummer opslaan. Formaatvalidatie betekent geen SMS-verificatie.
2. Registratie vraagt beide verplicht. `full_name` en telefoonmetadata opslaan en de bevestigde profielrij laten vullen via het bewezen bestaande aanmaakpad. Ook directe clients mogen geen bruikbaar compleet profiel met ongeldige velden aanmaken; wijzigingen blijven aan de eigen identiteit gebonden.
3. Alleen betrouwbare bestaande metadata automatisch gebruiken om een ontbrekende naam te herstellen; bestaande echte namen niet overschrijven en geen naam afleiden uit e-mail. Ontbrekende/ongeldige telefoon en resterende naam vragen in **één** verplicht scherm bij de volgende normale platformtoegang.
4. Maak een afgeschermde profielaanvulroute buiten de layout die volledigheid eist, zodat geen redirectlus ontstaat. Check server-side vóór beschermde inhoud in leden- en adminomgeving; relevante directe serveracties mogen de gate niet omzeilen. Auth-herstel/bevestiging, profiel opslaan en uitloggen blijven bereikbaar. Bewaar alleen veilige interne return-URL en bied die na succesvol opslaan aan.
5. Eén geslaagde persistente save voorkomt herhaling op refresh, tab of ander apparaat. Bij opslagfout blijven velden staan en blijft de gate actief; log volgens Q2.1. Geen aparte nieuwe intake of duplicaatwelkomstmodal.
6. Dashboard leest de echte eerste naam; hoofdletter van het eerste teken alleen in de begroeting, overige schrijfwijze behouden. Studententabel en mentor-inbox gebruiken de opgeslagen profielnaam; geen telefoon naar minimale chatprofiel-RPC's sturen.

**Klaar wanneer:** nieuwe normale registraties bewaren naam/telefoon na e-mailbevestiging; bestaande onvolledige leden vullen één keer aan; naam/telefoon staan daarna in beheerlijst en eigen profiel, naam ook in inbox. Historische leden die nog niet terugkeerden mogen nog onvolledig zijn: rapporteer dit eerlijk als migratierestgroep. Geen verzonnen namen om een nulmeting cosmetisch groen te maken.

**Verificatie:** registratie met directe sessie én bevestigingsmail, invite, legacy, herstel, OAuth alleen indien werkelijk ondersteund; profiel ontbreekt versus rij bestaat al; whitespace/placeholder/internationale naam/BE/NL/ongeldige telefoon; onbekende gebruiker; twee tabs; RLS vreemde student en behoud access_level/auth_user_id; veilige redirect/offer-intent; naam na save zichtbaar in tabel/inbox/dashboard. Unit/action/SQL/browserproeven waar relevant. Geen daadwerkelijke productiemail of persoonsbackfill tijdens lokale bouw.

### Q2.3 — Synthetische accounts uitsluiten en testlevenscyclus herstellen (M)

**Eigenaarbestanden:** `lib/admin/students.ts`, `app/admin/students/export/route.ts`, alle werkelijke studententellers/ontvangerselecties; gevonden herstel-testharnas. `scripts/verify-chat-features-production.mjs` is een voorbeeld van runmanifest en opruimcontrole, niet bewezen de bron van deze accounts.

1. Vind de generator van `password-recovery-check-<uuid>@…` en bijbehorende runregistratie. Maak een afgeschermde, exacte kandidatenlijst en controleer dat er geen betalingen, echte toegang, leerdata of echte gesprekken aan hangen. Bij ambiguïteit account niet als test classificeren.
2. Bouw een server-beheerde classificatie voor bewezen synthetische accounts. Voorgestelde opslag: aparte private relatie `student_test_accounts(student_id, run_id, created_at)`, uitsluitend beheer/service-toegankelijk en niet door de student wijzigbaar. Filter server-side vóór paginering/telling met dezelfde uitsluitingsregel in lijst, export en werkelijke ledenaantallen. Testaccounts kunnen hun eigen synthetische end-to-endflows blijven testen.
3. Sluit deze accounts ook uit vóór enqueue en vóór verzending van bestaande onboarding-/andere automatische mails; controleer al klaargezette jobs. Inventariseer welke mailflow echt live is. Het lokale `lib/email`/`app/api/email`-werk is geen toestemming om de e-mail-MVP mee te publiceren; leg een expliciet integratiecontract vast voor die toekomstige code.
4. Nieuwe tests primair lokaal/preview, altijd met runmanifest, markering vóór enige mailtrigger, `try/finally` cleanup en herstartbare opruimactie na afbreken. Bij Auth-adminfixtures kan een vertrouwde `app_metadata`-runmarkering de bestaande profieltrigger binnen dezelfde transactie de private classificatie laten opslaan vóór ontvangerselectie. Een publiek gekozen `user_metadata`-veld geldt nooit als betrouwbare testclassificatie. Controleer de feitelijke trigger-/mailvolgorde; achteraf markeren is onvoldoende als aanmelden al een mail enqueue't. Productietests blijven een afzonderlijk geautoriseerde handeling.
5. Voor bestaande accounts kiest dit plan **reversibel uitsluiten**, niet verwijderen. Bewaar exacte classificatie-audit. Fysieke opschoning kan later op basis van een gecontroleerde manifestlijst; geen bulkdelete op domein of prefix.

**Klaar wanneer:** lijst/export/telling bevatten alleen echte studenten; synthetische accounts ontvangen geen automatische onboardingmail; afgebroken proeven zijn herkenbaar en herstartbaar op te ruimen. Bewijs met exacte eigen fixtures en een gelijkend echt adres dat zichtbaar moet blijven. SQL/non-adminwriteproef voor classificatie en controle dat paginering geen gaten door clientfiltering krijgt.

### #32 / MU-7 — Toegankelijke actualiteit op het ledendashboard herstellen (M)

Werk in **[bestaand issue #32](https://github.com/6ftwardje/HTP2.0/issues/32)**; `Refs #34`, `Refs #57`. Geen nieuw dashboardherbouwissue.

**Bewezen bron:** `StudentDashboard` in `app/(protected)/dashboard/page.tsx` haalt `recentUpdates` alleen op bij `hasSubscriberAccess` en rendert de feed alleen dan. `/market-analysis` haalt wél `freeOnly: !hasSubscriberAccess` op. Daardoor kunnen dezelfde toegankelijke gratis posts op het dashboard ontbreken. Dit is een bewezen codeverschil, nog geen bewezen verklaring voor elk liveaccount.

- Hergebruik dezelfde rechtenbeslissing als Marktinzicht voor de query: `listPublishedWeeklyUpdates(limit, { freeOnly: !hasSubscriberAccess })`. De pre-billing serviceclient omzeilt RLS; nooit onbegrensde betaalde metadata naar de client sturen.
- Render de recente feed voor alle leden met hun werkelijk toegankelijke inhoud; behoud een eerlijke lege toestand bij echt nul items. Queryfout niet als 'nog niets gepubliceerd' verbergen; logging en afzonderlijke fout-/retrytoestand onder Q2.1.
- Recente feed krijgt de bestaande compacte `MarketUpdateCard`, auteursprojectie en aparte PDF-acties. De weekvooruitblik gebruikt de gedeelde selectie uit Q2.8, onafhankelijk van de limiet van tien recente posts.
- Behoud leeractie, examen/intake/legacy-gates, admincomponist en correcte live-sessierechten. Losse nieuwe-abonnementactivering is uitgesloten.
- Leg #34 vast op de begrensde rangschikking uit conflict 5. #34 blijft review tot zijn eigen rol-/layoutcriteria bewezen zijn; #32 sluiten bewijst niet heel #34 of HTP-47.

**Klaar wanneer:** free/Academy/subscriber/legacy/admin zien precies hun toegankelijke recente inhoud; betalende leden krijgen niet ten onrechte leegte; geen betaalde post/thumbnail/PDF lekt naar anderen. Controle met 0/1/5/meer-dan-10 items, geen abonnement bij disabled billing, query-uitval, desktop/mobiel en railbediening. Benoem welke oorspronkelijke #32-positiecriteria door dit plan vervangen worden.

### Q2.8 — Weekvooruitblik met ouderdomsgrens, gedeeld door overzicht en dashboard (M)

`Refs #69`, `Refs #32`, `Refs #34`; geen heropening van geleverd HTP-15 voor dit nieuwe productgedrag.

**Eigenaren:** `lib/market-feed.ts` (`brusselsWeekStart`, `latestWeeklyOutlook`, `outlookPeriod`), `lib/weekly-updates.ts`, `components/market-insight/MarketInsightLibrary.tsx`, `app/(protected)/dashboard/page.tsx`. Hergebruik bestaande `WeeklyHero`-compositie; trek alleen die compositie eruit wanneer het dashboard haar werkelijk gaat delen.

- Bepaal week op maandag 00:00 Europe/Brussels via kalenderdatums. Eerst gepubliceerde toegankelijke outlook van huidige week; anders vorige kalenderweek. Oudere outlook nooit als actuele hero. Toekomstige outlook niet als huidige week presenteren; buiten dit blok vindbaar houden.
- Selecteer op `week_start_date`, niet op recente publicatiedatum. Ongeldige/ontbrekende weekmetadata niet gokken. De query voor het dashboard mag niet afhangen van de tien recentste gewone posts.
- Toon bij ouder dan vorige week of geen toegankelijke outlook een korte lege toestand met archieflink. Bij ontbrekende echte publicatieplanning: **'De volgende weekvooruitblik verschijnt zodra hij gepubliceerd is.'** Een specifieke dag/tijd alleen bij een aantoonbare geplande datum. Na goedkeuring kan Ward een vast redactiemoment toevoegen zonder technische bouw te blokkeren.
- Archiveer of wijzig geen oude content automatisch. Houd bestaande directe links/hoofdstuklinks en volledige archieftoegang. Een oudere outlook die niet als hero wordt gebruikt kan gewoon als normale toegankelijke lijstkaart bestaan; een actuele hero niet nogmaals in dezelfde feed tonen.
- De lege toestand verschijnt alleen in de passende Actueel/Alles-context; actieve markt-/inhoud-/zoekfilters mogen geen misleidende weekbelofte geven. Dashboard en overzicht gebruiken dezelfde beslisfunctie en tekst.

**Klaar wanneer:** dezelfde weekselectie op beide plekken; huidige/vorige week kloppen, vijf weken oude content staat niet prominent als actuele vooruitblik, archief is bereikbaar. Test maandaggrens, zondag, zomer-/wintertijd, jaargrens, future/missing/ongeldige metadata, alleen ontoegankelijke outlook, >10 nieuwere gewone posts en actieve filters. Geen vast tijdstip verzinnen.

### Q2.4–Q2.7, Q2.9 en Q2.10 — Gerichte interfacewijzigingen

De zes afzonderlijke uitvoerplannen bevatten bewijs, exacte eigenaarsbestanden, hergebruik, afbakening en verificatie:

- [Q2.4 — één Nederlandse beheertaal en canonieke links](2026-10-19-q2-4-beheerbenamingen.md)
- [Q2.5 — sessieformulier op aanvraag](2026-10-19-q2-5-sessieformulier.md)
- [Q2.6 — alleen betekenisvolle afwijkingsbadges](2026-10-19-q2-6-beheerbadges.md)
- [Q2.7 — twee donkere oppervlaktetokens](2026-10-19-q2-7-donkere-oppervlakken.md)
- [Q2.9 — rustigere gedeelde redactionele kaart](2026-10-19-q2-9-redactionele-kaart.md)
- [Q2.10 — zoek-/inhoudsbediening voor kleine lijsten](2026-10-19-q2-10-kleine-lijsten.md)

### Q2.1 — Relevante opgevangen fouten worden vindbaar (M)

`Refs #95`; bouw voort op `lib/logger.ts`, niet een tweede loggingsysteem. #95 heeft de Marktinzicht/PDF-/hervatketen aangepakt; dit vervolg behandelt de bredere wens.

- Inventariseer foutdragende `catch`-paden én `{ error }`-resultaten onder `app/`, `components/`, `lib/` die nu een fouttekst, onjuiste leegte of mislukte handeling opleveren zonder logging. Classificeer afhandeling die al door de eigenaar wordt gelogd om dubbele meldingen te vermijden.
- Voor iedere echte operationele fout: stabiele eventnaam, oorspronkelijke fout/cause/code, operatie/route, veilige technische context en correlatie waar beschikbaar. Geen formulierinhoud, naam/telefoon/mailadres, sessiecookie, token of herstel-URL loggen.
- Bewuste verwachte exits zoals geannuleerde browseractie of onbruikbare optionele localStorage zijn geen nieuwe operationele incidenten. Documenteer die classificatie; niet elke `catch` blind als error bestempelen.
- Eerste aandacht: profiel/auth, studentenbeheer, livesessieformulier, dashboardquery. `LiveSessionActionForm` heeft aantoonbaar nog een stille `catch`; `listPublishedWeeklyUpdates` logt inmiddels, maar retourneert nog `[]` bij query-uitval. Een technische fout mag geen onjuiste lege-contentmelding worden.
- Bij iedere andere goedgekeurde slice geldt deze loggingregel direct; de afsluitende inventaris rondt de overige paden af. Bij een functionele fout die buiten loggingherstel valt: afzonderlijke taak, geen stilzwijgende functieherbouw.

**Klaar wanneer:** inventaris per geraakt pad en eigenaar, geforceerde representatieve failures tonen bruikbare UI én vindbare oorspronkelijke logcontext; geen dubbele logstorm of gevoelige invoer. Controleer echte logontvangst in preview. #96 documenteert dat historische Netlify-log-API lege messages kan tonen; die API alleen is geen bewijs dat logging faalt of slaagt.

## 5. Bouwvolgorde en afhankelijkheden

| Volgorde | Werk | Afhankelijkheden / afronding |
| --- | --- | --- |
| 0 | HTP-48: scope/board/baseline vastzetten; #95 heracceptatie | Relevante code/logs actueel; alleen echte resterende blocker repareren. |
| 1 | Q2.2 profiel, daarna Q2.3 synthetische accounts | Datadiagnose vóór reparatie; markering en mailuitsluiting vóór nieuwe testaccounts. Logging in deze paden meteen volgens Q2.1. |
| 2 | #32 dashboarddata, daarna Q2.8 gedeeld weekblok; #34 heracceptatie | Q2.2 levert begroeting; Q2.8 vult expliciet ontbrekende weekweergave aan. |
| 3 | Q2.4 beheernamen → Q2.5 sessieformulier → Q2.6 beheerbadges | Afzonderlijke kleine PR's; bestaande editor- en sessieacties behouden. |
| 4 | Q2.7 tokens → Q2.9 kaarten → Q2.10 bediening kleine lijsten | Gedeelde componenten controleren op dashboard/vervolg; geen F6 meenemen. |
| 5 | Q2.1 inventaris afronden; #49 beperkte launchregressie | Kritieke keten groen; volledige F10-status alleen sluiten als de hele eigen scope geleverd is. |

Omvang is relatief, geen kalenderbelofte: S is lokaal, M heeft meerdere verbonden paden. Werk maximaal één uitvoerslice tegelijk af. De nummering Q2.x bepaalt niet de prioriteit; bovenstaande volgorde doet dat. De datafase hoeft niet op loginvideo-assets, F6-publicatie of AI-besluiten te wachten.

## 6. Bouw-, test- en releaseafspraken

- Uitvoering volgt `CONTRIBUTING.md`: exact één hoofdissue met `backlog`, unieke taakcode, status In uitvoering vóór code, branch `fix/<code>-<naam>` of passende `feat/`/`docs/`, vroeg draft-PR met één `Closes #…`; overige relaties als `Refs #…`. De repositoryregel heeft voorrang op de algemene branchprefix.
- Begin vanaf de dan actuele main; behoud deze bestaande vuile werkmap. Hergebruik een geschikte schone managed worktree als die beschikbaar is, anders maak er één. Geen commit van de huidige verzameling lokale wijzigingen.
- Functionele wijzigingen krijgen passende unit/action/SQL-/browserproeven. Kleine vertaal-/kleurwijzigingen krijgen gerichte interfacecontrole; geen implementatie-spiegelende tests toevoegen.
- Gemeenschappelijke eindchecks in de uitvoercheckout: `npm test`, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`, `npm run backlog:check`. Gebruik de werkelijke Node-/lintconfiguratie van main; los geen losstaande frameworkupgrade op in deze taken.
- Rechtenproeven: anon/free/Academy/subscriber/legacy/mentor/admin voor geraakte routes en directe requests. Vooral profielgate, studentupdates, betaalde postmetadata en PDF's. Bestaande examengates en modulevolgorde blijven intact.
- Interfacecontrole: 375/768/1440 breed, donker/licht; keyboardfocus en zelfstandige PDF-knop bij gedeelde kaarten; lege/gevulde/fouttoestanden en lange titels/namen. Bestaande grotere thumbnails behouden.
- Nieuwe schemawijzigingen eerst gericht lokaal/preview, met RLS en rollbackplan. Voor productie applicatie/schema vóór publicatie op elkaar afstemmen en de bestaande `verify:market-schema` behouden. Historische baseline #24/#28 blijft apart; geen algemene db push en geen betaalcutover.
- Merge, productie-uitrol en echte productiebackfill zijn afzonderlijke concrete releasehandelingen volgens de dan gegeven opdracht. Een groen licht voor bouwen betekent niet automatisch dat de nu afgebakende lokale F6 of e-mail-MVP mee mag.
- Validatiebewijs bij het hoofdissue; status Te controleren bij open acceptatie. Productbord/snapshot bijwerken onder HTP-48. Geleverde nieuwe voorkeuren veranderen historische Done-criteria niet met terugwerkende kracht.

## 7. Wat goedkeuring precies vastlegt

Goedkeuring van dit pakket legt vast: de prioriteitsvolgorde; de bovenstaande issue-eigenaars; één verplicht profielaanvulscherm; betrouwbare serveruitsluiting van bewezen tests zonder bulkdelete; de begrensde dashboardvolgorde; maximaal vorige kalenderweek als weekfallback; geen verzonnen publicatietijd; de twee opgegeven donkere kleuren; de nieuwe kaartpresentatie en de drempel van twaalf met blijvende archieftoegang; behoud van legacy-redirects.

Voor de lokale bouw is dan geen extra ontwerpkeuze nodig. Nog te onderzoeken gegevens zijn expliciete eerste uitvoerstappen, geen feiten die vooraf als bewezen gelden. Bij een afwijkende live Auth-trigger, onbekend testaccount-eigenaarschap, onvoldoende rechtenbewijs of benodigde verbreding van scope: diagnose vastleggen en uitsluitend het betreffende onderdeel stoppen/herplannen.

Niet inbegrepen: nieuw productbord, herontwerp exameneditor, module-/lesordening, thumbnailverkleining, automatische transcriptie/AI, nieuwe abonnementen, publicatie van F6, volledige F7–F9 of de lokale e-mail-MVP.

## Bronnen en leescontrole

- Aangeleverde takenlijst: `Pasted text.txt`, 'HTP — takenlijst Ward', livewaarnemingen 19 oktober.
- GitHub: repository-issues open én gesloten (80), Project 3 (70 kaarten incl. drafts), release-PR's en exacte main-checks; gelezen op peildatum. Deze aantallen zijn snapshots.
- Mainbronnen: `CONTRIBUTING.md`, `docs/HTP-BACKLOG.md`, `docs/HTP-FASENPLAN.md`, `docs/HTP-F3B-ONTWERP.md`, `docs/MARKTINZICHT-HERSTEL-2026-10-19.md` en de bij ieder pakket genoemde uitvoerbestanden.
- Lokale bestaande plannen `design-plans/01`–`03` zijn ouder en geen bewijs dat hun voorstel op main is uitgevoerd. Semantische koppen/paneelconsolidatie worden hier niet als extra werk toegevoegd; de beperkte nieuwe kleur-/kaartbesluiten supersederen alleen hun eventuele conflicterende aanbevelingen.
- Deze planningsronde heeft geen tests/build op de vuile checkout uitgevoerd en heeft geen issues/statussen, productcode, gebruikersdata of productie gewijzigd.

## UI-bewijssamenvatting

### Design language

- Audited surface: bestaande HTP-ledenervaring rond Marktinzicht/dashboard en de bijbehorende beheerbestemmingen; geen nieuw productontwerp.
- Design sources: directe nieuwe opdracht, `docs/HTP-F3B-ONTWERP.md`, `app/globals.css`, `MarketUpdateCard`/CSS, `AdminShell` en de routecomposities in de deelplannen.
- Documented decisions: één volledige kaartlink; gedeelde semantische themawaarden; Nederlandse beheerinterface; afzonderlijke PDF-acties; behoud grotere thumbnails. Nieuwe voorkeuren supersederen uitsluitend de genoemde oude kleuren/CTA-/samenvattings-/metadataregels.
- Governing owners and consumers: route → `AdminShell`/manager; route → `MarketInsightLibrary` → `MarketUpdateCard`; dashboard → `RecentMarketUpdatesFeed` → dezelfde kaart; globale tokens → panelen/kaarten.
- Explicit exceptions: publieke landing met eigen scope, bestaande mediaframes, functionele status-/toegangsinformatie en zelfstandige PDF-acties.

### Findings

| # | Problem | Evidence | Proposed change | Scope | Confidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Hetzelfde beheerscherm heeft verschillende namen en Engelse copy. | `AdminLayout` laadt `AdminShell`; `/admin/videos` heeft Engelse titel, zijbalk Lesvideo's, overzicht Modules en lessen. Gebruiker verlangt één Nederlandse naam. | Gebruik de canonieke schermnamen uit Q2.4. | Beheerheaders, zijbalk, overzichtslinks en twee managers. | Hoog: directe bron-/copytegenspraak. |
| 2 | De gepubliceerde kaart bevat precies de extra presentatielaag die Ward verwijderd wil. | `MarketUpdateCard` rendert `.open`, generiek Video en rechts uitgelijnde tags; `updateSummary` levert de vaste vulzin; feed en dashboard importeren diezelfde eigenaar. | Pas de gedeelde kaart aan volgens Q2.9, behoud volledige link/PDF-acties. | Feed, dashboardrail en vervolgkaarten. | Hoog: expliciete opdracht en rechtstreeks renderpad. |
| 3 | De twee bestaande donkere oppervlaktewaarden wijken af van de nu exact gevraagde waarden. | `:root` definieert oude `--card`/`--surface-hover`; kaart-CSS gebruikt beide rechtstreeks. | Vervang precies die twee donkere waarden volgens Q2.7. | Bestaande tokenconsumenten. | Hoog voor waarde/doorwerking; visuele heracceptatie volgt tijdens uitvoering. |

### Improve first

Binnen de UI-afwerking eerst Q2.4: dezelfde beheerbestemming krijgt overal één betekenisvolle naam, met klein en direct controleerbaar wijzigingsoppervlak. De functionele data- en dashboardprioriteiten uit hoofdstuk 5 gaan in de totale bouwvolgorde vóór deze UI-afwerking.

## Uitvoeringskoppeling na groen licht

- HTP-48 / H1.48: [#97](https://github.com/6ftwardje/HTP2.0/issues/97), oorspronkelijke projectkaart behouden.
- Q2.1: [#98](https://github.com/6ftwardje/HTP2.0/issues/98)
- Q2.2: [#99](https://github.com/6ftwardje/HTP2.0/issues/99)
- Q2.3: [#100](https://github.com/6ftwardje/HTP2.0/issues/100)
- Q2.4: [#101](https://github.com/6ftwardje/HTP2.0/issues/101)
- Q2.5: [#102](https://github.com/6ftwardje/HTP2.0/issues/102)
- Q2.6: [#103](https://github.com/6ftwardje/HTP2.0/issues/103)
- Q2.7: [#104](https://github.com/6ftwardje/HTP2.0/issues/104)
- Q2.8: [#105](https://github.com/6ftwardje/HTP2.0/issues/105)
- Q2.9: [#106](https://github.com/6ftwardje/HTP2.0/issues/106)
- Q2.10: [#107](https://github.com/6ftwardje/HTP2.0/issues/107)

#32 en #34 zijn bijgewerkt met de goedgekeurde scopeverdeling. #95 blijft gesloten/Done en is als bestaande herstelkaart aan Project 3 toegevoegd.

## Eerste uitvoeringspakket — 19 oktober 2026

| Onderdeel | Issue / PR | Resultaat / grens |
| --- | --- | --- |
| Issuekoppelingen en besluiten | #97 / PR #108 | Bestaande HTP-48-kaart behouden; Q2.1–Q2.10 gekoppeld; #32/#34 bestaande eigenaren; productbordprioriteiten bijgewerkt. |
| Launchhercontrole | #95 / vervolg #110, PR #111 | Live overzicht en vijf details werken; 404 licht/donker gecontroleerd; productie-schema-preflight groen. Aanvullende pre-billing weigering was nog een 404: afzonderlijke duidelijke toegangsmelding lokaal gebouwd/getest. |
| Naam en telefoon | #99 / PR #109 | Trigger leest nu full_name/name correct; eigen metadataherstel, verplichte telefoon, eenmalig aanvulscherm, server-/API-gates en veilige terugkeer. 317 tests, SQL, 11 browsergroepen en echte lokale private PDF-proef. |
| Testaccounts | #100 / PR #112 | Service-beheerde markering, serverfilter vóór paginering/telling/export, lead-/mailuitsluiting, normale en afgebroken herstelproef met geverifieerde cleanup. 321 tests, productie-vormige trigger-/SQL- en browserproeven. PR gestapeld op #109. |

Productiediagnose: de Auth-trigger las alleen `name`, terwijl registratie `full_name` schrijft. 61 onvolledige profielen hadden naammetadata; productieprofielen zijn niet aangepast. De twee recoveryvermeldingen zijn orphan studentprofielen zonder Auth-identiteit en zonder aangetroffen leerling-/betaal-/gespreksreferenties. Ze zijn niet verwijderd of geclassificeerd.

De profiel- en testaccountmigraties zitten bij hun eigen code; hun rollback-SQL-proeven draaien verplicht in verse-database-CI. De oorspronkelijke lijst-/bijlagenfout is niet teruggekeerd. Een private synthetische PDF is lokaal wel echt geüpload en met persoonlijke bytes uitgeleverd; geen productie-upload.

Alle vier PR's zijn ter review; niets gemerged of op productie uitgerold. Vereiste review, gerichte schema-uitrol en een releaseopdracht blijven afzonderlijke stappen. Externe al bestaande n8n-queued acties zijn niet ingezien/ongedaan gemaakt. Overige Q2-taken, #32/#34, F6 en de lokale e-mail-MVP zijn niet in dit eerste bouwpakket meegenomen.

Volgorde voor een eventuele release: governance #108, launchvervolg #111, profiel #109, daarna de op #109 gestapelde testaccount-PR #112. Productie-schema eerst gecontroleerd en gericht; classificatie van exact twee beoordeelde orphanprofielen pas na afzonderlijke vrijgave/readback, zonder bulkdelete.
