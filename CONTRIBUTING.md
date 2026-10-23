# Samen ontwikkelen op Het Trade Platform

Dit is de centrale werkafspraak voor Ward, Dylan en hun coding agents. Begin in de [startmap](developer-kit/README.md). Het operationele releaseproces staat in [STAGING_RELEASE_FLOW.md](docs/STAGING_RELEASE_FLOW.md).

## Eén issue, één branch, één PR

1. Kies één open issue met label `backlog`, duidelijke acceptatiecriteria en een unieke taakcode. Controleer open én gesloten issues; hergebruik geen code. Lokale issuebronnen staan in `.github/backlog/`.
2. Begin vanaf actuele **`origin/codex/staging`**. Gebruik `codex/<taakcode>-<korte-naam>`; `feat/`, `fix/` en `docs/` zijn ook toegestaan. GitHub vereist `^(feat|fix|docs|codex)/[A-Z]\d+\.\d+-[a-z0-9-]+$`.
3. Open vroeg een draft-PR **naar `codex/staging`**, met exact één `Closes #<issue>`. Gebruik `Refs #...` voor relaties en vul het PR-template in.
4. Maak kleine, begrijpelijke commits. Eén branch heeft één eigenaar; parallel werk krijgt een eigen branch én checkout/worktree. Twee AI-sessies wijzigen niet dezelfde werkmap.
5. Houd scope bij het issue; leg aanvullingen apart vast. Bewaar andermans lokale wijzigingen. Gebruik geen reset, clean of force-push om een werkmap passend te maken.

Startcommando's na het kiezen van een echte unieke code:

```sh
git status --short
git fetch origin
git switch -c codex/<taakcode>-<naam> origin/codex/staging
```

De hoekhaken zijn invulvelden. Bij lokale wijzigingen: eerst vastleggen of een aparte checkout gebruiken. Maak voor een volgende taak een nieuwe branch; hergebruik geen samengevoegde branch.

## Omgevingen en toegang

| Waar | Doel | Werkwijze |
| --- | --- | --- |
| Lokale featurecheckout | Code en lokale tests | `npm run dev:safe`, expliciete ontwikkelconfiguratie |
| `codex/staging` | Gedeelde integratie en acceptatie | PR, daarna automatische migraties/drafttests/publicatie |
| `main` | Goedgekeurde productiebron | Release-PR vanaf staging, daarna Wards vrijgave |

Werk en commit nooit rechtstreeks op `main` of `codex/staging`. Deploy niet lokaal of via een dashboardknop. Omzeil geen branchbescherming en wijzig geen productie-instellingen voor een test.

De eerste onboardingroute gebruikt een **lokale website met de gedeelde stagingdatabase**, alleen dummydata. Dit is nog geen eigen database per ontwikkelaar. App-acties kunnen gedeelde dummygegevens wijzigen: gebruik eigen herkenbare records, stem schrijftests af en verwijder geen vaste acceptatiefixtures. Schemawijzigingen worden vóór samenvoegen op een verse geïsoleerde CI-database gerepeteerd. Verdere lokale isolatie staat in het [invoerplan](developer-kit/PLAN.md).

Deel GitHub-toegang en benodigde staging-runtimekeys via een wachtwoordmanager. Dagelijks werk vereist geen productiesleutels, Netlify-token, databasewachtwoord of backupherstelsleutel. Lees privébestanden niet voor context; zet credentials nooit in prompts, issues, Git, screenshots of logs. Deel alleen lege templates, geen ingevulde `.env`-bestanden of bestaande werkmap.

## Werken en testen

- Lees issue, relevante businessregels en bestaande code. Het transcriptieplan geldt alleen voor transcriptiewerk; historische statusnotities vervangen de actuele releaseafspraken niet.
- Synchroniseer regelmatig met `origin/codex/staging`: merge in je eigen branch, los conflicten inhoudelijk op en test opnieuw. Rebase alleen eigen nog niet gedeeld werk; force-push geen gedeelde branch.
- Houd staging als geheel uit te brengen. Lever kleine afgeronde wijzigingen; verberg onvoltooide functies achter standaard uitgeschakelde flags. Een release promoveert de hele geteste tree, geen losse geselecteerde commits.
- Test naar risico: unit/integratie, foutpaden en roltoegang. Gebruik synthetische data en mocks. Controleer UI op desktop, mobiel, laden/leegte/fouten, toetsenbord en relevante rollen; voeg bruikbaar bewijs toe.
- Echte betalingen, mails en AI-/videoproviderwrites vereisen afzonderlijke toestemming en testconfiguratie. Verlaag nooit een test of toegangscontrole om een fout te verbergen.

Voor code-PR's:

Voer typecheck/build niet tegelijk uit met het starten of herbouwen van Next.js in dezelfde checkout: beide gebruiken gegenereerde `.next`-bestanden. Stop die devserver eerst of gebruik een aparte checkout.

```sh
npm test
npm run test:release
npx tsc --noEmit --incremental false
npm run lint
node scripts/sync-transcription-backlog.mjs --check
```

CI controleert ook build, mentorchat en een verse schema-/fixtureproef. Voor alleen documentatie volstaan lokaal inhoud-/linkcontrole en backlogvalidatie; verplichte CI blijft gelden. Noteer echte resultaten onder `## Testbewijs`, plus `Bewust niet uitgevoerd` met reden. Claim geen ongeteste werking.

## Databasewijzigingen

Maak nieuwe uniek gedateerde migraties na de releasebaseline; wijzig geen toegepast SQL-bestand. Werk additief en achterwaarts compatibel. Splits verwijderen/hernoemen op in releases en neem RLS, functies/rechten, indexes en roltests mee.

Volg het [release-runbook](docs/STAGING_RELEASE_FLOW.md#databasebaseline-en-migraties) voor checksums, migration-lock en schemafingerprints. Laat de verse CI-repetitie slagen. Geen gedeelde Dashboard-DDL, `db push`, `db reset`, bootstrap of seed vanuit een featurecheckout: GitHub voert gedeelde migraties uit. Kopieer nooit stagingdata naar productie.

## Review en stagingacceptatie

Teamafspraak: de andere ontwikkelaar leest diff en testbewijs vóór samenvoegen. Auth-, database-, betaal- en providerwijzigingen krijgen gerichte domeinreview. GitHub vereist momenteel technisch **nul PR-approvals**; de checks en productie-vrijgave zijn wel afgedwongen. Activeer minimaal één approval zodra beiden reviewer-toegang en beschikbaarheid hebben. Presenteer de teamafspraak niet als al afgedwongen vierogencontrole.

Merge na vervulde criteria, review, actuele base en groene checks. Feature-PR's mogen met squash naar staging; productie-release-PR's vereisen een merge commit. Wacht op een geslaagde **`Staging deployment`** en controleer de feature op staging. Groene PR-checks alleen bewijzen geen geslaagde uitrol.

Leg staginglink, broncommit en bewijs vast in PR/issue. `Closes #...` is verplicht, maar GitHub sluit het issue normaal pas wanneer de code defaultbranch `main` bereikt. Onderscheid “getest op staging” en “live op productie”.

## Productie en herstel

Ward coördineert één release-PR `codex/staging` → `main`. Houd staging stil vanaf kandidaatkeuze tot de productiejob klaar is: een nieuwe stagingdeploy maakt de eerdere kandidaat ongeldig. De promotiecheck vergelijkt draaiende stagingcommit en acceptatiereceipt. Merge met **Create a merge commit**, daarna Wards beschermde Environment-vrijgave. De workflow maakt een versleutelde backup, migreert, bouwt met productieconfiguratie en test vóór publicatie.

Synchroniseer de nieuwe main-merge daarna terug via een normale taakbranch/PR naar staging; direct `main` → staging voldoet niet aan het taakcodebeleid. De volgende kandidaat moet actuele main-geschiedenis bevatten. Herstel incidenten via het release-runbook; bypass geen tests/bescherming. Websiteherstel draait databasewijzigingen niet terug.

## Bronnen en beheer

Deze afspraken sluiten aan bij [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) en [Supabase environment management](https://supabase.com/docs/guides/deployment/managing-environments). Ons gecontroleerde baselineproces geldt op gedeelde doelen; volg daar geen generieke `db push`-voorbeelden.

Backlogvalidatie is lokaal en read-only. Volledige remote backlogsynchronisatie is geen dagelijkse stap; die kan veel issues aanpassen en vereist afzonderlijke toestemming.
