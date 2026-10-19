# Marktinzicht: productieherstel 19 oktober 2026

Issue: [Q2.0 / #95](https://github.com/6ftwardje/HTP2.0/issues/95).

## Bewezen oorzaak vóór wijzigingen

Productie draaide commit `677c88a8410df6a62d937890c7142aa2a62a8cbf`, Netlify-deploy `6ad53460b56825e4edca2fd1`. De oorspronkelijke lokale checkout was ouder en bevat veel ongerelateerde wijzigingen; het herstel gebeurt in een afzonderlijke managed worktree vanaf productie.

- Ingelogde browser: ieder feeditem, ook de weekvooruitblik, toonde de bijlagenfout. De opgegeven CPI/FED-detailpagina toonde de algemene foutgrens.
- De ingelogde query voor het artikel zelf gaf HTTP 200, gepubliceerd, `access_tier=free`.
- `POST /rest/v1/rpc/list_visible_pdf_documents`, parameters `p_kind=update`, `p_parent_ids=[17]`, range 0–249: HTTP **404**, code **PGRST202**, `Could not find the function public.list_visible_pdf_documents(p_kind, p_parent_ids) in the schema cache`. Ook voor een niet-bestaande ouder faalde deze call.
- Read-only Postgres-inspectie bevestigde dat zowel `public.pdf_documents` als `public.list_visible_pdf_documents(text,bigint[])` werkelijk ontbraken. Het was dus geen verouderde cache of lidrecht.
- Netlify-serverlog 07:26:15 UTC: `Error: De documenten konden niet worden geladen. Probeer opnieuw.`, digest **418920492**. Deze digest kwam ook uit de gestreamde detailresponse; HTTP 200 alleen was geen bewijs van een werkende detailpagina.
- De feed ving dezelfde fout af in `withUpdateDocuments`; de detailpagina liet `visibleDocuments` naar de foutgrens doorlopen. De oorspronkelijke PostgREST-fout ging in beide gevallen verloren.
- Na PDF-herstel werd de aanvullende ontbrekende `read_video_position` zichtbaar: RPC HTTP 404/PGRST202; `/api/video-position?kind=update&id=17` HTTP 503. Ook dit was achtergebleven schema-uitrol.

Conclusie: applicatiecode was gepubliceerd zonder bijbehorende featuremigraties. Geen storage-outage, ontbrekende env-variabele of toegang die dit lid moest bijkopen.

## Gericht databaseherstel

De onderstaande bestaande migraties zijn ongewijzigd uitgevoerd tegen het geverifieerde project `swohtycdqbydqrtjzwwf`, met transactie, advisory lock, lock-/statement-timeout en migratieregistratie. Alleen ontbrekende versies zijn uitgevoerd; PostgREST ontving na commit een schema-reload.

- `20261018180000_htp_f5a_private_documents`: private PDF-foundation, ouderrechten, openlogs/retentie.
- `20261018220000_htp_f5b_update_documents`: veilige bijlagenprojectie en private covers.
- `20261018221000_htp_f5b_academy_rubrics`: bestaande afhankelijkheid `has_live_learning_account` voor leesposities; geen rubrieken/content ingevuld.
- `20261018223000_htp_f5b_pdf_positions`: beveiligde PDF-leesposities.
- `20261017140000_htp_f4_video_positions`: beveiligde video-hervatpositie.

Geen blanket `supabase db push`, wijziging van bestaande ouder-entitlements, betaling, lidniveau, publicatie of cursusvoortgang. Geen testaccounts of testcontent aan productie toegevoegd. Toolbox- en notificatiemigraties buiten deze herstelafhankelijkheden zijn niet uitgerold.

## Codeherstel

- Bijlagenquery logt oorspronkelijke code/message/details/hint, RPC, oudertype/-IDs, range en HTTP-status; transportfouten worden ook gelogd. De feedfallback logt kijker/postcontext.
- Logger bewaart `cause`, foutvelden en Next-digest, met begrensde recursie. Een vaste `[htp]`-prefix houdt de volledige JSON-inhoud zichtbaar in Netlify CLI/serverlogs: de live previewproef liet zien dat JSON-only regels anders als lege message werden teruggegeven.
- Detail-queryfouten worden gelogd en gegooid; alleen een succesvolle lege query betekent ontbrekende inhoud. Een databasefout wordt daardoor geen paywall/404.
- Metadata-, auteur-, reactie-, notificatie- en hervatfouten in de Marktinzicht-flow krijgen contextlogging. De foutgrens logt route/digest.
- PDF HTTP-fouten loggen pad/methode/status en behouden onderliggende RPC-/storagefouten bij autorisatie, openen en leespositie.
- Globale 404 gebruikt de bestaande achtergrond-, tekst-, typografie- en knoptokens en de bestaande themainitialisatie.
- Productie-Netlifybuild controleert met `verify:market-schema` read-only de bijlagenprojectie, metadata en PDF-/video-leesfuncties vóór de bouw. De controle wijzigt geen schema en faalt bij ontbrekende RPC’s of onbruikbare permissies.

## Verificatie

- 309 unit-/acceptatietests geslaagd; nieuwe proeven voor PGRST202 met originele context, transportuitval, lege lijst, beide paginatiedimensies, gedeeltelijke uitval, geneste oorzaak/digest, deploymentcontrole en onderscheid queryfout/ontbrekende inhoud.
- TypeScript en productiebuild geslaagd; bestaande image-lintwaarschuwingen blijven.
- Drie echte lokale rollback-SQL-suites geslaagd: F4 videoposities, F5a private documenten en F5b documenten/Academy. Inclusief ouderrechten, anon, storageafscherming, versie, eigenaarschap en concurrency. Geen reset van de gedeelde database.
- Productie-readback na schemaherstel: feed plus alle vijf gepubliceerde detail-URL’s HTTP 200 zonder numerieke renderdigest of bijlagenfout; ingelogde bijlagen-RPC HTTP 200, lege lijst. Er zijn geen productie-PDF’s, dus dit is geen bewijs van een echte documentdownload.
- Video-leespositie HTTP 200 met positie 0 voor een eerste bezoek; de bestaande speler wordt weer gerenderd.
- Mechanische designcontrole van de gewijzigde fout-/statuscomponenten: geen bevindingen.

Bewust niet uitgevoerd: upload/download van nieuwe PDF’s of contentwijzigingen op productie, betaalcutover, Toolbox-uitrol, volledige platformaudit of integrale browser-/screenreaderacceptatie. Technische foutmeldingen zijn niet vervangen door een onjuiste aankoopmelding.
