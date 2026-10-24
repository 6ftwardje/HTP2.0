# Eerste installatie

## Vooraf regelen

- GitHub-toegang tot `6ftwardje/HTP2.0` voor branches en PR's.
- Node.js **22**, npm en Git via hun officiële distributie. GitHub CLI is optioneel; een globale Netlify-/Supabase-login is niet nodig voor deze route.
- De **staging** anon/publishable key, server-only service-role/secret key en dummywachtwoord via een wachtwoordmanager. De servicekey heeft ruime rechten binnen staging en blijft privé.
- Eén open backlogissue met unieke taakcode en acceptatiecriteria. Zonder opdracht kun je eerst de regels lezen; verzin geen bestaande taakcode.

## Nieuwe clone

```sh
git clone --branch codex/staging https://github.com/6ftwardje/HTP2.0.git htp-development
cd htp-development
git fetch origin
```

Maak nu je eigen branch met de echte issuecode volgens [CONTRIBUTING.md](../../CONTRIBUTING.md). Open de repo-root in je AI-editor. Kopieer geen bestaande werkmap, `.netlify`-link of productie-`.env.local`.

```sh
npm ci
cp developer-kit/01-setup/.env.development.example .env.development.local
```

Vul zelf alleen de twee lege staging-runtimekeys in `.env.development.local` in. Laat de veilige standaardwaarden staan. Print of plak het bestand niet in een AI-chat.

Beperk op macOS/Linux de bestandsrechten met `chmod 600 .env.development.local`. Is poort 3000 al bezet, kies dan een vrije poort in `NEXT_PUBLIC_SITE_URL`; `dev:safe` gebruikt diezelfde poort.

```sh
npm run dev:check
npm run dev:safe
```

Open `http://localhost:3000`. Log in met `member@staging.htp.test` of `admin@staging.htp.test` en het apart ontvangen dummywachtwoord. Code draait lokaal; de dummydata leeft in de gedeelde stagingdatabase. Het staginglabel is extra herkenning, geen beveiligingsgrens.

Gewone login met vooraf bevestigde dummyaccounts is de eerste route. Resetmail, bevestigingsmail en OAuth zijn nog geen lokale acceptatieroute: cloud-Auth-redirects staan bewust uitsluitend op het vaste stagingadres. Test die later met afgesproken testconfiguratie.

## Wat de guard controleert

`dev:check` en `dev:safe` controleren repo-remote, taakbranch, expliciete staging-URL, runtimekeys, localhost-origin en uitgeschakelde mail-/worker-/betaalvlaggen. Andere Next.js-envbestanden en gevoelige overervende shellvariabelen blokkeren deze route. Provider-, deployment- en databasecredentials horen hier niet thuis. De controle toont geen waarden en doet geen cloudwrites; `dev:safe` start daarna Next.js.

Dit is een guard voor de startopdracht; iemand met lokale bestandsrechten kan andere commando's uitvoeren. Volg ook de werkafspraken en GitHub-bescherming. Bij een blokkade: corrigeer de bron of gebruik een nieuwe clone. Verwijder geen onbekend credentialbestand en verzwak de controle niet.

## Grenzen

App-acties kunnen gedeelde dummydata wijzigen. Gebruik eigen herkenbare testrecords en stem schrijftests af. Geen cloud-DDL, reset of seed vanuit je featurecheckout. Nieuwe schema's volgen de geïsoleerde CI-repetitie en releasejob.

Echte video, AI, betaling en mail hebben afzonderlijke goedgekeurde testintegraties nodig. Gebruik fixtures/mocks. Een eigen lokale Supabase per ontwikkelaar is een [vervolgstap](../PLAN.md), nog geen onderdeel van deze installer.
