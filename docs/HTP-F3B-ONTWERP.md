# F3b — Ontwerpkeuzes vóór uitvoering

17 oktober 2026. Ward keurde F3b uitsluitend lokaal goed en antwoordde bij de voorgelegde varianten: **“Doe wat volgens jou het meest logisch is.”** Daarmee is de ontwerpkeuze aan de uitvoerder gedelegeerd. Stop vóór F4.

Voorgelegd vóór de feedbouw: `output/playwright/htp-f3b/design-options.html` en `design-options.png`. Beide tonen dezelfde bestaande thumbnail, inhoud en volledige kaartlink: A met beeld links (42%) in één kolom, B met twee kolommen en beeld bovenaan. Keuze: **A voor de chronologische feed**, dezelfde kaart in compacte compositie voor dashboard/vervolgkaarten. B blijft alleen het vergeleken alternatief.

D2: één primaire navigatierij **Actueel / Open setups / Archief**. De latere namen en pin-/zonebetekenis wachten op F6; bestaande toegang tot archief en setups blijft behouden. Daaronder zoeken en één inhoudsfilter **Alles / Tekst & charts / Video**, gevolgd door dynamische marktchips. Charts horen bij tekst; PDF is nog geen beschikbaar postformat en krijgt geen fictieve filter. De instelbare `MIN_ITEMS_FOR_FILTERS` staat op 0, chips verschijnen pas bij minstens twee markten met toegankelijke gepubliceerde inhoud. Geen zichtbare resultatenteller. Setupstatus blijft alleen bij Open setups beschikbaar.

D3: de hele kaart houdt **één** focusbare inhoudslink met zichtbare tekst **Open update →** (voor outlook Open vooruitblik). Een play-icoon is presentatie, geen tweede knop of live embed. Eventuele toekomstige PDF-acties komen buiten de kaartlink; F5 is niet begonnen. Bestaande thumbnails en verhoudingen blijven behouden, met een leesbare fallback bij ontbreken/fout. Twee gereserveerde samenvattingsregels in alle kaartformaten.

Weekblok: echte gepubliceerde outlook, juiste markt-/inhoud-/zoekcontext, geen dubbele kaart. Oudere week krijgt een eerlijk week-/periode-label. Marktlinks komen uitsluitend uit gevalideerde gepubliceerde hoofdstukken met een expliciete markt, zonder markt/tijd uit tekst te raden. Geen outlook betekent geen hero.

Detail: typografietokens voor titel, intro, byline en prozaregellengte blijven staan. Korte niet-structured samenvatting/context blijft zichtbaar als label; de editor legt de conventie voor een zin met eindleesteken uit. Structured kernboodschap blijft een bestaande publicatievereiste, geen dubbel vaste Samenvatting-sectie. Takeaways krijgen semantische nummering; alleen korte lijstprefixen worden genormaliseerd, geen financiële waarden of historische tekst herschreven.

Hoofdstukken: bestaande chapter-/seekstructuur uit F3a, actieve staat via lokale tijd-events, desktoprail waar voldoende ruimte en mobiel een inklapbare lijst direct onder de video. Mux is actief; bestaande Vimeo-compatibiliteit blijft bruikbaar, onbekende provider krijgt leesbare fallback. Geen voorkeur-, positie- of bekekenprogressieopslag uit F4. URL-tijdstippen en browserverboden geven controleerbare feedback.


Technische verificatie binnen deze scope: chartafbeeldingen laden met de browsersessie rechtstreeks uit de bestaande beschermde route, zonder afbeeldingsproxy of videoschaduw over de chart. De route controleert nu het werkelijke toegangsniveau van de ouderpost, zodat gepubliceerde gratis charts bruikbaar zijn en afgeschermde/conceptcharts beschermd blijven. De clientfeed ontvangt uitsluitend mentor-id/naam, geen mentor-e-mailadres; avatars blijven via de bestaande toegangsgestuurde RPC/assetroute lopen.
