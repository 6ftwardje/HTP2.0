# MVP-besluiten transcriptie en AI-verrijking

Status: **goedgekeurd**  
Beslisser: **Ward Janssen**  
Beslisdatum: **2026-09-23**  
Implementatiebranch: `codex/ai-transcription-suite`

Dit document is de beslispoort uit S0.1. De voorgestelde keuzes hieronder zijn
veilig en kostenbewust, maar gelden pas als productbesluit nadat de beslisser ze
schriftelijk heeft goedgekeurd. Providerwrites, betaalde calls,
productiemigraties en verwerking van echte media vereisen nog steeds een
afzonderlijke operationele bevestiging.

## Voorgesteld MVP-besluit

| Onderwerp | Voorgestelde keuze | Rationale | Verworpen alternatief |
|---|---|---|---|
| Primaire transcriptbron | Mux-generated captions voor nieuwe Mux-assets | Sluit aan op de bestaande primaire videoprovider en vermijdt een extra media-exportpad. | Een tweede transcriptieprovider als standaard verhoogt datastromen, beheer en kosten. |
| Legacyfallback | Geen automatische download of scraping. Legacy Vimeo/YouTube wordt in de dry-run als geblokkeerd gemarkeerd en alleen handmatig verwerkt nadat een toegestane bronfile beschikbaar is. | Voorkomt onduidelijke toegangsrechten en fragiele downloadworkarounds. | Automatisch media ophalen bij legacyproviders. |
| Brontaal | Nederlands (`nl`) als standaard; per video expliciet overschrijfbaar vóór de start. | De huidige opleiding en UI zijn Nederlandstalig. | Automatische taaldetectie als enige bron van waarheid. |
| Vertaling | Geen vertaling in de eerste MVP. Het datamodel en de orchestrator houden vertaling optioneel, maar maken geen vertaaltracks aan. | Levert transcriptie en review sneller en goedkoper; voorkomt terminologierisico zonder goedgekeurde doeltaal. | Direct Engels als vaste doeltaal. |
| Revieweigenaar | Alleen platformadmins mogen AI-concepten corrigeren, afwijzen en publiceren. | Sluit aan op bestaande `requireAdmin()`- en RLS-patronen. | Automatische publicatie of review door iedere mentor. |
| Publicatieregel | Nooit automatisch. Samenvatting, aandachtspunten en hoofdstukken worden pas studentzichtbaar na expliciete adminbevestiging. | Beperkt foutieve marktclaims en financieel-adviesrisico. | Publiceren zodra het model valide JSON retourneert. |
| Transcriptzichtbaarheid | Transcript en providerinterne metadata blijven admin-only in de MVP. Studenten zien alleen goedgekeurde samenvatting, aandachtspunten en hoofdstukken. | Minimaliseert datalekoppervlak en volgt de bestaande AI-datastrategie. | Volledig transcript direct aan studenten tonen. |
| Retentie | Bewaar het actuele transcript en noodzakelijke auditmetadata zolang het marktinzicht bestaat; verwijder afgeleide transcriptartefacten binnen 30 dagen na verwijdering van de bronvideo. Logs bevatten nooit transcripttekst. | Houdt review reproduceerbaar en voorkomt onbeperkte verweesde opslag. | Onbeperkte opslag van alle transcriptversies. |
| AI-provider/model | Hergebruik de bestaande Anthropic-adapter en centrale registry; het concrete model blijft configureerbaar via server-environment en wordt per interactie gelogd. | Geen tweede AI-provider of secretpad; sluit aan op de bestaande architectuur. | Een provider/model hardcoderen in de featurehelper. |
| Kostenpoort | Maximaal EUR 2 geschatte variabele AI/transcriptiekosten per video en EUR 50 per kalendermaand; bij ontbrekende of verouderde prijsconfiguratie blokkeren vóór de betaalde call. | Fail-closed, met een klein pilotbudget en zichtbare bovengrens. | Alleen achteraf tokengebruik rapporteren. |
| Automatiseringsfase | Eerst handmatige pilot per video. Webhooks mogen statussen idempotent bijwerken, maar starten geen enrichment zonder expliciete adminstart. | Maakt kwaliteit en kosten eerst observeerbaar. | Volautomatische verwerking bij iedere upload. |
| Pilotomvang | Maximaal 10 nieuwe Mux-video's, één voor één gestart. Geen bulkbackfill. | Beperkt operationeel en financieel risico. | Meteen alle bestaande content verwerken. |

Capaciteitsaanname: gemiddeld **90 minuten nieuwe content per week** (circa
390 minuten per maand). Kostenramingen en limieten moeten zowel per video als
per kalendermaand tegen dit volume worden getoetst.

Technische providerbeperking: Mux classificeert Nederlands bij generated
captions als bèta. De pilot meet daarom expliciet transcriptkwaliteit en houdt
menselijke review verplicht.

## MVP

- Handmatige transcriptstart voor één Mux-video door een platformadmin.
- Geauthenticeerde, idempotente verwerking van Mux-captionevents.
- Admin-only transcriptstatus en fout-/retrystatus zonder transcripttekst in logs.
- AI-concept voor korte samenvatting, maximaal vijf aandachtspunten en klikbare
  hoofdstukken, uitsluitend gebaseerd op het transcript.
- Expliciete menselijke correctie, afwijzing en publicatie.
- Studenten zien uitsluitend gepubliceerde verrijking; legacycontent blijft
  zonder verrijking afspeelbaar.
- Hervatbare stappen, begrensde retries, idempotency keys en fail-closed
  kostenlimieten.
- Read-only dry-runrapport voor legacybackfill.

## Expliciete non-goals

- Geen dubbing, realtime transcriptie, zoekindex of aanbevelingsmodel.
- Geen automatische publicatie.
- Geen transcriptviewer voor studenten.
- Geen vertaalde subtitletrack in de eerste MVP.
- Geen scraping of automatische download van Vimeo/YouTube.
- Geen productiebackfill, live providerpilot of andere externe write vanuit de
  test- en bouwfase.

## Gevolg voor de backlog

- Na goedkeuring zijn S0.2, S1.1-S1.4 en S2.1-S2.4 uitvoerbaar.
- S3.1 en S3.2 worden voor deze MVP overgeslagen omdat geen doeltaal is gekozen.
- Voor S4.1 is een afzonderlijke scopeslice nodig die de vertaalstap optioneel
  maakt zonder S3.2 als harde dependency. De bestaande issueomschrijving mag
  niet stilzwijgend worden gewijzigd.
- S4.2 en S4.3 volgen op die aangepaste orchestratieslice.

## Goedkeuring

Vervang na expliciete bevestiging de status bovenaan door `goedgekeurd`, vul
beslisser en datum in, en noteer hieronder eventuele afwijkingen van het voorstel.

Afwijkingen: **geen**. De beslisser heeft daarnaast 90 minuten nieuwe content
per week als planningsvolume bevestigd.
