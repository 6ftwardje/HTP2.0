# Ontwikkelen, staging en gecontroleerd publiceren

Datum: 23 oktober 2026. Deze werkwijze vervangt directe deployments vanaf een lokale werkmap.

## Vaste omgevingen

| Omgeving | Git-branch | Website | Supabase-project |
| --- | --- | --- | --- |
| Staging | `codex/staging` | https://htp-staging.netlify.app | `pxxpciwnvfkxnkpttajp` |
| Productie | `main` | https://hettradeplatform.be | `swohtycdqbydqrtjzwwf` |

Netlify-sites zijn respectievelijk `d798281b-ff2a-48bb-9ecf-3b9dea2a7c21` en `8c1e7273-8140-4a47-88e7-9dbd11241229`. Een Netlify-context met de naam `production` kan ook bij de stagingsite horen; gebruik altijd de vaste site-ID en database-ID.

De nieuwe staging is begonnen met een schema-only export van de werkelijk gepubliceerde productieversie `4f07cf37b7d97cbd67ddacadc51cc8488c802a85`. Er zijn geen gebruikers, wachtwoorden, voortgang, betalingen of productieuploads overgenomen. De schema-export bevat ook de oude tabellen die nog op productie staan. Custom Auth-triggers, storagebeleid, bucketconfiguratie en Realtime-lidmaatschap zijn vastgelegd. Cronjobs en externe providercredentials zijn niet gekopieerd.

Een stagingoverride schakelt de bestaande ClickUp-leadtrigger uit. E-mailworkers zijn uitgeschakeld, providerkeys ontbreken en Stripe-livekeys worden geweigerd. Dit is een expliciet omgevingsverschil, opgenomen in de gecontroleerde schemafingerprints. Een mislukte eerste seed is volledig teruggedraaid voordat dummygegevens werden opgeslagen.

## Dagelijks werken

Nieuwe ontwikkelaars beginnen in [developer-kit](../developer-kit/README.md). De actuele teamafspraken over taakbranches, parallelle checkouts, review, tests en releasecoördinatie staan centraal in [CONTRIBUTING.md](../CONTRIBUTING.md).

1. Begin een featurebranch vanaf actuele `origin/codex/staging`. Gebruik het taakcodepatroon uit de repository, bijvoorbeeld `feat/S1.1-onderwerp` of `codex/S1.1-onderwerp`.
2. Voeg code en eventuele **nieuwe** SQL-migraties toe. Pas een al uitgevoerde migratie nooit aan.
3. Open een PR naar `codex/staging`, met één bestaand backlogissue en het verplichte testbewijs. PR-tests hebben uitsluitend synthetische, lokale credentials.
4. Merge pas wanneer applicatiechecks, mentorchat, releaseguards en de verse schema-/fixtureproef groen zijn.
5. Een merge naar staging start `Staging deployment`. De workflow controleert het doeldatabaseproject, migratiechecksums en schemadrift, voert nieuwe migraties uit, bouwt een **draftdeploy**, test vijf echte stagingrollen en publiceert pas daarna.
6. Controleer de feature op het vaste stagingadres. Een geslaagde workflow bewaart een receipt met commit, Git-tree, deployment-ID, vorige deployment en schemafingerprint. Het artifact bevat geen credentials of testwachtwoorden.

## Naar productie

1. Synchroniseer nieuwe wijzigingen op `main` eerst terug naar staging en test opnieuw.
2. Open één release-PR van **`codex/staging` naar `main`**. Neem `## Testbewijs` en `Bewust niet uitgevoerd` op. Deze PR bundelt de al beoordeelde feature-issues.
3. De promotiecheck vereist dat de kandidaat dezelfde stagingcommit is die werkelijk draait en waarvoor een geslaagde acceptatiereceipt bestaat. Een andere of oudere kandidaat wordt geweigerd.
4. Merge de release-PR met **Create a merge commit**, niet squash/rebase. De productiejob controleert dat stagingbroncommit deel uitmaakt van de geschiedenis en dat de volledige Git-tree op main exact gelijk is aan de geteste tree.
5. De aparte GitHub Environment `production` vraagt Wards expliciete vrijgave. Productiesecrets worden pas daarna aan de job verstrekt. De GitHub-omgeving staat uitsluitend de branch `main` toe.
6. Na vrijgave: controle van de actuele stagingreceipt, een read-only versleutelde databasebackup, migratieplan/schemadrift, nieuwe migraties, een eigen productiebuild met productie-instellingen, een draft-smoketest en pas dan publicatie. Stagingdata wordt nooit naar productie gepromoveerd.

De builds verschillen per omgeving omdat Next.js publieke projectinstellingen tijdens het bouwen vastlegt. De broncode/tree blijft gelijk; een stagingbundle wordt niet met productiekeys hergebruikt.

## Databasebaseline en migraties

De historische Supabase-migratiehistorie bevat een geïmporteerde legacybasis en handmatige uitrollen. Blind alle oude Git-migraties opnieuw uitvoeren op productie is daarom onveilig.

`supabase/release/manifest.json` beschrijft de gecontroleerde basis van 23 oktober. De oude SQL-bestanden blijven ongewijzigd beschikbaar voor historische en bestaande fresh-installtests. **Voor releases wordt alleen nieuwe SQL ná versie `20261023000000` uitgevoerd.** De eerste nieuwe migratie brengt twee reeds in Git bestaande, maar op productie ontbrekende structuren onder expliciet versiebeheer: `student_next_steps` en `toolbox_resources`. Er is geen gebruikersbackfill toegevoegd.

De release-administratie staat in het niet door de Data API ontsloten schema `supabase_migrations`. De bestaande Supabase-migratiehistorie wordt niet herschreven. Nieuwe releasechecksums, de baseline en een omgevingsmarker worden afzonderlijk opgeslagen. Gebruik voor gedeelde doelen de releasescripts, niet rechtstreeks `supabase db push`, `db reset`, Dashboard-DDL of een SQL-kopieeractie.

Een schemafingerprint omvat kolommen, constraints, indexes, functies, functie-/tabelrechten, RLS-beleid, enumwaarden en triggers inclusief hun aan/uit-status. SQL-checksums voorkomen het wijzigen van toegepaste migraties. Per nieuwe migratie legt `migration-lock.json` het resultaat van de repetitie vast. Nieuwe changes vereisen een lokale repetitie en een bijgewerkte lock, gevolgd door de onafhankelijke verse CI-repetitie. Een afwijking stopt de release.

Lokale commando's gebruiken een expliciet geladen privébestand, nooit automatisch de bestaande productie-`.env.local`:

```sh
node --env-file=.env.staging.local scripts/release/database.mjs verify
node --env-file=.env.staging.local scripts/release/database.mjs plan
node --env-file=.env.staging.local scripts/release/database.mjs migrate --apply
```

`bootstrap --apply` werkt uitsluitend op het exacte stagingproject en een leeg `public`-schema. Het is geen resetfunctie. `seed.mjs --apply` vereist daarnaast de stagingmarker, uitgeschakelde externe DB-automatisering en veilige integratievlaggen. De productieomgeving kan geen bootstrap- of seeddoel zijn.

## Dummygegevens en accounts

De vijf accounts zijn `admin`, `mentor`, `member`, `free` en `member2` onder `@staging.htp.test`. Hun wachtwoord staat uitsluitend in het genegeerde privébestand `.env.staging.accounts.local` en het staging Environment-secret. De mentor heeft een expliciete mentorrol; een beheerder is daardoor niet automatisch mentor.

Aanwezig: drie modules waarvan één concept, zes lessen, twaalf examenvragen met antwoordopties, voorbeeldvoortgang, zes tekstanalyses waarvan één concept en één archiefitem, drie sessies en een melding. Lessen bevatten bewust geen productievideo. De sessies zijn fictief en openen geen echte webinar. Media-, Stripe-, AI- en echte mailbezorging vragen afzonderlijke testintegraties; daarvoor worden geen productiesleutels overgenomen.

## Auth en verificatie

Supabase Site URL is het vaste stagingadres. Alleen de exacte stagingcallbacks voor `/auth/callback`, `/auth/confirm`, `/auth/verify` en `/account/update-password` horen in de redirectlijst. De bevestigingsinstellingen blijven actief. De vooraf bevestigde dummyaccounts vereisen geen uitgaande mail.

De automatische acceptatie controleert login van alle vijf accounts, conceptafscherming, andere leden hun voortgang, examen-antwoorden, providersecrets, mentorselectie, student-/beheerpagina's, weigering van beheer voor een lid, noindex en de werkelijk ingebouwde release-SHA. `GET /api/health` geeft uitsluitend gereedheid, omgeving en broncommit terug; geen keys, namen of databasefouten.

## Herstel en bewuste grenzen

Bij een mislukte drafttest blijft de vorige website gepubliceerd. Een mislukte controle onmiddellijk na publicatie zet automatisch de vorige website terug. De receipt bevat ook de vorige deploy-ID voor later herstel via Netlify. SQL-wijzigingen moeten achterwaarts compatibel zijn: het terugzetten van websitecode zet de database niet terug. Zet databasewijzigingen voorwaarts recht met een nieuwe migratie; kopieer nooit stagingdata naar productie.

Vóór productiemigraties maakt de goedgekeurde workflow een read-only PostgreSQL custom-format backup van public, auth, storage en migratieadministratie. De dump wordt tijdens het streamen met AES-256-GCM versleuteld; er wordt geen plaintextbestand geschreven. De versleutelde backup en geauthenticeerde metadata worden dertig dagen als artifact bewaard, ook als de release daarna faalt. Een ontbrekende sleutel, ongeldige archive-header of mislukte backup blokkeert migraties. Bewaar de herstelsleutel uit het genegeerde privébestand `.env.production-backup.local` ook in een wachtwoordmanager. Dit is een databasebackup; de inhoud van Storage-bestanden zelf vraagt afzonderlijke opslagbackups. De schema-export in Git is geen backup van gebruikersgegevens of bestanden. Verwijderen van kolommen, gegevens of bestanden hoort niet in een gewone automatische release.

De GitHub-vrijgave vereist een handmatige klik van Ward. Omdat Ward ook de release kan starten, is zelfvrijgave toegestaan; zonder andere reviewer zou een verbod daarop iedere release blokkeren. Dit is een vrijgavepoort, geen bewering dat één persoon onafhankelijk vierogencontrole levert.

De staging-URL is niet geheim en noindex is geen toegangsbeveiliging. Ingelogde productroutes blijven beschermd; er staan uitsluitend testgegevens op. De huidige Netlify-token blijft een gedelegeerd accountcredential en hoort uitsluitend in beschermde environments; een later apart deploymentaccount kan die scope verder beperken.
