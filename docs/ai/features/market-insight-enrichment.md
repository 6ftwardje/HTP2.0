# Feature: Marktinzicht-enrichment

**Key:** `market_insight_enrichment`  
**Contract/prompt:** `market-insight-v1`  
**Status:** contract gevalideerd; providerjob volgt in S2.2.

## Doel en input

Een gereed Nederlands videotranscript wordt omgezet in een admin-only concept
met een korte samenvatting, maximaal vijf aandachtspunten en maximaal twaalf
klikbare hoofdstukken. Transcriptsegmenten met timing zijn de enige inhoudelijke
bron.

## Kwaliteitspoort

Lege, te korte en grotendeels onverstaanbare transcripties worden vóór een
modelcall geblokkeerd en naar menselijke review gestuurd. Structured output
wordt daarna begrensd op lengte, aantallen, videoduur en oplopende timestamps.
Een tweede groundingcontrole blokkeert nieuwe numerieke claims die niet in het
transcript voorkomen.

## Veiligheid en publicatie

Het contract verbiedt financieel advies, nieuwe marktfeiten en het zelfstandig
oplossen van tegenstrijdige cijfers. Geldige output blijft een concept in
`ai_video_enrichments`; publicatie vereist later een expliciete adminreview.

Alle tests gebruiken uitsluitend synthetische Nederlandse inhoud. S2.1 doet
geen providercall en schrijft niets naar de database.
