# HTP platformbacklog

Peildatum: **17 oktober 2026**. Bron: `HTP-Platform-Feedback.pdf` (38 pagina’s). Paginanummers hieronder tellen de omslag mee; gedrukte nummering is één lager vanaf PDF-pagina 2.

**Centrale voortgang:** [bestaand GitHub Project 3](https://github.com/users/6ftwardje/projects/3). Dit bestand bevat de complete taakspecificaties en een gedateerde statussnapshot; bij faseoverdracht worden bord en snapshot samen bijgewerkt. Filter op `HTP-` voor dit feedbackpakket. De bestaande MU/M1-items behouden hun eigen scope.

**Update 17 oktober 2026: F1 is door Ward goedgekeurd, lokaal geïmplementeerd en technisch gecontroleerd. Crypto is amber. F1 plus HTP-49 zijn goedgekeurd voor main. F2 is lokaal goedgekeurd: alleen het belletje, met klikgedrag. Stop vóór F3a; latere fasen zijn niet goedgekeurd.** Ready betekent inhoudelijk voorbereid, geen uitvoertoestemming. Documentprompts en aanbevelingen geven geen opdracht om code uit te voeren. [Analyse en codebewijs](HTP-FEEDBACK-ANALYSE.md) · [Fasenplan en besluitpoorten](HTP-FASENPLAN.md).

## Werkafspraken

- **Backlog → Ready → In uitvoering → Te controleren → Done**. **Geblokkeerd** is een aparte status met concrete oorzaak en volgende actie. De eerste blokkadeactie is steeds: afhankelijkheden afronden of het genoemde besluit bij die fase vastleggen; de fase-eigenaar pakt dit op. Productbesluiten zijn van Ward, technische uitwerking van de uitvoerder.
- Ready: criteria helder, relevante besluiten/dependencies afgerond. Start: expliciete fasegoedkeuring, daarna één repository-issue per uitvoerslice volgens CONTRIBUTING.md. Nog niet gestarte taken blijven drafttaken; F1-uitvoerslices zijn met behoud van bordkaart naar repository-issues omgezet.
- Vóór codewijziging status In uitvoering en branch/issue koppelen. WIP maximaal één taak per uitvoerder. Te controleren betekent resultaat gereed voor de vereiste acceptatiecontrole; nog ontbrekend testbewijs expliciet vermelden.
- Done alleen met afgevinkte criteria en bewijs: commit/PR, datum, omgeving, accountrol/fixture, uitgevoerde check en uitslag, visuele review waar passend en acceptatie. Code-aanwezigheid, een groene build of oud Review-label alleen volstaat niet. Voor reeds aanwezige implementatie is nieuwe verificatie nodig.
- Prioriteiten: **P0** fase-/releasepoort, **P1** kernervaring of toegangsvoorwaarde, **P2** vervolgstap. Omvang is relatief: **S** klein en lokaal, **M** meerdere samenhangende onderdelen, **L** te groot voor één uitvoerslice. Grote PDF-/video-/retentieonderdelen zijn daarom in M/S-taken gesplitst; omvang is geen tijdsbelofte.
- Beoordeling van code en scrumstatus zijn verschillende velden. Al geïmplementeerd is een statische bevinding; Te controleren is de actuele voortgang. Geen taak is op grond van deze analyse Done.
- Per taak staat een passende verificatieopdracht. Die checks zijn **gepland**, niet uitgevoerd. Het bewijsregister E01-E18 in de analyse linkt naar de concrete bestaande bronbestanden.

## Scrumboard: snapshot

| ID | Taak | Prio | Fase | Omvang | Beoordeling | Status |
|---|---|---|---|---|---|---|
| [HTP-01](#htp-01) | Bewaar werkende onderdelen en leg de fasebaseline vast | P0 | F1 | S | Al geïmplementeerd | Te controleren |
| [HTP-02](#htp-02) | Verfijn centrale thema- en oppervlaktetokens | P1 | F1 | M | Al geïmplementeerd | Te controleren |
| [HTP-03](#htp-03) | Maak gedeelde markttokens en MarketTag | P1 | F1 | M | Al geïmplementeerd | Te controleren |
| [HTP-04](#htp-04) | Orden typografie, ritme en relatieve datums | P1 | F1 | M | Al geïmplementeerd | Te controleren |
| [HTP-05](#htp-05) | Toon donker logo zonder licht tegeltje | P1 | F1 | S | Al geïmplementeerd | Te controleren |
| [HTP-06](#htp-06) | Verifieer bestaande navigatie en legacy-URL’s | P1 | F2 | S | Al geïmplementeerd (begrensd) | Te controleren |
| [HTP-07](#htp-07) | Verplaats account- en beheeracties naar avatarmenu | P1 | F2 | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-08](#htp-08) | Bundel bel en themaknop in echte bovenbalk | P1 | F2 | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-09](#htp-09) | Maak gedeelde meldingenteller, typen en soft delete | P1 | F2 | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-10](#htp-10) | Markeer meldingen gelezen bij openen van hun bron | P1 | F2 | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-11](#htp-11) | Vernieuw meldingendropdown en overzicht | P1 | F2 | M | Gedeeltelijk aanwezig | Geblokkeerd |
| [HTP-12](#htp-12) | Harmoniseer marktmodel en weekhoofdstukken | P1 | F3a | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-13](#htp-13) | Maak eenvoudige feednavigatie en dynamische marktchips | P1 | F3b | M | Gedeeltelijk aanwezig | Geblokkeerd |
| [HTP-14](#htp-14) | Maak gedeelde redactionele feedkaarten | P1 | F3b | M | Gedeeltelijk aanwezig | Geblokkeerd |
| [HTP-15](#htp-15) | Geef weekvooruitblik een eigen hoofdblok | P1 | F3b | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-16](#htp-16) | Voeg precies twee relevante vervolgkaarten toe | P1 | F3b | M | Nog uit te voeren | Backlog |
| [HTP-17](#htp-17) | Herstel artikelcontext en genummerde takeaways | P1 | F3b | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-18](#htp-18) | Gebruik update-thumbnail als videoposter | P1 | F4 | S | Nog uit te voeren | Backlog |
| [HTP-19](#htp-19) | Onderzoek en reproduceer YouTube-fout 153 | P1 | F1 (diagnose), herstel pas F4 | S | Nader te onderzoeken | Geblokkeerd |
| [HTP-20](#htp-20) | Controleer mogelijkheden van elke videoprovider | P1 | F3a | S | Nader te onderzoeken | Backlog |
| [HTP-21](#htp-21) | Voeg snelheidsvoorkeur en veilige sneltoetsen toe | P2 | F4 | M | Nader te onderzoeken / gedeeltelijk | Backlog |
| [HTP-22](#htp-22) | Modelleer veilige videopositie en voltooiing | P1 | F4 | M | Gedeeltelijk aanwezig | Geblokkeerd |
| [HTP-23](#htp-23) | Sla videopositie op en toon hervatten in speler/lijsten | P1 | F4 | M | Nog uit te voeren | Backlog |
| [HTP-24](#htp-24) | Maak hoofdstukken sticky, actief en via marktlinks bereikbaar | P1 | F3b | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-25](#htp-25) | Beslis PDF-contract, rubrieken en beschermingsniveau | P1 | F5a | M | Nader te onderzoeken | Geblokkeerd |
| [HTP-26](#htp-26) | Maak private PDF-opslag en geautoriseerde uitlevering | P1 | F5a | M | Nog uit te voeren | Backlog |
| [HTP-27](#htp-27) | Personaliseer PDF-watermerken en registreer openacties | P1 | F5a | M | Nog uit te voeren | Backlog |
| [HTP-28](#htp-28) | Bouw één gedeelde toegankelijke PDF-viewer | P1 | F5a | M | Nog uit te voeren | Backlog |
| [HTP-29](#htp-29) | Koppel PDF-bijlagen aan updates en feed | P1 | F5b | M | Nog uit te voeren | Backlog |
| [HTP-30](#htp-30) | Voeg Academy-rubrieken en PDF-tab met beheer toe | P1 | F5b | M | Nog uit te voeren | Geblokkeerd |
| [HTP-31](#htp-31) | Maak een eenvoudige beheerde Toolbox | P2 | F5b | M | Nog uit te voeren | Geblokkeerd |
| [HTP-32](#htp-32) | Onthoud PDF-leespositie per gebruiker | P2 | F5b | S | Nog uit te voeren | Backlog |
| [HTP-33](#htp-33) | Migreer setups naar expliciete zonestatussen | P2 | F6 | M | Gedeeltelijk aanwezig | Geblokkeerd |
| [HTP-34](#htp-34) | Toon zones als denkkader met actieve en afgelopen sectie | P2 | F6 | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-35](#htp-35) | Maak educatieve pincollecties met beheer en volgorde | P2 | F6 | M | Gedeeltelijk aanwezig | Geblokkeerd |
| [HTP-36](#htp-36) | Behoud archief via zoeken, beheer en directe links | P2 | F6 | S | Gedeeltelijk aanwezig | Backlog |
| [HTP-37](#htp-37) | Voeg loop-video toe aan login/registratiepaneel | P2 | F7 | M | Gedeeltelijk aanwezig | Geblokkeerd |
| [HTP-38](#htp-38) | Toon welkomstvideo éénmalig aan nieuwe accounts | P2 | F7 | M | Nog uit te voeren | Geblokkeerd |
| [HTP-39](#htp-39) | Ruim dashboardbasis op voor admin en lid | P1 | F2 | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-40](#htp-40) | Leg vorige-bezoeksnapshot en geopende items vast | P2 | F8 | M | Nog uit te voeren | Backlog |
| [HTP-41](#htp-41) | Toon nieuwregel en verdwijnende Nieuw-labels | P2 | F8 | M | Nog uit te voeren | Backlog |
| [HTP-42](#htp-42) | Voeg volgende-modulekaart en rubriekafsluiting toe | P2 | F8 | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-43](#htp-43) | Verbind livesessie, opname en volgende aankondiging | P2 | F8 | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-44](#htp-44) | Toon rustige voortgang en één Verder-kijkenkaart op dashboard | P2 | F8 | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-45](#htp-45) | Breid reacties uit met drie betekenissen en veilige UI | P2 | F9 | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-46](#htp-46) | Voeg beperkte reactie-inzichten voor beheer toe | P2 | F9 | S | Nog uit te voeren | Backlog |
| [HTP-47](#htp-47) | Maak fasebewijs en integrale regressie aantoonbaar | P0 | F10 + iedere fase | M | Gedeeltelijk aanwezig | Backlog |
| [HTP-48](#htp-48) | Houd backlog, fasepoorten en bewijslast centraal bij | P0 | F1 + iedere fase | S | Gedeeltelijk aanwezig | Ready |

Snapshot na F1: 29 Backlog, 12 Geblokkeerd, 1 Ready, 6 Te controleren. **0/48 Done**; geen taak In uitvoering. HTP-01 t/m 05 wachten op lokale visuele acceptatie; HTP-19 wacht op reproductiemateriaal. F2 is niet gestart.

**Controle van deze planningsoplevering:** het bord is na inrichting teruggelezen: 48 unieke HTP-taken, alle bronverwijzingen/criteria/inhoudsvelden en Status/HTP-fase/Prioriteit/Omvang komen overeen met deze snapshot. De 15 bestaande items zijn behouden; alleen de kolomnamen In Progress/Review zijn vertaald naar In uitvoering/Te controleren, met behoud van optie-ID's. Geblokkeerd is toegevoegd. Alle lokale documentlinks en taakafhankelijkheden zijn gecontroleerd. Dit oorspronkelijke controlebewijs betrof de backloginrichting; nieuw F1-applicatiebewijs staat in [HTP-F1-VERIFICATIE.md](HTP-F1-VERIFICATIE.md).

## Volledige taakspecificaties

<a id="htp-01"></a>

### HTP-01 — Bewaar werkende onderdelen en leg de fasebaseline vast

- **Bron:** rubriek 00-01 p.4-6; 15 p.37-38.
- **Prioriteit / fase / omvang:** P0 / F1 / S.
- **Beoordeling / status:** Al geïmplementeerd / **Te controleren**.
- **Resultaat:** Een herhaalbare baseline voor student, mentor en admin, met behoud van leergroep/marktgroep, artikeltypografie, intro, byline/avatar, disclaimer, zoeken, Actueel, setupconcept, thumbnails en reacties zonder comments.
- **Afhankelijkheden:** Geen.
- **Besluiten / blokkades:** F1 expliciet goedgekeurd door Ward op 17 oktober 2026.
- **Startbevinding (statisch):** E03, E05, E08, E11, E14-E18; huidige analyse is statisch, screenshots van de app ontbreken.

**Acceptatiecriteria**

- [x] Actuele commit/lokale wijzigingen, routes, rollen, thema’s en relevante featureflags staan in een baselineverslag.
- [x] Desktop 1440px, tablet 768px en mobiel 375px bevatten screenshots van dashboard, feed, artikel, Academy, meldingen en geraakte beheerschermen.
- [x] Bestaande rechten, examens, publicatie, media, chatprivacy en URL’s hebben een expliciete regressiecheck; geen onbekende werkmapwijzigingen meegenomen.

**Verificatie:** Na goedkeuring baseline opnemen in een afgesproken testomgeving met synthetische accounts; geen productiecontent wijzigen. Per volgende fase alleen relevante baseline herhalen.

**Bewijs van uitvoering:** lokaal geïmplementeerd en technisch gecontroleerd op 17 oktober 2026, branch `codex/htp-f1-visual-basis`. Zie [F1-bewijsrapport](HTP-F1-VERIFICATIE.md) voor bestanden, 78 routegevallen, 283 tests, contrast-/browserbewijs en beperkingen. Wacht op visuele acceptatie/integratie; daarom nog niet Done.

<a id="htp-02"></a>

### HTP-02 — Verfijn centrale thema- en oppervlaktetokens

- **Bron:** rubriek 00 p.5; 02 p.7-9; 14 p.36.
- **Prioriteit / fase / omvang:** P1 / F1 / M.
- **Beoordeling / status:** Al geïmplementeerd / **Te controleren**.
- **Resultaat:** Eén beheersbaar tokenstelsel voor donker als nieuwe fallback en gelijkwaardig licht; bestaande opgeslagen themakeuze blijft gelden.
- **Afhankelijkheden:** HTP-01.
- **Besluiten / blokkades:** D11: AA gaat als meetbare eis vóór onbruikbare tokencombinaties; geen open productkeuze nodig.
- **Startbevinding (statisch):** E01; hardcodedkleurinventaris in analyse. Geen contrastmeting of browsertest uitgevoerd.

**Acceptatiecriteria**

- [x] Donker gebruikt achtergrond #0D0F14, kaart #161A21, hover #1D222B, rand #232833, titel #E8EAED en bijtekst #9BA1AC; licht #F3F4F6/#FFFFFF/#F7F8FA en #14161C/#5B616E; accent #7C6CF0. Afwijkingen voor AA worden onderbouwd.
- [x] Geen onbedoelde themeflash/hydratiefout; refresh, opgeslagen licht/donker, ontbrekende of geblokkeerde opslag en systeempreferentie zijn afgedekt.
- [x] Harde UI-kleuren/pure witte tekst en niet-functionele lijstlijnen in de geraakte surfaces vervangen; functionele randen/statuskleuren blijven herkenbaar. Accent alleen actief/focus/primair.

**Verificatie:** Meet contrast van echte tekst/knoppen/focus in beide thema’s; screenshotvergelijking met HTP-01; toetsenbord en opslagfout testen; typecheck/build. Lever lijst aangeraakte hardcodedkleurenbestanden.

**Bewijs van uitvoering:** lokaal geïmplementeerd en technisch gecontroleerd op 17 oktober 2026, branch `codex/htp-f1-visual-basis`. Zie [F1-bewijsrapport](HTP-F1-VERIFICATIE.md) voor bestanden, 78 routegevallen, 283 tests, contrast-/browserbewijs en beperkingen. Wacht op visuele acceptatie/integratie; daarom nog niet Done.

<a id="htp-03"></a>

### HTP-03 — Maak gedeelde markttokens en MarketTag

- **Bron:** rubriek 00 p.5; 02 p.8-9; 06 p.18.
- **Prioriteit / fase / omvang:** P1 / F1 / M.
- **Beoordeling / status:** Al geïmplementeerd / **Te controleren**.
- **Resultaat:** Een gedeelde MarketTag met zes marktkleuren, los van het paarse actieaccent; nieuwe tags later hergebruiken op alle feedbacksurfaces.
- **Afhankelijkheden:** HTP-01, HTP-02.
- **Besluiten / blokkades:** D1 besloten door Ward: Crypto amber #E39B4B.
- **Startbevinding (statisch):** E05-E06; bij aanvang ontbraken uniforme markttokens/MarketTag; nu lokaal aanwezig. D1 is gesloten.

**Acceptatiecriteria**

- [x] Crypto gebruikt de expliciet gekozen kleur; Forex #5B8DEF, Aandelen #C47FAE, Goud #CDB45A, Commodities #4FB3A9 en Trading #8A94A6 centraal vastgelegd.
- [x] Pill gebruikt markttekst en circa 12-15% getinte achtergrond; kleur is nooit de enige betekenisdrager; tekst/focus haalt AA in licht en donker.
- [x] Geen twee concurrerende MarketTag-implementaties; legacy macro/indices/general worden niet stil als andere markt hernoemd; mapping volgt HTP-12.

**Verificatie:** Componentdemo met alle zes labels, lange tags, kleurcontrast en beide thema’s; in F1 geen datamigratie. Pas feed/dashboards later toe met dezelfde component.

**Bewijs van uitvoering:** lokaal geïmplementeerd en technisch gecontroleerd op 17 oktober 2026, branch `codex/htp-f1-visual-basis`. Zie [F1-bewijsrapport](HTP-F1-VERIFICATIE.md) voor bestanden, 78 routegevallen, 283 tests, contrast-/browserbewijs en beperkingen. Wacht op visuele acceptatie/integratie; daarom nog niet Done.

<a id="htp-04"></a>

### HTP-04 — Orden typografie, ritme en relatieve datums

- **Bron:** rubriek 00 p.5; 02 p.8-9; 14 p.36.
- **Prioriteit / fase / omvang:** P1 / F1 / M.
- **Beoordeling / status:** Al geïmplementeerd / **Te controleren**.
- **Resultaat:** Drie herkenbare UI-kopniveaus en een gedeelde Nederlandse relatieve-datumweergave voor publicatie/meta, zonder de beschermde artikeltypografie te veranderen.
- **Afhankelijkheden:** HTP-01, HTP-02.
- **Besluiten / blokkades:** D11: toekomstige agendatijden behouden als functionele uitzondering.
- **Startbevinding (statisch):** E01, E05, E08, E13-E15; absolute datumformatters bestaan, gedeelde relatieve formatter niet aangetroffen.

**Acceptatiecriteria**

- [x] Pagina/sectie/item hebben gedeelde duidelijke niveaus; dashboard, feed en Academy gebruiken die; artikelkop/intro/regellengte/byline blijven visueel gelijk.
- [x] Itemafstand in geraakte lijsten circa 30-40% compacter met voldoende touch/focusruimte; secties blijven duidelijk gescheiden.
- [x] Publicatie/meta toont relatieve NL-tijd met exacte datum+tijd in tooltip en semantische time; Brussel/DST/ongeldige datums afgedekt. Exacte toekomstige sessietijd blijft vindbaar.

**Verificatie:** Vergelijk drie schermbreedtes en twee thema’s; fixturedatums vandaag/gisteren/oud/DST/ongeldig; check tooltip ook toetsenbordtoegankelijk. Inventariseer resterende datumformatters incl. legacyroutes/admin.

**Bewijs van uitvoering:** lokaal geïmplementeerd en technisch gecontroleerd op 17 oktober 2026, branch `codex/htp-f1-visual-basis`. Zie [F1-bewijsrapport](HTP-F1-VERIFICATIE.md) voor bestanden, 78 routegevallen, 283 tests, contrast-/browserbewijs en beperkingen. Wacht op visuele acceptatie/integratie; daarom nog niet Done.

<a id="htp-05"></a>

### HTP-05 — Toon donker logo zonder licht tegeltje

- **Bron:** rubriek 00 p.5; 02 p.7,9.
- **Prioriteit / fase / omvang:** P1 / F1 / S.
- **Beoordeling / status:** Al geïmplementeerd / **Te controleren**.
- **Resultaat:** Herkenbare merkweergave in shell/login zonder opvallend licht tegelvlak in donker.
- **Afhankelijkheden:** HTP-01, HTP-02.
- **Besluiten / blokkades:** Geen blokkerend asset: voorstel bestaand transparant icoon + themagekleurde merknaam; officiële full-variant later vervangbaar.
- **Startbevinding (statisch):** E02: beide PNG’s visueel bekeken; full-logo heeft tegel, icoon niet. Geen lokale SVG.

**Acceptatiecriteria**

- [x] Donkere weergave heeft transparante achtergrond en geen licht tegelvlak; licht/donker wisselt correct.
- [x] Voorlopige combinatie gebruikt bestaande logo-icon.png en merknaam; geen thumbnails of andere merkassets overschreven.
- [x] Logo blijft leesbaar op mobiel en heeft juiste link/altnaam; als officiële variant gewenst is, specificeer SVG of transparante full-PNG als asset.

**Verificatie:** Visuele controle echte PNG’s en shell op drie breedtes/beide thema’s; controleer nieuwe tab/refresh zonder zichtbaar verkeerd logo.

**Bewijs van uitvoering:** lokaal geïmplementeerd en technisch gecontroleerd op 17 oktober 2026, branch `codex/htp-f1-visual-basis`. Zie [F1-bewijsrapport](HTP-F1-VERIFICATIE.md) voor bestanden, 78 routegevallen, 283 tests, contrast-/browserbewijs en beperkingen. Wacht op visuele acceptatie/integratie; daarom nog niet Done.

<a id="htp-06"></a>

### HTP-06 — Verifieer bestaande navigatie en legacy-URL’s

- **Bron:** rubriek 01 p.6; 03 p.10-11.
- **Prioriteit / fase / omvang:** P1 / F2 / S.
- **Beoordeling / status:** Al geïmplementeerd (begrensd) / **Te controleren**.
- **Resultaat:** Bewijs dat het losse Updates-menu al ontbreekt en dat bestaande links na opschoning bruikbaar blijven.
- **Afhankelijkheden:** HTP-01.
- **Besluiten / blokkades:** Updates-groepskop niet verwarren met een los dubbel menu-item.
- **Bestaande implementatie:** E03-E04; statisch geen dubbel route-item en bestaande redirects/re-export aangetroffen. Runtime niet getest.

**Acceptatiecriteria**

- [ ] Geen tweede klikbare Updates-ingang naast Marktinzicht; leergroep blijft boven marktgroep.
- [ ] /updates en /weekly-updates openen Marktinzicht; detailaliases en /updates/[market] blijven juiste content/gates tonen.
- [ ] Een route-/querymatrix vermeldt oude slug, marktfilter en tijdstempelgedrag; benodigde ontbrekende querycompatibiliteit wordt als resterend werk geregistreerd vóór acceptatie.

**Verificatie:** Browserroutecheck met direct URL openen/terug/vooruit, gratis/subscriber/admin; oude links incl. query/hash proberen. Code-aanwezigheid alleen is onvoldoende.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-07"></a>

### HTP-07 — Verplaats account- en beheeracties naar avatarmenu

- **Bron:** rubriek 03 p.10-11; 12 p.31-32.
- **Prioriteit / fase / omvang:** P1 / F2 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Een opgeruimde zijbalk met leren/markt en een accountzone onderaan.
- **Afhankelijkheden:** HTP-01, HTP-02, HTP-06.
- **Besluiten / blokkades:** D4 bepaalt of meldingen in hoofdnav blijven.
- **Bestaande implementatie:** E03; geen avatarmenu, Profiel/Admin staan nog bij nav. Bestaande studentName-prop is geen zichtbare accountzone.

**Acceptatiecriteria**

- [ ] Avatar+naam opent klein menu met Profiel, alleen voor bevoegde admins Admin, en Uitloggen; hulp bereikbaar.
- [ ] Profiel/Admin verdwijnen uit inhoudsgroep; mentorrollen en chatbestemming blijven juist; actieve bestemming en focus zijn zichtbaar.
- [ ] Mobiele en desktopnavigatie hebben dezelfde bereikbare acties; menu werkt met toetsenbord, Escape, buitenklik en focusherstel.

**Verificatie:** Rollenmatrix gratis/Academy/subscriber/mentor/admin; signout met bestaande draftschoonmaak; toetsenbord- en schermbreedtecontrole.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-08"></a>

### HTP-08 — Bundel bel en themaknop in echte bovenbalk

- **Bron:** rubriek 03 p.11; 12 p.32.
- **Prioriteit / fase / omvang:** P1 / F2 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Eén bovenbalk met gelijke vierkante controls en mobiel hamburgermenu, zonder overlap met inhoud.
- **Afhankelijkheden:** HTP-01, HTP-02, HTP-07.
- **Besluiten / blokkades:** D4/HTP-11 voor beltoegang op chat- en overzichtsroutes.
- **Bestaande implementatie:** E03, E13; mobiel header/drawer al aanwezig, desktopcontrols los en bel op chat/overzicht verborgen.

**Acceptatiecriteria**

- [ ] Desktop en mobiel tonen bel/themaknop naast elkaar in de balk, pagina-achtergrond zonder schaduw; zwevende versies verwijderd.
- [ ] Mobiele drawer behoudt focusbeheer, sluiting en scroll; main/topbar/safe area overlappen niet.
- [ ] Chatworkspace, adminshell, meldingenoverzicht en lange titels hebben bewust geteste plaatsing; geen verdwenen meldingeningang door oude route-excepties.

**Verificatie:** Viewport/safe-area/zoom 200%, keyboard en lange content testen; check Mux/fullscreen en chat-scrolling; screenshots beide thema’s.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-09"></a>

### HTP-09 — Maak gedeelde meldingenteller, typen en soft delete

- **Bron:** rubriek 12 p.30-32.
- **Prioriteit / fase / omvang:** P1 / F2 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Betrouwbare gedeelde meldingenbron voor preview, badge en overzicht.
- **Afhankelijkheden:** HTP-01.
- **Besluiten / blokkades:** Eventtypen mappen op vraag/technisch/update/module/live/systeem zonder staffinformatie vrij te geven.
- **Bestaande implementatie:** E12-E13: archived_at/type bestaan, geen 30-dagengrens of UI-verwijderactie; RPC mist type in preview.

**Acceptatiecriteria**

- [ ] Badge telt alleen eigen zichtbare ongelezen niet-verwijderde meldingen tot 30 dagen oud; oudere meldingen blijven in gepagineerd overzicht bereikbaar.
- [ ] Bestaand archived_at hergebruiken indien semantisch passend; verwijderen is per ontvanger en verwijdert nooit event/andermans melding.
- [ ] RPC/fallback/realtime gebruiken dezelfde tellerregel en leveren type voor iconen; nieuwe typen alleen na passende RLS-/rolmapping.

**Verificatie:** SQL/integratietests met 0/1/9/10, >50 items, 29/30/31 dagen, verwijderd/gelezen en rolwissel; non-admin en ontbrekende-migratiefallback testen.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-10"></a>

### HTP-10 — Markeer meldingen gelezen bij openen van hun bron

- **Bron:** rubriek 12 p.32.
- **Prioriteit / fase / omvang:** P1 / F2 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Klikken op melding of openen van corresponderende content synchroniseert gelezenstatus.
- **Afhankelijkheden:** HTP-09.
- **Besluiten / blokkades:** Geen.
- **Bestaande implementatie:** E12-E13; dropdown leest vóór open, overzicht heeft losse Open-link; bronopen-koppeling niet algemeen aangetroffen.

**Acceptatiecriteria**

- [ ] Klik opent bron en markeert eigen melding gelezen; hetzelfde gebeurt bij directe contentnavigatie via feed/Academy/live/chat waar de bronrelatie bestaat.
- [ ] Geen read-effect bij alleen preview openen; alles-gelezen werkt voor de volledige eigen set; idempotent gedrag bij refresh/dubbele events.
- [ ] Ontbrekende/verwijderde/ontoegankelijke bron en null-href geven nette feedback; geen ongeautoriseerde data of fouten verborgen als succes.

**Verificatie:** End-to-end via dropdown én directe contentlink; twee tabbladen/reconnect en fout/retry simuleren; rol-/recipient-RLS testen.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-11"></a>

### HTP-11 — Vernieuw meldingendropdown en overzicht

- **Bron:** rubriek 12 p.30-32; 03 p.11.
- **Prioriteit / fase / omvang:** P1 / F2 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Geblokkeerd**.
- **Resultaat:** Consistente badge/dropdown/overzicht met één duidelijke klikactie per melding.
- **Afhankelijkheden:** HTP-08, HTP-09, HTP-10, HTP-04.
- **Besluiten / blokkades:** D4: alleen bel of tevens zijbalk; klik versus eerdere auto-openwens.
- **Bestaande implementatie:** E13: dropdown is aanwezig maar verkeerde badgecap/kleuren/previewgrootte; overzicht heeft losse acties. Geen browsertest.

**Acceptatiecriteria**

- [ ] Rode badge met wit getal, vanaf 10 toont 9+, bij nul verborgen; optionele sidebarbadge komt exact uit dezelfde bron.
- [ ] Dropdown circa 400px (mobiel passend), 5 recentste items, typeicoon/kleur, titelafkapping, rood ongelezenpuntje, relatieve datum en verwijderkruis dat niet navigeert; Escape/buitenklik sluiten.
- [ ] Overzicht met uitleg, ongelezen eerst en per groep datum aflopend; gelezen gearceerd/gedimd én AA-leesbaar; geen losse Gelezen/Openen-knoppen; alles-gelezen en leegstaat Je bent helemaal mee. /notifications behouden of compatibele /meldingen-alias.

**Verificatie:** Vergelijk referenties 5-8; test 0/1/9/10/>50 meldingen, softdelete, direct bronopen, foutafhandeling en keyboard; realtime zonder volledige reload.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-12"></a>

### HTP-12 — Harmoniseer marktmodel en weekhoofdstukken

- **Bron:** rubriek 06 p.17-18; 07 p.20.
- **Prioriteit / fase / omvang:** P1 / F3a / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Eén verliesvrij marktcontract voor legacy- en structured updates, inclusief zes documentmarkten en marktgekoppelde weekhoofdstukken.
- **Afhankelijkheden:** HTP-01; gerichte migratiebaseline gekoppeld aan bestaand issue #28.
- **Besluiten / blokkades:** Bestaand macro/indices/general behouden; onderscheid markt, type en invalshoek vastleggen.
- **Bestaande implementatie:** E06-E07; huidige Markt enum heeft vier markten, arrays plus structured enkelvoudige categorie. Duplicaat model vermijden.

**Acceptatiecriteria**

- [ ] Crypto/Forex/Aandelen/Goud/Commodities/Trading bestaan; één update kan meerdere markten dragen; bestaande waarden/typen/historiek blijven traceerbaar.
- [ ] Structured editor/action/filter overschrijft meerdere markten niet met één categorie; compatibiliteitsmapping en migratie zijn expliciet en herhaalbaar.
- [ ] Weekdatum/periode en hoofdstuk titel+seconden hergebruikt; optionele markt per hoofdstuk toegevoegd/valideerbaar; ongeldige tijd/duur en oude hoofdstukken zonder markt veilig.

**Verificatie:** Voor/na-fixture van alle legacy/structured types en meerdere markten; SQL constraints/RLS + action-/filtertests; migratie dry-run en rollback/databehoudplan in testomgeving.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-13"></a>

### HTP-13 — Maak eenvoudige feednavigatie en dynamische marktchips

- **Bron:** rubriek 06 p.17-18; 02 p.9.
- **Prioriteit / fase / omvang:** P1 / F3b / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Geblokkeerd**.
- **Resultaat:** Zoeken en filteren blijven eenvoudig en tonen alleen bruikbare, toegankelijke markten.
- **Afhankelijkheden:** HTP-03, HTP-12.
- **Besluiten / blokkades:** D2: voorstel navigatielagen en chipdrempel eerst beoordelen.
- **Bestaande implementatie:** E05: zoeken/dropdowns bestaan; geen dynamische chips en teller staat naast kop.

**Acceptatiecriteria**

- [ ] Eerst concreet voorstel voor Actueel/Zones/Vastgepind versus Alles/Tekstupdates/Video updates goedkeuren; charts/PDF-posts hebben duidelijke plaats, geen dubbele navigatie.
- [ ] Chips alleen voor markten met minstens één gepubliceerde toegankelijke update; minstens twee markten en instelbare MIN_ITEMS_FOR_FILTERS; zoekbalk doorzoekt titels/samenvatting over markten.
- [ ] Zichtbare berichtenteller bij Actueel/lijstkop weg; 0 resultaten toont uitleg + Toon alle updates; 1-2 resultaten tonen rustig vervolgblok, geen gedimde ontoegankelijke content.

**Verificatie:** Fixtures 1/5/30 updates en 1/3 markten, gecombineerd zoeken/format/markt, gratis versus betaald, keyboard en mobiele chipoverflow; screenreaderstatus mag resultaataantal behouden.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-14"></a>

### HTP-14 — Maak gedeelde redactionele feedkaarten

- **Bron:** rubriek 06 p.16-18; 02 p.9; 01 p.6.
- **Prioriteit / fase / omvang:** P1 / F3b / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Geblokkeerd**.
- **Resultaat:** Elke update herkenbaar in eigen kader met markt, auteur en thumbnail, gedeeld met vervolgkaarten en dashboard waar passend.
- **Afhankelijkheden:** HTP-03, HTP-04, HTP-12, HTP-13.
- **Besluiten / blokkades:** D3: één kaartlink met hoverpijl of Open update; eerst twee thumbnailcomposities beoordelen.
- **Bestaande implementatie:** E05, E14; thumbnails/playoverlay en samenvatting bestaan, huidige rijen hebben aparte links/klein beeld en mobiel drie regels.

**Acceptatiecriteria**

- [ ] Toon vóór bouw twee varianten: afbeelding links >=40% desktopbreedte of tweekolomskaarten met beeld bovenaan; bestaande thumbnails behouden.
- [ ] Kaart gebruikt oppervlak/hover, avatar+naam+relatieve tijd, MarketTags rechts+neutraal type en dun eerste-marktaccent links; altijd gereserveerde twee samenvattingsregels met inhoudsfallback.
- [ ] Goedgekeurde linkactie levert één focusbare contentlink, geen geneste links; playoverlay op thumbnail zonder live embed; keyboardfocus en reduced-motion; latere PDF-knop krijgt aparte bereikbare actie.

**Verificatie:** 1/5/30 items, lange/ontbrekende tekst, geen thumbnail, meerdere tags; desktop/tablet/mobiel screenshots en link/focus-audit; regressie #30/#32/#33 vergelijken.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-15"></a>

### HTP-15 — Geef weekvooruitblik een eigen hoofdblok

- **Bron:** rubriek 06 p.16,18.
- **Prioriteit / fase / omvang:** P1 / F3b / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Een herkenbaar wekelijks startpunt boven de spontane marktinzichten.
- **Afhankelijkheden:** HTP-12, HTP-13, HTP-14, HTP-24.
- **Besluiten / blokkades:** Kwalitatieve publicatiedata/hoofdstukken beschikbaar; verouderde week duidelijk labelen.
- **Bestaande implementatie:** E06/E09 en lib/weekly-updates.ts:listPublishedWeeklyOutlooks; weekmetadata bestaat, aparte hero niet.

**Acceptatiecriteria**

- [ ] Volle-breedteblok met grote thumbnail, week/periode, titel en MarketTags; daaronder sectie Sindsdien/Marktinzichten.
- [ ] Alleen tonen in juiste Alles-/marktfiltercontext; geen dubbeltelling/ongewenste duplicaatkaart; respecteer free/subscriptionrechten.
- [ ] Marktlinks openen videodetail met tijdstempel; oude week krijgt eerlijk label, ontbreken van een vooruitblik geeft geen lege hero.

**Verificatie:** Weekovergang/jaargrens/Brussel, geen/bestaande/verouderde outlook en marktfilters testen; timestampdelegatie aan HTP-24 en toegangsgates controleren.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-16"></a>

### HTP-16 — Voeg precies twee relevante vervolgkaarten toe

- **Bron:** rubriek 08 p.21-22; 13 p.33.
- **Prioriteit / fase / omvang:** P1 / F3b / M.
- **Beoordeling / status:** Nog uit te voeren / **Backlog**.
- **Resultaat:** Na een artikel/video volgt een zinvolle volgende stap vóór de behouden disclaimer.
- **Afhankelijkheden:** HTP-12, HTP-14.
- **Besluiten / blokkades:** Geen.
- **Bestaande implementatie:** E08: footer heeft alleen Nuttig en disclaimer; related_content in editor is geen geïmplementeerd tweekaartenblok.

**Acceptatiecriteria**

- [ ] Tussen reacties en disclaimer twee kaarten: eerstvolgende recentere update (nieuwste gebruikt vorige) en actuele weekvooruitblik; huidige outlook gebruikt andere update.
- [ ] Geen eigen of dubbele kaart en geen ontoegankelijke/conceptinhoud; bij onvoldoende content alleen echte kandidaten tonen, nooit fictieve twee kaarten.
- [ ] Kaarten gebruiken gedeelde feedcomponent, thumbnail/markttag/relatieve datum; desktop naast elkaar, mobiel onder elkaar; artikeltypografie ongewijzigd.

**Verificatie:** Dataset 0/1/2/veel kandidaten, gelijke timestamps, huidige nieuwste/outlook/archief, gratis versus subscriber; SSR-/browsernavigatie en a11y controleren.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-17"></a>

### HTP-17 — Herstel artikelcontext en genummerde takeaways

- **Bron:** rubriek 08 p.22; 14 p.35-36.
- **Prioriteit / fase / omvang:** P1 / F3b / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Redactionele inhoud zonder lege/formulierachtige secties of dubbele nummering.
- **Afhankelijkheden:** HTP-01.
- **Besluiten / blokkades:** Geen; een volledige zin betrouwbaar beoordelen zonder inhoud te herschrijven.
- **Bestaande implementatie:** E07-E08: lege secties al conditioneel, korte tekst nog sectie; takeaways ul met raw tekst.

**Acceptatiecriteria**

- [ ] Samenvatting/Wat is er gebeurd optioneel in editor; alleen zinvolle volledige zinnen als sectie, korte context als labels, leeg verborgen; structured en legacy pad apart beoordeeld.
- [ ] Key takeaways blijft vaste sectie als gevuld, semantisch ol; render stript uitsluitend voorloopnummer 1. / 1) en editor slaat nieuwe items zonder nummer op.
- [ ] Bestaande inhoud, titel, intro, byline, regellengte, thumbnails en disclaimer blijven behouden; inhoud niet vernietigend opschonen.

**Verificatie:** Fixture leeg/korte woorden/zin/afkorting/numerieke inhoud/HTML/legacy genummerde items; DOM en visuele controle beide contentpaden; veilige opslag/sanitization regressie.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-18"></a>

### HTP-18 — Gebruik update-thumbnail als videoposter

- **Bron:** rubriek 08 p.22; 14 p.35-36.
- **Prioriteit / fase / omvang:** P1 / F4 / S.
- **Beoordeling / status:** Nog uit te voeren / **Backlog**.
- **Resultaat:** Feed en player tonen dezelfde herkenbare update-thumbnail waar provider dit ondersteunt.
- **Afhankelijkheden:** HTP-20.
- **Besluiten / blokkades:** Provider-specifieke posterbeperkingen uit HTP-20.
- **Bestaande implementatie:** E08-E09: MarketPostContents geeft geen thumbnailprop door aan video.

**Acceptatiecriteria**

- [ ] Thumbnail gaat door wrappers naar ondersteunde spelers als poster; geen TradingView-default bij aanwezige geldige thumbnail.
- [ ] Geen/kapotte thumbnail heeft nette fallback en signed-video toegang blijft intact.
- [ ] Providerbeperking expliciet gedocumenteerd en beoordeeld; geen overlay die keyboard/play afvangt of autoplay afdwingt.

**Verificatie:** Test Mux/Vimeo/YouTube daadwerkelijk waar gebruikt, incl. signed/ready/error, light/dark en mobiel; vergelijk poster met lijst.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-19"></a>

### HTP-19 — Onderzoek en reproduceer YouTube-fout 153

- **Bron:** rubriek 14 p.35-36; 06 p.16,18.
- **Prioriteit / fase / omvang:** P1 / F1 (diagnose), herstel pas F4 / S.
- **Beoordeling / status:** Nader te onderzoeken / **Geblokkeerd**.
- **Resultaat:** Een onderbouwde diagnose van fout 153 met een afgebakende herstelactie als de fout bestaat.
- **Afhankelijkheden:** Geen voor broninspectie; getroffen video/URL+omgeving nodig voor gerichte reproductie.
- **Besluiten / blokkades:** Diagnose binnen F1 uitgevoerd. Geblokkeerd: oorspronkelijke getroffen video/update-ID en omgeving ontbreken; herstel hoort na goedkeuring in F4.
- **Bestaande implementatie:** E09; youtube-nocookie iframe aanwezig zonder expliciete referrerPolicy. Oorzaak niet bevestigd.

**Acceptatiecriteria**

- [ ] Leg getroffen update/video/browser/omgeving vast of vermeld expliciet dat reproductie-input ontbreekt.
- [ ] Controleer embed-URL, effectieve iframe-/HTTP-/meta-referrerpolicy en insluitrechten; onderscheid hostconfig/provider/contentfout.
- [ ] Feed blijft thumbnailgedreven; eventuele fix wordt apart binnen goedgekeurde F4 uitgevoerd en getest, geen globale headerwijziging zonder bewijs.

**Verificatie:** Lees code en headers in toegestane testomgeving; reproduceer met bestaande foutvideo en controlewerkende video, bewaar netwerk-/consolebevindingen zonder tokens. Geen productie-instellingen wijzigen.

**Bewijs van uitvoering:** bron-/header-/provideronderzoek vastgelegd in [F1-bewijsrapport](HTP-F1-VERIFICATIE.md); geen reproductie of fix geclaimd, criteria blijven open.

<a id="htp-20"></a>

### HTP-20 — Controleer mogelijkheden van elke videoprovider

- **Bron:** rubriek 09 p.24; 08 p.22.
- **Prioriteit / fase / omvang:** P1 / F3a / S.
- **Beoordeling / status:** Nader te onderzoeken / **Backlog**.
- **Resultaat:** Een geteste provider-/browsermatrix voor snelheid, pitch, controls, shortcuts, events, poster en seek.
- **Afhankelijkheden:** HTP-01 vóór runtimecontrole.
- **Besluiten / blokkades:** Resultaat bepaalt uitvoerbare Mux/Vimeo/YouTube-scope.
- **Bestaande implementatie:** E09-E10; providers bestaan, defaultcontrols zijn niet runtime geïnspecteerd.

**Acceptatiecriteria**

- [ ] Mux/Vimeo/YouTube en daadwerkelijk gebruikte accountinstellingen hebben een matrix ondersteunt/beperkt/onbekend met bewijs.
- [ ] 0,5/0,75 en zichtbare snelheid, pitch, toetsen, fullscreen, timeupdate/ended/seek, mobiele autoplay en toegankelijke controls onderzocht.
- [ ] Afwijkende providerbeperkingen zijn productmatig besloten vóór HTP-18/21-24; bestaand werk niet vervangen zonder reden.

**Verificatie:** Kleine lokale proef met synthetische/geschikte testmedia, accountvoorwaarden en actuele officiële providerdocs controleren bij uitvoering; geen betaalde calls of nieuwe dependencies in analyse.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-21"></a>

### HTP-21 — Voeg snelheidsvoorkeur en veilige sneltoetsen toe

- **Bron:** rubriek 09 p.23-24.
- **Prioriteit / fase / omvang:** P2 / F4 / M.
- **Beoordeling / status:** Nader te onderzoeken / gedeeltelijk / **Backlog**.
- **Resultaat:** Langzamer afspelen en voorspelbare bediening over video’s heen.
- **Afhankelijkheden:** HTP-20.
- **Besluiten / blokkades:** Geen garanties vóór capabilitymatrix; eventuele providerafwijking expliciet besluiten.
- **Bestaande implementatie:** E09; bestaande externe controls mogelijk deels voldoende, voorkeur/centrale afhandeling niet aangetroffen.

**Acceptatiecriteria**

- [ ] 0,5/0,75/1/1,25/1,5/2 en huidige snelheid zichtbaar; voorkeur per gebruiker of veilige localStoragefallback toegepast bij volgende video.
- [ ] Pitchcorrectie aan waar mogelijk; providerbeperking met testbewijs i.p.v. aanname.
- [ ] Spatie, links/rechts ±10s, M en F werken alleen bij juiste focus, nooit tijdens typen of dubbele providerafhandeling; sprongoverlay en reduced-motion.

**Verificatie:** Werkelijke video/audio in desktopbrowser en mobiel, opslagweigering, wisselen video/account, inputfocus en iframefocus; hoorbare pitchtest en keyboardcontrole.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-22"></a>

### HTP-22 — Modelleer veilige videopositie en voltooiing

- **Bron:** rubriek 09 p.24; 13 p.34.
- **Prioriteit / fase / omvang:** P1 / F4 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Geblokkeerd**.
- **Resultaat:** Serverpositie per gebruiker en les/update, zonder bestaande leerrechten of voltooid-historie te verliezen.
- **Afhankelijkheden:** HTP-20; gerichte migratiebaseline.
- **Besluiten / blokkades:** D10: 95% bekeken versus examen-/lesgates; updates gevolgd definiëren.
- **Bestaande implementatie:** E10; uitsluitend watched-status, geen hervatpositieveld. E15 bevat examengates.

**Acceptatiecriteria**

- [ ] Positie/duur/update-identiteit per eigenaar en videoversie, unieke sleutel en RLS; bestaande watched/watched_at blijft behouden.
- [ ] Opslag valideert grenzen/ownership/toegang; updates op gedeeltelijke positie markeren niet stil volledig bekeken; 95%-regel expliciet gemapt op bestaande completion/gating.
- [ ] Concurrerende apparaten, retries, vervangen video en verlopen rechten hebben voorspelbare afspraken; metadata bevat geen afspeeltokens.

**Verificatie:** SQL-/actiontests als non-admin met vreemde gebruiker/video, invalid duration/position en herhaalde requests; migratie-fixtures en rollbackplan.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-23"></a>

### HTP-23 — Sla videopositie op en toon hervatten in speler/lijsten

- **Bron:** rubriek 09 p.24.
- **Prioriteit / fase / omvang:** P1 / F4 / M.
- **Beoordeling / status:** Nog uit te voeren / **Backlog**.
- **Resultaat:** Betrouwbaar hervatten met beperkte gegevensverliezen en zichtbare voortgang.
- **Afhankelijkheden:** HTP-21, HTP-22.
- **Besluiten / blokkades:** D10 bij meerdere apparaten; sluiten browser is best-effort.
- **Bestaande implementatie:** E10; ended-updates zijn geen periodieke resume-opslag. Geen runtimebewijs.

**Acceptatiecriteria**

- [ ] Positie circa elke 10s en bij pauze opslaan; sluiten/pagehide best-effort; fout/offline/retry geeft geen ongecontroleerde write-lus.
- [ ] Nieuwe sessie/toestel biedt Verder kijken vanaf mm:ss of melding met Opnieuw beginnen; niet over voltooiingsgrens heen gokken.
- [ ] Thumbnailbalk voor gedeeltelijk bekeken en Bekeken voor voltooid, inclusief feed/Academy/collecties waar video voorkomt; 95% conform HTP-22.

**Verificatie:** Twee browsers/apparaten met dezelfde gebruiker, pauze/reload/tabsluit/netwerkfout en snelle videowissel; controleer positie binnen afgesproken 10s-tolerantie na laatste geslaagde write; les/examenregressie.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-24"></a>

### HTP-24 — Maak hoofdstukken sticky, actief en via marktlinks bereikbaar

- **Bron:** rubriek 08 p.21-22; 09 p.24; 06 p.18.
- **Prioriteit / fase / omvang:** P1 / F3b / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Eén hoofdstuk-/seekcontract voor outlooklinks, detail en actuele playerpositie.
- **Afhankelijkheden:** HTP-12, HTP-20.
- **Besluiten / blokkades:** Provider met ontbrekende API eerst afhandelen in HTP-20.
- **Bestaande implementatie:** E09: bestaande hoofdstukken onder video met Mux/Vimeo seek, geen active tracking/sticky/mobilecollapse.

**Acceptatiecriteria**

- [ ] Desktop sticky rail In deze video met tijd+title, mobiel inklapbaar direct onder video; huidige hoofdstuk actief gemarkeerd.
- [ ] Klik springt en start afspelen binnen browserregels; URL-tijdstip opent de juiste video op de bedoelde plek, ook opnieuw hetzelfde tijdstip.
- [ ] Ongeldige/ontbrekende hoofdstukken of onondersteunde provider geven bruikbare fallback; goedgekeurde hoofdstukken blijven van drafts gescheiden.

**Verificatie:** Eerste/middelste/laatste/zelfde hoofdstuk, autoplayblokkade en direct URL incl. legacyalias; toetsenbord/mobile en provider-matrix.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-25"></a>

### HTP-25 — Beslis PDF-contract, rubrieken en beschermingsniveau

- **Bron:** rubriek 11 p.27-29; 00 p.5.
- **Prioriteit / fase / omvang:** P1 / F5a / M.
- **Beoordeling / status:** Nader te onderzoeken / **Geblokkeerd**.
- **Resultaat:** Een reviewbaar technisch ontwerp en kleine proef vóór private PDF-implementatie.
- **Afhankelijkheden:** HTP-01; baseline-/rechtenonderzoek E15/E18.
- **Besluiten / blokkades:** D7, D8: rubriek/toegang, toegankelijkheid, watermark/logging en renderstrategie.
- **Bestaande implementatie:** E15/E18; geen PDF-keten of rubriekentiteit aangetroffen. Referenties 3-4 zijn in PDF beschikbaar.

**Acceptatiecriteria**

- [ ] Toegangscontract per update/Academy-rubriek/Toolbox, PDF-bestandslimieten en render-/proxy-/signedstrategie vastgelegd; geen publieke bestands-URL.
- [ ] Bescherming eerlijk: screenshots/OCR/bytes blijven mogelijk; canvas zonder tekstlaag versus AA heeft een overeengekomen toegankelijke route.
- [ ] Watermark naam/e-mail/datum, logbewaring/adminrechten en kandidaat pdf.js/worker/dependencyreden beoordeeld; proef toont mobiel geheugen/zoom en groot document.

**Verificatie:** Ontwerpreview met rechtenmatrix en threat-/cachecases binnen deze feature; proef pas na goedkeuring F5a met synthetische PDF. Resultaat stopt vóór F5b als contract niet geaccepteerd.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-26"></a>

### HTP-26 — Maak private PDF-opslag en geautoriseerde uitlevering

- **Bron:** rubriek 11 p.29 A1-2.
- **Prioriteit / fase / omvang:** P1 / F5a / M.
- **Beoordeling / status:** Nog uit te voeren / **Backlog**.
- **Resultaat:** PDF-objecten en metadata zijn uitsluitend via gecontroleerde toegang beschikbaar.
- **Afhankelijkheden:** HTP-25; gevalideerde migratiebaseline.
- **Besluiten / blokkades:** Uitkomst D7/D8.
- **Bestaande implementatie:** E18 private charts als patroon, geen PDF-opslag/endpoint aangetroffen.

**Acceptatiecriteria**

- [ ] Private opslag, geschoonde metadata/titel/pagina-aantal/versie en adminupload met formaat-/groottecontrole; geen publieke bron-URL in feed/HTML.
- [ ] Elke uitlevering valideert sessie én update/rubriekrechten, incl. range requests; kortlevende credentials of proxy conform goedgekeurd contract, geen cross-user cache.
- [ ] Vreemde ID, ingetrokken toegang, draft/verwijderd bestand en vervallen sessie blokkeren leesbaar; upload-/verwijderfouten laten herstelbare metadata achter.

**Verificatie:** Non-admin HTTP/SQL-integratie met eigenaar/geautoriseerd/ongeautoriseerd/anon en getamperde paden; cacheheaders/expiry/range testen; synthetische documenten.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-27"></a>

### HTP-27 — Personaliseer PDF-watermerken en registreer openacties

- **Bron:** rubriek 11 p.28-29 A6-7.
- **Prioriteit / fase / omvang:** P1 / F5a / M.
- **Beoordeling / status:** Nog uit te voeren / **Backlog**.
- **Resultaat:** Elk gelezen document heeft de afgesproken herleidbare markering en een beperkt beheerlog.
- **Afhankelijkheden:** HTP-25, HTP-26.
- **Besluiten / blokkades:** D8: watermarkvariant en gegevens/logbewaring.
- **Bestaande implementatie:** Geen bestaande PDF-watermark/openlog aangetroffen; E18 toont huidige toegangspatronen.

**Acceptatiecriteria**

- [ ] Elke pagina toont herhaald diagonaal naam+e-mail+datum, circa 8-10% dekking maar leesbaar; serververankering indien gekozen, overlaybeperking expliciet.
- [ ] Geen watermark/cached document van andere gebruiker zichtbaar; naamswissel/datum/versie en opnieuw openen volgen vastgelegde regels.
- [ ] Openlog toont wie/welk document/wanneer voor bevoegde beheerder; geen downloadtokens in log; bewaartermijn en inzage conform D8.

**Verificatie:** Synthetische twee gebruikers dezelfde PDF, cache-/concurrencytest, tekst/chartleesbaarheid op mobiel en zoom; controle dat watermark in geleverde inhoud zit als servervariant gekozen.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-28"></a>

### HTP-28 — Bouw één gedeelde toegankelijke PDF-viewer

- **Bron:** rubriek 11 p.27-29 A3-5.
- **Prioriteit / fase / omvang:** P1 / F5a / M.
- **Beoordeling / status:** Nog uit te voeren / **Backlog**.
- **Resultaat:** Eén ProtectedPdfViewer voor updates, Academy en Toolbox.
- **Afhankelijkheden:** HTP-25, HTP-26, HTP-27.
- **Besluiten / blokkades:** D8 bepaalt tekstlaag/toegankelijke route en blokkades.
- **Bestaande implementatie:** Niet aangetroffen; E08 heeft chartdialog die geen PDF-viewer is.

**Acceptatiecriteria**

- [ ] Volledig venster met donkere achtergrond, titel/sluiten, Escape/focusbeheer, gecentreerde scrollpagina’s, paginastand en zoom +/−/passend; responsive en fout/loading/herstel.
- [ ] Geen native PDF-iframe/downloadknop; gekozen canvas-/alternatieve toegankelijkheidsroute volgt D8; lazy/virtuele rendering voorkomt mobiele geheugengroei.
- [ ] Rechtsklik/slepen/S/P/C alleen binnen viewer afremmen voor zover gekozen; printinhoud verbergen; geen claim absolute beveiliging en geen globale keyboardblokkade.

**Verificatie:** Referentie 3 vergelijken; toetsenbord/screenreader/200% zoom, 1 en veel pagina’s, kapotte/versleutelde/grote PDF, netwerkonderbreking en sessieverval.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-29"></a>

### HTP-29 — Koppel PDF-bijlagen aan updates en feed

- **Bron:** rubriek 11 p.29 B; 06 p.18.
- **Prioriteit / fase / omvang:** P1 / F5b / M.
- **Beoordeling / status:** Nog uit te voeren / **Backlog**.
- **Resultaat:** Admins publiceren één of meer PDF’s bij een update; leden openen ze vanuit feed en detail.
- **Afhankelijkheden:** HTP-14, HTP-26, HTP-28.
- **Besluiten / blokkades:** Geen extra productbesluit na PDF-contract.
- **Bestaande implementatie:** E07-E08/E18; bestaande formatvalidatie kent video/chart/text en geen PDF-relatie.

**Acceptatiecriteria**

- [ ] Editor accepteert titel+bestand+optionele cover, meerdere bijlagen, volgorde/verwijderen en nette upload-/publicatiefouten.
- [ ] Tekst+PDF zonder video is geldig; publicatie/access/notificatievalidatie laat dit toe zonder rechten af te zwakken of dubbele meldingen te sturen.
- [ ] Feed/detail tonen cover of icoon, titel, pagina-aantal en Openen in gedeelde viewer; PDF-actie en kaartlink hebben geen geneste links/conflicterende focus.

**Verificatie:** Publiceer synthetische draft met/zonder video/cover en meerdere PDF’s, wijzig bijlage, test gratis/subscriber; directe request zonder recht; keyboard/open/close en mislukte upload.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-30"></a>

### HTP-30 — Voeg Academy-rubrieken en PDF-tab met beheer toe

- **Bron:** rubriek 11 p.27-29 C1-2,4-5.
- **Prioriteit / fase / omvang:** P1 / F5b / M.
- **Beoordeling / status:** Nog uit te voeren / **Geblokkeerd**.
- **Resultaat:** Academy toont Video/PDF/Toolbox binnen goedgekeurde rubrieken zonder huidig leerpad te breken.
- **Afhankelijkheden:** HTP-25-28; rechtenbesluit vóór migratie.
- **Besluiten / blokkades:** D7: module/rubriekrelatie en inhoudsindeling.
- **Bestaande implementatie:** E15: huidige Academy is modulevolgorde met theorie/praktijk, geen Crypto-rubriekmodel.

**Acceptatiecriteria**

- [ ] Rubriekrelatie additief met expliciete modulemapping; bestaande module-/les-URL’s, examengates en voortgang blijven bestaan.
- [ ] Tabs Videocursus/PDF cursussen/Toolbox bewaren keuze in URL; lege tabs verborgen; ongeldige tab heeft fallback; actief accentonderlijn.
- [ ] PDF-kaarten hebben cover/titel/korte beschrijving/pagina-aantal; admin kan uploaden/ordenen/verwijderen en toegang per rubriek beheren met gedeelde viewer.

**Verificatie:** Migratie-fixture zonder/met rubrieken, old URLs en ?tab=pdf direct openen; gratis/Academy/subscription/legacy/admin; lege/gevulde tabs en mobiel.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-31"></a>

### HTP-31 — Maak een eenvoudige beheerde Toolbox

- **Bron:** rubriek 11 p.28-29 C3-5; 15 p.38.
- **Prioriteit / fase / omvang:** P2 / F5b / M.
- **Beoordeling / status:** Nog uit te voeren / **Geblokkeerd**.
- **Resultaat:** Een beheerbare lijst van PDF’s, links en bestanden, zonder aanvullende appfeatures.
- **Afhankelijkheden:** HTP-25, HTP-26, HTP-28, HTP-30.
- **Besluiten / blokkades:** D7: daadwerkelijke Toolbox-inhoud en bestandstoegang.
- **Bestaande implementatie:** Geen Toolbox aangetroffen; inhoud niet aangeleverd. E15/E18 zijn integratiepunten.

**Acceptatiecriteria**

- [ ] Item heeft titel/beschrijving/type PDF-link-bestand, rubriek/volgorde en beheeractie toevoegen/ordenen/verwijderen.
- [ ] PDF opent dezelfde beschermde viewer; bestanden hebben expliciete toegangspolicy, links valide veilige URL’s; lege Toolboxtab verborgen.
- [ ] Geen calculators of inhoud verzonnen; ontbrekende assets/content houden deze taak geblokkeerd of ongevuld buiten de release.

**Verificatie:** Synthetisch item per type, gevaarlijke URL/ontoegankelijk bestand en lege tab; toetsenbord/mobile, beheerrechten en directe downloadtoegang conform D7.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-32"></a>

### HTP-32 — Onthoud PDF-leespositie per gebruiker

- **Bron:** rubriek 11 p.29 C2; 13 p.34.
- **Prioriteit / fase / omvang:** P2 / F5b / S.
- **Beoordeling / status:** Nog uit te voeren / **Backlog**.
- **Resultaat:** Academy-PDF heropent op de laatst gelezen pagina zonder positie van anderen te lekken.
- **Afhankelijkheden:** HTP-26, HTP-28, HTP-30.
- **Besluiten / blokkades:** Geen.
- **Bestaande implementatie:** Geen PDF-leespositiemodel aangetroffen; video watched is hiervoor niet bruikbaar.

**Acceptatiecriteria**

- [ ] Eigenaar+documentversie heeft geldige laatst bekeken pagina; opslag begrensd en alleen bij toegang.
- [ ] Heropenen hervat, herstartmogelijkheid aanwezig; nieuwe documentversie/andere paginatelling corrigeert veilig.
- [ ] Twee apparaten en offline-/writefout zijn herstelbaar; positieopslag wordt niet als werkelijk uitgelezen bewijs gebruikt.

**Verificatie:** Twee gebruikers/apparaten, eerste/laatste pagina, vervangen document en ingetrokken toegang; SQL/actions en viewerheropenen.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-33"></a>

### HTP-33 — Migreer setups naar expliciete zonestatussen

- **Bron:** rubriek 07 p.19-20.
- **Prioriteit / fase / omvang:** P2 / F6 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Geblokkeerd**.
- **Resultaat:** Een verliesvrij zonecontract met behoud van bestaande scenario’s en opvolging.
- **Afhankelijkheden:** HTP-12; gerichte migratiebaseline.
- **Besluiten / blokkades:** D5: naam en mapping waiting/running/closed+reason naar vijf staten.
- **Bestaande implementatie:** E06-E07: invalidation en historie bestaan, huidige status heeft slechts waiting/running/closed.

**Acceptatiecriteria**

- [ ] Markten/instrument/zone/scenario/invalidering/status/aangemaakt/bijgewerkt, optionele update/video en slotcommentaar opgenomen of expliciet gemapt op bestaande structuur.
- [ ] Actief/Zone geraakt/Uitgespeeld/Ongeldig geworden/Gesloten hebben toegestane transities; Ongeldig als server-side verplicht bij publicatie.
- [ ] Bestaande entry/targets/afsluitreden/historiek blijven traceerbaar; onzekere historische mapping krijgt reviewlijst, geen verzonnen status.

**Verificatie:** Migratie dry-run met elke status/reason/legacy-null, actionvalidatie en non-admin RLS; controles op aantal/history voor-na en rollbackplan.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-34"></a>

### HTP-34 — Toon zones als denkkader met actieve en afgelopen sectie

- **Bron:** rubriek 07 p.19-20.
- **Prioriteit / fase / omvang:** P2 / F6 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Leden zien de redenering, geldigheid en ook mislukte/afgelopen scenario’s; admin kan ze bijwerken.
- **Afhankelijkheden:** HTP-03, HTP-13, HTP-33.
- **Besluiten / blokkades:** D5: definitieve label/slug.
- **Bestaande implementatie:** E05/E07: open-setupfilter bestaat, sluiting uit openlijst; invalidation zichtbaar op detail maar niet in huidige feedrij.

**Acceptatiecriteria**

- [ ] ZONES_LABEL centraal; eventuele oude slug redirect, geen fictieve route verwijderen wanneer tab alleen state was.
- [ ] Elke rij/kaart toont markt/instrument/zone/statusicoon en Ongeldig als altijd zichtbaar; Actief en Afgelopen bevatten ook ongeldige/mislukte zones.
- [ ] Vaste uitleg geen koop/verkoopadvies + disclaimerlink; neutrale statuskleuren; beheerformulier en statusupdates bewaren historiek.

**Verificatie:** Volledige statustabel en archived/invalid records, lange invalidering, mobiel/keyboard; maak/wijzig/sluit als admin en lees als lid zonder signalen te suggereren.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-35"></a>

### HTP-35 — Maak educatieve pincollecties met beheer en volgorde

- **Bron:** rubriek 07 p.19-20.
- **Prioriteit / fase / omvang:** P2 / F6 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Geblokkeerd**.
- **Resultaat:** Vastgepind bevat belangrijke video’s/updates per reeks met beheersbare volgorde.
- **Afhankelijkheden:** HTP-12, HTP-14; HTP-23 voor echte videovoortgang.
- **Besluiten / blokkades:** D6: relatie bestaande twee tijdelijke pins en blijvende collecties.
- **Bestaande implementatie:** E06-E07: pinned_rank is 1/2 en max-twee DB-guard; geen collecties/blijvende lijst.

**Acceptatiecriteria**

- [ ] Pin/unpin, vrije volgorde en optionele collectie werken zonder twee huidige tijdelijke posities stil te overschrijven.
- [ ] Kaarten tonen grote bestaande thumbnail/titel/duur, gegroepeerd per reeks en bestaande betrouwbare bekijkvoortgang; geen gefingeerde reekspercentages.
- [ ] Admin kan ordenen met toetsenbordbereikbare pijlen (drag optioneel); toegang/draft/unpublish blijft doorwerken in verzameling.

**Verificatie:** Meerdere reeksen >2 items, gelijkvolgorde/concurrent pinnen, ontbrekende duur en onpublish; non-admin directe contenttoegang en voortgang.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-36"></a>

### HTP-36 — Behoud archief via zoeken, beheer en directe links

- **Bron:** rubriek 07 p.19-20; 06 p.18.
- **Prioriteit / fase / omvang:** P2 / F6 / S.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Archieftab verdwijnt voor leden, oude inhoud blijft aantoonbaar vindbaar.
- **Afhankelijkheden:** HTP-13, HTP-35.
- **Besluiten / blokkades:** Geen na D2/D6.
- **Bestaande implementatie:** E05: huidige search filtert archief vóór tekstmatching; E07 beheert archive; E18 rubric-query leest alle pagina’s.

**Acceptatiecriteria**

- [ ] Nieuwe ledennavigatie Actueel/Zones/Vastgepind; geen verlies van archiefdata of URL’s.
- [ ] Zoeken omvat toegankelijke oudere/archiefupdates ook vanuit de standaardingang; admin heeft afzonderlijke archiefweergave.
- [ ] Geen paywallomzeiling via zoeken/collecties/gerelateerde kaarten, resultaten duidelijk historisch gelabeld.

**Verificatie:** Zoek op alleen-in-archief term vanaf standaardtab; direct oude link, adminarchief en non-admin toegang; >250 records/pagineringfixture.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-37"></a>

### HTP-37 — Voeg loop-video toe aan login/registratiepaneel

- **Bron:** rubriek 04 p.12-13.
- **Prioriteit / fase / omvang:** P2 / F7 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Geblokkeerd**.
- **Resultaat:** Login blijft vertrouwd en krijgt links configureerbare stille loop met leesbare boodschap.
- **Afhankelijkheden:** HTP-02, HTP-05; video+poster+copy.
- **Besluiten / blokkades:** D9: media/finale copy en mobiele banner versus verborgen paneel.
- **Bestaande implementatie:** E17: twee kolommen en modewissel bestaan; loopbestand/poster/copy ontbreken als aangeleverde assets.

**Acceptatiecriteria**

- [ ] Desktop circa 50/50, video autoplay muted loop playsinline cover met poster en gradient; logo linksboven en korte kop/zin linksonder.
- [ ] Reduced motion toont alleen poster; mobiel afgesproken 30%-banner of geen paneel, formulier bruikbaar zonder video/netwerk.
- [ ] Bestaande tabs/registratie/herstel/offer-intent en redirects blijven werken; publieke homepage niet automatisch vervangen.

**Verificatie:** Aangeleverde media, traag/offline/autoplayblokkade/reduced-motion, login/register/reset, toetsenbord/mobile en beide thema’s; beeld/compressie/performance controleren.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-38"></a>

### HTP-38 — Toon welkomstvideo éénmalig aan nieuwe accounts

- **Bron:** rubriek 04 p.12-13.
- **Prioriteit / fase / omvang:** P2 / F7 / M.
- **Beoordeling / status:** Nog uit te voeren / **Geblokkeerd**.
- **Resultaat:** Nieuwe leden krijgen een overslaanbare rondleiding die later opnieuw geopend kan worden.
- **Afhankelijkheden:** HTP-07; welkomstvideo en goedgekeurde modalopbouw.
- **Besluiten / blokkades:** D9: uiterlijk, bron en gezien versus werkelijk bekeken.
- **Bestaande implementatie:** E17; geen welkomvideostate of modal aangetroffen. Voorbeeld/asset ontbreekt in bron.

**Acceptatiecriteria**

- [ ] Accountgebonden state met veilige migratie: alle accounts van vóór cutover krijgen gezien=true; alleen eerste succesvolle normale login van nieuwe registratie triggert.
- [ ] Modal met titel/video/Aan de slag/Later bekijken, Escape/buitenklik en einde sluiten volgens afgesproken geziensemantiek; focus correct en geen herhaling na refresh/apparaatwissel.
- [ ] Profielmenu kan opnieuw openen; password recovery/invite/checkoutreturn/onboarding leveren geen ongewenste dubbele modals of verloren redirect.

**Verificatie:** Oud/nieuw account rond cutover, meerdere tabs, overslaan/einde/heropenen, netwerkfout en ontbrekende videobron; geen productieaccountmigratie in analyse.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-39"></a>

### HTP-39 — Ruim dashboardbasis op voor admin en lid

- **Bron:** rubriek 05 p.14-15.
- **Prioriteit / fase / omvang:** P1 / F2 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Inhoud krijgt voorrang boven lege beheercards; rolgerichte structuur blijft bestaan.
- **Afhankelijkheden:** HTP-01, HTP-02, HTP-04, HTP-08.
- **Besluiten / blokkades:** D12: alleen concrete basis; ruimer redesign later.
- **Bestaande implementatie:** E14; admin lege blokken en bottomlinks bestaan, rail fixed width; rolgerichte pagina en pijlen zijn al aanwezig.

**Acceptatiecriteria**

- [ ] Geen grote lege vraag/concept/sessiekaarten boven inhoud; compact samenvatten of verbergen, relevante content omhoog.
- [ ] Drie beheerlinks bovenaan als secundaire knoppen en alleen voor bevoegde admins; composer/mentorvragen blijven bereikbaar.
- [ ] Carrousel toont hele kaarten of bewuste eindfade, met pijlen/swipe/toetsenbord; geen dubbele leer-CTA of toegangsgat.

**Verificatie:** Nul/veel vragen/concepten/sessies, admin/mentor/lid; drie breedtes en beide thema’s; bestaande #34/#31 acceptance als vergelijkingscontext, nieuw bewijs vastleggen.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-40"></a>

### HTP-40 — Leg vorige-bezoeksnapshot en geopende items vast

- **Bron:** rubriek 05 p.15; 13 p.33-34.
- **Prioriteit / fase / omvang:** P2 / F8 / M.
- **Beoordeling / status:** Nog uit te voeren / **Backlog**.
- **Resultaat:** Nieuw-sinds-bezoek is gebaseerd op een stabiel eerder bezoek en eigen geopende items, los van presence.
- **Afhankelijkheden:** HTP-01; gerichte migratiebaseline.
- **Besluiten / blokkades:** D10: sessiegrens/writes en betekenis publicatiemoment vastleggen.
- **Bestaande implementatie:** E14 en lib/students.ts/types; last_seen bestaat als profielveld maar geen bewezen sessiesnapshot of itemseen.

**Acceptatiecriteria**

- [ ] Snapshot per gebruiker bij sessiestart blijft gedurende sessie gelijk; update bij vertrek of afgesproken interval, niet bij elke paginaopen.
- [ ] Eigen geopend-itemstatus voor update/module/PDF heeft unieke sleutel/versie; serverautorisatie/RLS en idempotentie.
- [ ] Eerste account/ontbrekende datum/twee tabs/offline hebben expliciete defaults; students.last_seen en chatpresence niet onbedoeld hergebruikt of overschreven.

**Verificatie:** Klokgestuurde unit/SQL/actiontests op sessie/refresh/apparaten, eigen/vreemde items, publicatie aan grens en feature-uitgeschakelde toestand.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-41"></a>

### HTP-41 — Toon nieuwregel en verdwijnende Nieuw-labels

- **Bron:** rubriek 05 p.15; 13 p.34.
- **Prioriteit / fase / omvang:** P2 / F8 / M.
- **Beoordeling / status:** Nog uit te voeren / **Backlog**.
- **Resultaat:** Leden herkennen nieuwe toegankelijke content en labels verdwijnen na openen.
- **Afhankelijkheden:** HTP-13, HTP-29, HTP-30, HTP-40.
- **Besluiten / blokkades:** D11: nieuwlabelaccent versus accentbeleid.
- **Bestaande implementatie:** E14/E15: huidige Nieuw in Marktinzicht is sectietitel, geen per-gebruiker nieuwsignaal.

**Acceptatiecriteria**

- [ ] Dashboard toont klikbare nieuw-sinds-bezoekregel met updates/modules, bij nul verborgen; geen reset op refresh binnen dezelfde sessie.
- [ ] Update/module/PDF gepubliceerd na snapshot krijgt Nieuw in feed/Academy/PDF-kaarten; verdwijnt na eigen open, niet pas volgende bezoek.
- [ ] Telling/labels gebruiken dezelfde publicatiedefinitie en rechten; concept/republish/inhoudsupdate is expliciet geregeld, geen misleidend Nieuwste=nieuw-voor-jou.

**Verificatie:** Twee sessies en apparaten, open via meerdere ingangen, nul/veel/ontoegankelijke/nieuw-gepubliceerde items; terugnavigatie en realtime/navigatierefresh.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-42"></a>

### HTP-42 — Voeg volgende-modulekaart en rubriekafsluiting toe

- **Bron:** rubriek 13 p.33-34.
- **Prioriteit / fase / omvang:** P2 / F8 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Iedere Academy-module eindigt met een heldere, toegestane volgende leerstap.
- **Afhankelijkheden:** HTP-30 (rubriekmapping), HTP-14.
- **Besluiten / blokkades:** Geen.
- **Bestaande implementatie:** E14-E15: nextStep binnen leerpad bestaat, gevraagde modulefooter niet.

**Acceptatiecriteria**

- [ ] Onderaan module grote kaart met thumbnail/titel/duur en Terug naar overzicht; juiste volgende module op volgorde.
- [ ] Bij laatste in rubriek Rubriek afgerond + echte volgende-rubrieksuggestie; geen fictieve suggestie bij laatste beschikbare rubriek.
- [ ] Gates/intake/examen/legacyrechten blijven leidend; locked opvolger heeft eerlijke CTA, geen verborgen lesinhoud of ongewenst ontgrendelen.

**Verificatie:** Eerste/middelste/laatste module/rubriek, lege cursus, locked/free/legacy/volledige toegang; nav/back en bestaand next-stepgedrag testen.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-43"></a>

### HTP-43 — Verbind livesessie, opname en volgende aankondiging

- **Bron:** rubriek 13 p.33-34.
- **Prioriteit / fase / omvang:** P2 / F8 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Afgelopen livesessies leiden naar beschikbare opname, volgende aankondiging verwijst naar vorige.
- **Afhankelijkheden:** HTP-16; bestaand livesessie/replaymodel.
- **Besluiten / blokkades:** Geen; opname niet automatisch beschikbaar beloven.
- **Bestaande implementatie:** E16: replaymodel/adminlink en afgelopenlijst bestaan; volgende aankondiging heeft geen vorige-replaylink.

**Acceptatiecriteria**

- [ ] Beschikbare gekoppelde replay verschijnt op sessieplek; ontbrekend/nog-verwerkend/verlopen toont eerlijke status.
- [ ] Aankondiging van volgende sessie linkt naar recentste toegankelijke vorige opname; geen verlopen/draftreplaylink.
- [ ] Handmatige koppeling in admin en replaybeschikbaarheidsvensters blijven werken; annulering/overlap en rechten correct.

**Verificatie:** Geplande/live/afgelopen/geannuleerde sessies met geen/geldige/verlopen replay, weekgrens; subscriber/non-subscriber en directe routecheck.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-44"></a>

### HTP-44 — Toon rustige voortgang en één Verder-kijkenkaart op dashboard

- **Bron:** rubriek 13 p.34; 05 p.14-15.
- **Prioriteit / fase / omvang:** P2 / F8 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Leden zien echte leer-/updatevoortgang en één hervatbare video zonder gamification.
- **Afhankelijkheden:** HTP-22, HTP-23, HTP-30, HTP-39.
- **Besluiten / blokkades:** D10/D12: gevolgd-definitie en plaatsing bij bestaande leerhero.
- **Bestaande implementatie:** E10/E14-E15: lesbalk/nextstep bestaan, geen positiegebaseerde resume of rubriek-/maandaggregatie.

**Acceptatiecriteria**

- [ ] Per Academy-rubriek x/y modules met dunne voortgangsbalk en Updates gevolgd deze maand n volgens afgesproken betekenis, geen dubbel tellen.
- [ ] Alleen bij gedeeltelijke video één Verder kijken-kaart met thumbnail, voortgang en resterende tijd; voltooide/ontoegankelijke/verwijderde video uitgesloten.
- [ ] Rolverdeling en bestaande leeractie blijven helder zonder dubbele CTA; geen punten/streaks/vlammetjes/badges.

**Verificatie:** Module-/updatefixtures met maand-/tijdzonegrens en twee apparaten; geen progress/volledig bekeken/rechtenverlies; drie breedtes en toetsenbord.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-45"></a>

### HTP-45 — Breid reacties uit met drie betekenissen en veilige UI

- **Bron:** rubriek 10 p.25-26; 01 p.6.
- **Prioriteit / fase / omvang:** P2 / F9 / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Nuttig/Scherp/Veranderde mijn beeld als configureerbare reacties, maximaal vijf, zonder comments.
- **Afhankelijkheden:** HTP-01; gerichte migratiebaseline.
- **Besluiten / blokkades:** Reactievoorbeelden zijn voorstel: labels/betekenissen bij F9 goedkeuren.
- **Bestaande implementatie:** E11: bestaande toggle/unique/RPC hergebruiken, direct totaal en servervolgende UI voldoen nog niet.

**Acceptatiecriteria**

- [ ] Eén reactie per gebruiker/artikel; wisselen/intrekken idempotent; bestaande reacties verliesvrij naar Nuttig; RLS en aggregatie geven geen ontoegankelijke content vrij.
- [ ] Aantallen verborgen vóór eigen reactie, daarna alleen getallen >=5; gekozenstaat toegankelijk gevuld, 150-250ms pop met reduced-motion.
- [ ] Optimistic UI wijzigt direct en draait terug bij fout; snel dubbelklikken/gelijktijdig wisselen blijft correct; geen playerreset bij reactie.

**Verificatie:** Uniek-/migratie-/RPCtests; 0/1/4/5 en eigen/niet-eigen reactie, wisselen/intrekken/fout/retry; keyboard/reduced-motion en video blijft doorspelen.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-46"></a>

### HTP-46 — Voeg beperkte reactie-inzichten voor beheer toe

- **Bron:** rubriek 10 p.26.
- **Prioriteit / fase / omvang:** P2 / F9 / S.
- **Beoordeling / status:** Nog uit te voeren / **Backlog**.
- **Resultaat:** Admin ziet verdeling en artikelen die weinig reacties ontvingen in laatste 30 dagen.
- **Afhankelijkheden:** HTP-45.
- **Besluiten / blokkades:** Definitie minste reacties = expliciet absolute aantallen, geen kwaliteitsoordeel zonder bereikdata.
- **Bestaande implementatie:** E11/E07: geen reactiesrapport aangetroffen.

**Acceptatiecriteria**

- [ ] Per artikel aantal per type; overzicht laatste 30 dagen sorteert minste reacties inclusief nul, stabiel bij gelijke aantallen.
- [ ] Alleen bevoegde beheerder krijgt aggregatie; filters/periode/ontbrekende data duidelijk; geen individuele gebruikerslijst afleiden uit verzoek.
- [ ] Geen claims over inhoudskwaliteit zonder bereik-/leestijddata, geen nieuwe tracking buiten scope.

**Verificatie:** Beheer versus lid/mentor, 0/verschillende types en 29/30/31-daggrens, gepubliceerde/draft/archiefitems volgens vastgelegde selectie.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.

<a id="htp-47"></a>

### HTP-47 — Maak fasebewijs en integrale regressie aantoonbaar

- **Bron:** rubriek 00 p.5; 15 p.37-38; alle behouden punten p.6.
- **Prioriteit / fase / omvang:** P0 / F10 + iedere fase / M.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Backlog**.
- **Resultaat:** Elke release heeft controleerbaar bewijs en een laatste ketentest over de gekozen fasen.
- **Afhankelijkheden:** HTP-01; telkens relevante taken, eindgate alle goedgekeurde fasen.
- **Besluiten / blokkades:** Geen.
- **Bestaande implementatie:** Tests en CI bestaan, maar zijn voor deze analyse niet uitgevoerd. Bestaande issues #23/#28 en Q1-audit zijn context, geen nieuw acceptatiebewijs.

**Acceptatiecriteria**

- [ ] Per taak criteria met datum/omgeving/commit/rol/fixture en werkelijk resultaat; open mislukkingen blijven Te controleren/Geblokkeerd, geen Done op basis van code of oude issue-status.
- [ ] Relevante unit-/action-/SQL-/browserchecks plus typecheck/build; desktop/tablet/mobiel, licht/donker, keyboard/focus/AA/reduced-motion en console-/netwerkfouten beoordeeld.
- [ ] Auth/registratie/herstel/checkout, gratis/Academy/subscriber/legacy/mentor/admin, leer-/examengates, updates/publicatie/meldingen/chat/media en oude links regressievrij; migrations/rollback alleen binnen expliciet goedgekeurde release.

**Verificatie:** Gebruik synthetische fixtures; non-admin RLS en directe assetrequests, fout/retry/missingmigration testen. CI-scripts eerst op geschiktheid controleren; geen productieschrijfacties in planningsfase.

**Bewijs van uitvoering:** F1-bewijs geleverd in [F1-verificatie](HTP-F1-VERIFICATIE.md). Status Backlog voor controles van nog niet goedgekeurde fasen; de integrale F10-criteria blijven open.

<a id="htp-48"></a>

### HTP-48 — Houd backlog, fasepoorten en bewijslast centraal bij

- **Bron:** rubriek 00 p.5; 15 p.37-38; opdracht gebruiker.
- **Prioriteit / fase / omvang:** P0 / F1 + iedere fase / S.
- **Beoordeling / status:** Gedeeltelijk aanwezig / **Ready**.
- **Resultaat:** Het bestaande bord en dit dossier blijven één navolgbare planning met stabiele taakcodes.
- **Afhankelijkheden:** Geen.
- **Besluiten / blokkades:** Alle implementatie vereist expliciete goedkeuring van betreffende fase.
- **Bestaande implementatie:** Bestaand Project 3 en docs/market-updates/BACKLOG.md; dit nieuwe planningdossier bevat nog geen implementatiebewijs.

**Acceptatiecriteria**

- [ ] Elke HTP-taak heeft bron/resultaat/prioriteit/fase/S-M-L/afhankelijkheden/besluiten/criteria/verificatie/status; uitvoering start alleen na fasegoedkeuring en gekoppeld uitvoerissue.
- [ ] Bordstatus is voortgangsbron; document bevat gedateerde snapshot en details/links. Backlog → Ready → In uitvoering → Te controleren → Done, Geblokkeerd apart met reden/eigenaar-volgende-actie.
- [ ] In uitvoering vóór codewijziging, WIP 1 per uitvoerder; Te controleren zodra resultaat klaar is; Done pas na aantoonbare criteriacontrole en acceptatie. Geen automatische synchronisatie of nieuwe app.

**Verificatie:** Controleer alle IDs/dependencies/bronnen en borditems; lees na schrijven de statussen/inhoud terug. Bij faseoverdracht snapshot+besluitlog+bewijslocatie bijwerken; huidig opzetten is geen toestemming voor code.

**Bewijs van uitvoering:** niet beschikbaar; deze planning heeft geen implementatie-/runtimeverificatie uitgevoerd. Vul bij uitvoering commit/PR, datum, omgeving, accountrol, checkresultaat en eventuele screenshot in.



<a id="htp-49"></a>
### HTP-49 — Maak bestaande Marktinzicht-updatekaart volledig klikbaar

- **Bron:** rubriek 06 p.16-19, afgebakende aanvulling op HTP-14; expliciet verzoek Ward 17 oktober 2026.
- **Prioriteit / fase / omvang:** P1 / F1-aanvulling / S.
- **Status:** Te controleren (release naar main goedgekeurd; CI/merge volgen).
- **Resultaat:** Het hele bestaande kaartvlak opent dezelfde update met één focusstop.
- **Afhankelijkheden / besluiten:** bestaande kaart/F1; geen open besluit. Rest HTP-14 blijft F3b.
- **Issue:** https://github.com/6ftwardje/HTP2.0/issues/50 (repositorycode H1.49, alias HTP-49).

**Acceptatiecriteria**

- [x] Titel, samenvatting, thumbnail en lege kaartruimte openen dezelfde detailroute.
- [x] Eén focusbare link per kaart, geen geneste acties; Enter en zichtbare focus werken.
- [x] Desktop/mobiel in donker/licht gecontroleerd; bestaande content en filters behouden.

**Verificatie / bewijs:** 17 oktober, synthetische student, lokale productiebuild 127.0.0.1:3118; vier browsergevallen 1440/375 × donker/licht, nul paginafouten of horizontale overflow. Kaartpadding, samenvatting, thumbnail en Enter openen dezelfde slug. Bewijs output/playwright/htp-f1-release/results.json en vier PNG's in de geïsoleerde releaseworktree. Typecheck/build en 238 tests slagen op de schone main-basis.
