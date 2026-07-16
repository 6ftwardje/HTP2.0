# Project Speed — stap 02: auth-SDK na interactie

Datum: 15 juli 2026

## Hypothese

De publieke loginpagina importeerde `@supabase/ssr` en `@supabase/supabase-js` vóórdat een gebruiker het formulier gebruikte. De productienulmeting liet circa 161 kB initiële JavaScript-transfer zien. De SDK pas bij submit laden moet transfer, request count en loadtijd verlagen zonder authsemantiek te wijzigen.

## Architectuurwijziging en trust model

De bestaande formuliervorm, validatie, `signInWithPassword`, registratie, reset en veilige redirectfunctie staan in één gedeelde clientcomponent. Twee dunne entrypoints bepalen uitsluitend het laadmoment:

- legacy importeert de Supabase-browserclient statisch;
- experiment importeert exact dezelfde clientfactory dynamisch bij submit.

`PROJECT_SPEED_LAZY_AUTH_CLIENT=1` selecteert tijdens de servergestuurde productiebuild het experimentele entrypoint. Ontbrekend, `0` of iedere andere waarde selecteert legacy. Er worden geen cookies, headers, JWT-payloads, RLS-regels, keys of autorisatieregels gewijzigd. De anon key blijft de bestaande public browserkey; de service-role key komt niet in deze code.

Rollback: flag op `0` zetten en dezelfde commit opnieuw deployen. De legacy-implementatie blijft aanwezig.

## Lokale A/B

Beide modi zijn als production build vanaf dezelfde code en `.env.local` gebouwd en met verse browsercontexten gemeten (vijf runs per route).

| Loginmetric | Legacy p50/p95 | Experiment p50/p95 | Verschil p50 |
| --- | ---: | ---: | ---: |
| First-load JS (Next build) | 166 kB | 111 kB | −33,1% |
| Browser JS-transfer | 171.223 / 171.223 B | 116.156 / 116.156 B | −32,2% |
| Totale transfer | 252.436 / 252.438 B | 197.330 / 197.332 B | −21,8% |
| Requests | 13 / 13 | 12 / 12 | −1 |
| FCP | 64 / 136 ms | 56 / 100 ms | −12,5% |
| LCP | 64 / 136 ms | 56 / 100 ms | −12,5% |
| Load | 44,1 / 109 ms | 33,1 / 79,7 ms | −24,9% |
| CLS | 0 / 0 | 0 / 0 | gelijk |
| Console-errors | 0 / 0 | 0 / 0 | gelijk |

De zichtbare tekst- en linkhash matchte voor login, anonieme dashboard-, module- en adminflows. Anonieme redirects en vervalste interne headers bleven afgewezen. Na submit werden twee uitgestelde scripts geladen en werd dezelfde Supabase tokenroute aangeroepen; een ongeldige login gaf dezelfde Nederlandse foutmelding.

## Afgewezen alternatief

Een eerste server-dynamische componentkeuze behield beide clientgraphs. De browser bleef exact 171.223 B JavaScript en 13 requests laden. Dit experiment is niet naar productie gebracht. De build-time modulekeuze verwijdert de statische SDK-entry aantoonbaar uit de initiële graph.

## Productie-A/B en geselecteerde stand

Nog in te vullen na twee volledig afgeronde Netlify-deploys van dezelfde commit: eerst flag uit, daarna flag aan. De experimentstand blijft alleen actief wanneer transferwinst, foutloze authboundary en stabiele p95 reproduceerbaar zijn.

## Resterende risico's

- Een geldige login is niet uitgevoerd omdat dedicated testaccountcredentials ontbreken.
- De eerste submit betaalt nu één extra chunk-roundtrip; dit is de bewuste trade-off voor snellere first view en moet met een dedicated account in productie worden gemeten.
- Registratie en reset gebruiken hetzelfde dynamische clientpad, maar e-mailmutaties zijn niet uitgevoerd omdat mutatietests expliciete opt-in vereisen.
