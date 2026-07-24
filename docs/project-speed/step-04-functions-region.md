# Project Speed — stap 04: Functions-regio

Datum: 24 juli 2026

## Hypothese

Netlify Functions draaiden in Dublin (`dub`, AWS `eu-west-1`) terwijl de HTP2
Supabase-database in Parijs staat (AWS `eu-west-3`). Protected routes doen
meerdere server-naar-Supabase-roundtrips. Een Functions-regio dichter bij de
database kan daarom TTFB en vooral tail latency verlagen zonder applicatiecode
of trust boundaries te wijzigen.

## Platformcontrole

- Netlify-site: `htp2`, plan `nf_team_pro`.
- Oorspronkelijke Functions-regio: `dub` / `eu-west-1`.
- Supabase-project: `HTP 2.0`, West EU (Paris) / `eu-west-3`.
- Netlify ondersteunt Londen (`lhr`) en Frankfurt (`fra`) self-service.
- Netlify Parijs (`cdg`) is alleen via support-assisted configuration
  beschikbaar.

Bronnen:

- https://docs.netlify.com/build/functions/configuration/#region
- https://supabase.com/docs/guides/platform/regions

## Productie-A/B

Dezelfde productiecommit `2b2b5a0864f07c749c0b3642036fc6d01c0e2ce9`,
hetzelfde dedicated account en tien verse browsercontexten per regio:

| Dashboardmetric | Dublin p50/p95 | Londen p50/p95 | Verschil p50 / p95 |
| --- | ---: | ---: | ---: |
| TTFB | 728 / 3.855 ms | 617 / 2.937 ms | −15,3% / −23,8% |
| FCP | 812 / 3.944 ms | 704 / 3.028 ms | −13,3% / −23,2% |
| LCP | 1.656 / 4.788 ms | 1.552 / 3.848 ms | −6,3% / −19,6% |
| Load | 877 / 4.009 ms | 778 / 3.075 ms | −11,3% / −23,3% |

Londendeploy: `6a633e8ea77bc9797716ccbf`, status `ready`,
productiecontext, branch `main`, Functions-regio `lhr`.

## Trust model en regressiecontrole

Er veranderden geen cookies, headers, JWT-validatie, RLS-regels, grants,
databasefuncties of applicatiebundels. Na de regiowijziging:

- dashboard, modules en weekly updates: HTTP 200 als testgebruiker;
- nul browserconsolefouten;
- vervalste interne userheaders: afgewezen en naar login geredirect;
- `PROJECT_SPEED_LAZY_AUTH_CLIENT=0`;
- `PROJECT_SPEED_LAZY_MEDIA=0`.

Rollback is de site Functions-regio terugzetten naar `dub` en dezelfde commit
opnieuw deployen.

## Database-inspectie

Read-only Supabase-inspectie toont een kleine dataset: 54 lessen, 2 modules,
2.696 progressrecords, 37 notification recipients en 5 studenten. De gebruikte
student-, onboarding-, progress-, notification- en weekly-update-indexen hebben
daadwerkelijke indexscans. Er is geen bewijs dat extra indexen de huidige
dashboard-TTFB materieel verbeteren.

De requestketen doet daarentegen circa twaalf auth/datarequests verdeeld over
middleware, protected layout en dashboard. De resterende Londen-TTFB van
617/2.937 ms wijst daarom primair op netwerkroundtrips en cold-tail.

## Geselecteerde productiestand

Londen (`lhr` / `eu-west-2`) blijft actief. Alle gemeten medianen en p95-waarden
verbeterden, met circa 20–24% winst in de tail.

## Volgende fase

1. Vraag Netlify Support om een tijdelijke `cdg`-configuratie voor een
   Paris-versus-London A/B op dezelfde commit; behoud Londen totdat Parijs
   aantoonbaar beter is.
2. Voeg routegerichte server-timing toe rond auth, student, notifications en
   dashboard-readmodel.
3. Ontwerp één smalle dashboard-readfunctie achter een standaard-uitgeschakelde
   featureflag. Gebruik `security invoker`, `auth.uid()` en alleen benodigde
   kolommen; trek execute voor `public` en `anon` in.
4. Vergelijk legacy–experiment–legacy met stabiele tekst/linkhash en directe
   anonieme RPC-afwijzing.

Professionele doelgrens voor de volgende fase: dashboard TTFB p50 onder 500 ms,
p95 onder 1.500 ms en LCP p95 onder 2.500 ms, zonder autorisatie- of
foutregressie.
