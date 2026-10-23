# Staging: ingericht en online getest

Bijgewerkt op 23 oktober 2026, Europe/Brussels.

De applicatie is online op **https://htp-staging.netlify.app** met de aparte Supabase-database **pxxpciwnvfkxnkpttajp** in Dylans organisatie Het Trade Platform Staging. De statische wachtpagina is vervangen na een geslaagde draftdeploy en online acceptatie. De initiële geteste applicatiecommit is `89f5bb15976fd317cd886ee866d7c1b52ab7048b`; volgende stagingmerges worden afzonderlijk getest en krijgen een receipt.

## Inrichting

- Netlify-site: `d798281b-ff2a-48bb-9ecf-3b9dea2a7c21`, branch `codex/staging`.
- Productieschema read-only vastgelegd en zonder gebruikers of applicatierijen naar staging overgenomen. De schemafingerprint controleert ook functies, ACL, RLS, views/security-opties en ingeschakelde triggers.
- Auth-triggers, storagebeleid, lege bucketconfiguratie en Realtime-tabellen zijn meegenomen. Productieuploads, cronjobs, providercredentials en productiegebruikers zijn niet gekopieerd.
- De oude ClickUp-leadtrigger is uitsluitend op staging uitgeschakeld vóór het opslaan van dummygegevens. Testaccounts starten geen externe lead-automatisering.
- `student_next_steps` en `toolbox_resources`, die wel in Git maar niet in het live schema stonden, zijn met een nieuwe expliciete schema-only migratie toegevoegd.
- Supabase Site URL en vier exacte Auth-redirects wijzen naar staging. Bevestigingsinstellingen zijn behouden.
- Staging heeft eigen API-keys, een zichtbaar staginglabel, noindex/noarchive en robotsuitsluiting. Mailworkers zijn uit; Stripe, AI en Mux hebben nog geen livecredentials op staging.
- De afzonderlijke werkcheckout is aan de stagingsite gekoppeld. De oorspronkelijke werkmap met andere lokale wijzigingen is behouden.

## Dummygegevens

Vijf accounts onder `@staging.htp.test`: admin, mentor, member, free en member2. De aparte mentorrol is getest; de beheerder wordt niet automatisch mentor. Het wachtwoord staat uitsluitend in `.env.staging.accounts.local` in de uitvoercheckout en het beschermde GitHub-stagingsecret.

Aanwezig: drie modules waarvan één concept, zes lessen, een examen met twaalf vragen en antwoordopties, voorbeeldvoortgang, zes analyses waarvan een concept en een archiefitem, drie fictieve livesessies, een melding en een testgesprek met mentorantwoord. Opnieuw seeden maakt geen dubbele accounts of inhoud.

Lessen en livesessies zijn duidelijk fictief en hebben geen productievideo of echte webinar gekoppeld. Echte media-, betaal- en mailbezorgingstests vereisen eigen testintegraties.

## Testbewijs

- 335 applicatietests, typecheck en lint geslaagd.
- Gerichte tests voor doelscheiding, productieblokkering van bootstrap/seed, onveranderlijke migraties, Netlify-koppeling, promotiebron, logredactie en versleutelde-backupintegriteit.
- De oorspronkelijke 57 migraties zijn op een verse lokale Supabase toegepast.
- De vastgelegde productiebaseline is onafhankelijk hersteld en vergeleken, inclusief rechten. Nieuwe migratie en herhaald seeden zijn eveneens beproefd.
- De nieuwe GitHub-schema-repetitie start een verse lokale Supabase zonder cloudcredentials, vergelijkt de exacte stagingstructuur, seedt tweemaal en logt met alle vijf rollen in.
- Online acceptatie: vijf echte staginglogins, conceptafscherming, privacy van voortgang/chat, afgeschermde examen-antwoorden en providersecrets, mentorchat met antwoord en idempotente retry, student-/beheerpagina's, weigering van beheer voor een lid, noindex, robots en de ingebouwde release-SHA.
- De eerste draft met ontbrekende runtimeconfiguratie is niet gepubliceerd. Na herstel is dezelfde volledige online acceptatie geslaagd.

Invoering via [PR #122](https://github.com/6ftwardje/HTP2.0/pull/122). De kleine voorbereidende [PR #120](https://github.com/6ftwardje/HTP2.0/pull/120) heeft de bestaande PR-policy op main geschikt gemaakt voor samengestelde, gecontroleerde stagingreleases.

## Git- en releaseflow

Feature-PR → beschermde `codex/staging` → automatische GitHub-deployflow met migratiecontrole, draftdeploy en acceptatie → publicatie naar staging → release-PR naar beschermde `main` → controle op de geteste stagingbron → Wards GitHub Environment-vrijgave → versleutelde backup → migraties → productie-drafttest → publicatie.

Directe automatische Netlify-builds zijn op beide sites gestopt; de GitHub-workflows regelen publicatie. De vaste Netlify-sites, databases, branches en origins worden expliciet gecontroleerd. Main vereist ook de promotiecheck. Force-pushes en branchverwijdering zijn geblokkeerd, ook voor beheerders.

Productie gebruikt een aparte beschermde Environment met Ward als vereiste vrijgever en uitsluitend main als toegestane branch. Er is geen productie-apprelease of productiedatamigratie uitgevoerd bij deze inrichting. De bestaande live-deploy `6adb6393c6db32424f31f83f`, applicatiecommit `4f07cf37b7d97cbd67ddacadc51cc8488c802a85`, is behouden.

De volledige bediening, migratieregels, backupbeperkingen en herstelstappen staan in [STAGING_RELEASE_FLOW.md](STAGING_RELEASE_FLOW.md). Bewaar de privéherstelsleutel uit `.env.production-backup.local` buiten de checkout voordat deze ooit wordt gearchiveerd. Een echte productiebackup wordt pas gemaakt na vrijgave van een toekomstige productierelease; er is bij deze inrichting geen productiedata-export gemaakt.
