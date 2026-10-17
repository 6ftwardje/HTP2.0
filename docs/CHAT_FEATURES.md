# Chatprofielen, mentorselectie en online status

Geïmplementeerd en naar productie uitgerold op 17 oktober 2026 in de bestaande Next.js/Supabase-chat. Live op <https://hettradeplatform.be>. De beschrijving van de vorige productieversie blijft in `MENTOR_CHAT_ROLLOUT.md` staan.

## Gedrag en databronnen

- `/mentor` toont boven het gesprek een horizontaal scrollbaar mentormenu. De geselecteerde mentor staat in `?mentor=<student-id>`. Elke student-mentorcombinatie heeft één eigen thread, historie, gelezenstatus en concept. De eerste verzending maakt de thread aan; alleen openen maakt geen lege gesprekken.
- Namen in beide chatweergaven openen een toegankelijk profielvenster met de actuele naam, accountrol en profielfoto. Escape sluit het venster en herstelt de focus. Profielen worden bij openen opnieuw via een geautoriseerde serveractie opgehaald. Contactgegevens, betaalgegevens en interne gegevens worden niet gedeeld.
- Elk inkomend en uitgaand bericht toont de accountfoto uit de bestaande private `profile-avatars`-bucket via `/api/avatars`. Ontbrekende of mislukte afbeeldingen krijgen initialen.
- Beschikbare mentoren komen uit de bestaande vertrouwde `user_roles` met rol `mentor`, plus de expliciet geconfigureerde standaardmentor. Beheerrechten alleen openen geen gesprekken van anderen. De standaardmentor wordt als mentor geregistreerd, zodat veranderen van de standaard geen oude gesprekken verplaatst of verbergt. De globale chatschakelaar, accountblokkades en ingetrokken deelname blijven gelden.
- Online status gebruikt één provider in de beschermde gebruikers- en beheeromgeving: een geauthenticeerde heartbeat per browsertab om de 25 seconden en een gebundelde, geautoriseerde controle om de 15 seconden. Een gesloten tab meldt zich zo mogelijk direct af; een verbroken verbinding vervalt na maximaal circa 65 seconden. Meerdere tabbladen houden afzonderlijke sessies bij. Onbekende status krijgt geen verzonnen online-indicator.

De bestaande Supabase-realtimekanalen blijven nieuwe berichten en meldingen leveren. Voor aanwezigheid is een kortdurende databasesessie gekozen: identiteit en vervaltijd worden op de server vastgesteld, ook bij verbroken verbindingen. Er zijn geen dependencies toegevoegd.

## Gewijzigde onderdelen

- Chat: `MentorChatPanel`, `ChatWorkspace`, `MentorInbox`, het mentorroutebestand en de bestaande chatserveracties.
- Hergebruik: `students`, `user_roles`, `student_avatars`, `conversation_threads`, deelnemers, berichten, bijlagen en notificaties.
- Nieuw: `ChatPeople`, `MentorSelector`, `lib/chat-profiles.ts`, `lib/chat-presence.tsx` en de private tabel `chat_presence_sessions`.
- Migratie: `supabase/migrations/20261017000000_chat_profiles_mentors_presence.sql`. Deze bewaart bestaande thread- en berichtidentiteiten en vervangt de unieke studentthread door uniciteit per student en mentor. Bijlagen, inbox, meldingen en e-mailcontroles gebruiken de mentor van het specifieke gesprek. De optionele campagne-e-mailhelper wordt alleen aangepast als deze al geïnstalleerd is.

Pas de migratie samen met de applicatiewijzigingen toe op de bedoelde omgeving. De eerdere chat- en avatarmigraties zijn vereist. De bestaande instellingen voor externe e-mailverzending worden niet geactiveerd.

## Verificatie

Geslaagd: TypeScript, gerichte ESLint-controle, productiebuild, alle 271 unit-tests, de bestaande privacy-/e-mail-SQL-suites en de nieuwe `tests/sql/mentor-chat-profiles-presence.sql`. Ook de bestaande Auth/RPC/RLS/Realtime-, notificatieshell- en HTTP/Storage-bijlagensuites zijn opnieuw geslaagd.

De lokale integratie gebruikt echte Supabase Auth-sessies, Postgres-RLS, Storage en Realtime met tijdelijke fictieve accounts. Deze scripts weigeren externe endpoints en bewaren inloggegevens uitsluitend in tijdelijke bestanden met beperkte bestandsrechten:

```sh
LOCAL_SUPABASE_ENV_FILE=/tmp/local.env node --import tsx scripts/verify-chat-features-local.ts --keep
CHAT_FEATURE_TEST_BASE_URL=http://127.0.0.1:3114 node scripts/verify-chat-features-browser.mjs
LOCAL_SUPABASE_ENV_FILE=/tmp/local.env node --import tsx scripts/verify-chat-features-local.ts --cleanup
```

De Next-server moet dezelfde lokale Supabase-omgeving gebruiken; `NEXT_PUBLIC_SITE_URL` moet overeenkomen met de gebruikte browser-URL, inclusief host en poort. De nieuwe integratiesuite verwacht een afzonderlijke lokale database zonder bestaande mentorchatthreads. De GitHub-workflow voert de nieuwe databasecontroles na de bestaande chatcontroles uit; een hosted CI-run is nog niet uitgevoerd.

De volledige browserflow slaagt: profiel/focus, echte accountfoto’s, mentorwissel en conceptbehoud, afzonderlijke historie, antwoorden tussen twee sessies, een nieuwe conversatie met upload, online status en verdwijnen na sessiesluiting, en bediening op 1440, 768 en 390 pixels. Ook een directe mentorwissel na de eerste verzending is gecontroleerd op late navigatieverversingen. De screenshots staan lokaal onder `output/playwright/chat-features-*`.

## Productie-uitrol van 17 oktober 2026

- Netlify-site `htp2`, productie-deploy `6ad3951abeed8a796c5b4daf`, gepubliceerd om 17:33 CEST. Status `ready`, context `production`; de tijdelijke publicatievergrendeling is opgeheven. De bestaande `chat-maintenance`-functie blijft elke minuut draaien.
- De release is geïsoleerd opgebouwd vanaf de bestaande productiebron `54f40471e0ab1c3915315d500f9697a5ea84f9e2`, met uitsluitend de chatuitbreiding uit runtimecommit `19438b7` op `codex/chat-features-production`. Andere lokale wijzigingen aan onder meer authenticatie, betalingen en marktupdates zijn niet meegenomen. Deze CLI-deploy heeft geen Git-commit in de Netlify-metadata; gebruik de releasebranch als bron bij volgende releases.
- Migratie `20261017000000_chat_profiles_mentors_presence.sql` is toegepast op het bestaande HTP2-project `swohtycdqbydqrtjzwwf` en atomair geregistreerd in de migratiehistorie. De eerdere gesprekken, berichten, deelnemers, meldingen en bestanden zijn behouden. Er zijn geen andere databasemigraties uitgevoerd.
- Vóór de migratie zijn een schema-export, gerichte data-export en de bestaande avatarbestanden opgeslagen in de private map `/Users/wardjanssen/.codex/backups/htp-chat-features-1KLjzO` (map `0700`, bestanden `0600`). De transactie controleerde aantallen en volledige rijhashes van twaalf bestaande tabellen vóór en na de migratie. Die bleven gelijk: onder andere 65 gesprekken, 35 berichten en twee avatars. Er is geen hersteltest uitgevoerd.
- De bestaande standaardmentor is als mentor vastgelegd; beheerders worden niet automatisch mentor. Bestaande globale chat- en e-mailinstellingen zijn ongewijzigd. Externe chat-e-mailverzending is niet geactiveerd.

De geïsoleerde release slaagt voor alle 232 aanwezige unit-tests, TypeScript, gerichte ESLint en de productiebuild. Een ingelogde rooktest op een conceptdeploy controleerde eerst de echte standaardmentor, profielgegevens, foto, serverroutes en alle JavaScript-/CSS-bestanden. Daarna is de volledige flow op het productiedomein getest met vier duidelijk herkenbare tijdelijke accounts en echte productie-Auth, RPC, RLS, Realtime en private Storage:

- Klikbare databaseprofielen, rolbeperking, sluiting met Escape en correct focusherstel.
- Accountfoto’s naast inkomende en uitgaande berichten, inclusief initialen zonder foto.
- Meerdere mentoren, gescheiden historie en concepten, herladen en directe mentorwissel na de eerste verzending.
- Een antwoord vanuit een afzonderlijke mentorsessie dat via realtime in de studentchat verschijnt.
- Online status in menu en profiel, gevolgd door offline na het verlaten van de browser of verlopen van de sessie.
- Een daadwerkelijk geüploade screenshot in het juiste gesprek; de eigenaar ontvangt de private bytes, een andere student krijgt `404`.
- Bediening en verzendknoppen op 1440, 768 en 390 pixels, inclusief het profielvenster in donkere mobiele weergave. Er waren geen browserruntimefouten.

Er zijn geen berichten naar echte leden gestuurd. Na afloop zijn exact de vier testaccounts, twee tijdelijke mentorrollen, drie testgesprekken, zeven testberichten, twee testavatars, één testscreenshot en bijbehorende meldingen, wachtrijen en aanwezigheid verwijderd. De openbare testuitslag staat in `output/playwright/chat-production-features-verification.txt`; screenshots staan onder `output/playwright/chat-production-features-*`. De private logboeken en gegevenscontroles staan bij de backup. `scripts/verify-chat-features-target.mjs` voert uitsluitend leescontroles uit op de bedoelde productieomgeving. `scripts/verify-chat-features-production.mjs` bevat zowel `--prepublish <concept-url>` als de bewaakte volledige productieflow; voer die uitsluitend opnieuw uit met expliciete uitrol-/testautorisatie en een privaat herstelbestand.

Bij een plotseling verbroken verbinding kan de online status nog circa 65 seconden zichtbaar blijven. Een hosted GitHub CI-run is niet uitgevoerd; de beschreven lokale, concept- en productiecontroles zijn wel uitgevoerd.

### Een lokale Netlify-build opnieuw publiceren

Deze release is gebouwd met `netlify build --offline --context production` en de gecontroleerde echte productievariabelen in het proces. De lokale CLI leverde via de online omgevingsvariabelen-API gemaskeerde waarden terug; die mogen nooit in de Next-build terechtkomen. Houd de echte waarden privé en controleer de gecompileerde bundel vóór upload.

Bij bouwen op macOS moeten ook de Linux-x64-binaries van de reeds gebruikte Sharp-versie in de serverbundel zitten. De exacte versies komen uit Sharps `optionalDependencies`; er zijn geen package- of lockfilewijzigingen voor deze release gedaan. De Linux-imagecode is vóór publicatie ook in de Lambda Node 22-container gecontroleerd.

De Next-adapter bewaart de publiceerbare bestanden na de lokale build in `.netlify/static`. Een losse `--no-build`-deploy moet daarom expliciet `--dir .netlify/static` gebruiken. Bewaar daarnaast de gegenereerde `images`, `headers` en `redirects` uit `.netlify/netlify.toml` in de actieve deployconfiguratie. Gebruik hiervoor tijdelijk de oorspronkelijke bronconfiguratie plus die gegenereerde secties; begin bij elke poging opnieuw bij de oorspronkelijke configuratie en herstel die na afloop. Publiceer dezelfde gecontroleerde build zonder tussentijdse herbouw.

```sh
node scripts/verify-chat-deployment-bundle.mjs --publish-dir .netlify/static
netlify deploy --no-build --dir .netlify/static --site 8c1e7273-8140-4a47-88e7-9dbd11241229
# Eerst ingelogd testen op de geretourneerde concept-URL.
netlify deploy --prod --no-build --dir .netlify/static --site 8c1e7273-8140-4a47-88e7-9dbd11241229
```

De bundelcontrole controleert de gecompileerde publieke configuratie, alle 101 Next-assets en twee publieke assets, de gegenereerde deployconfiguratie, de serverhandler en de Linux-imagebibliotheken. Herstel bij een mislukte release de eerdere Netlify-deploy; herstel nooit bestaande gebruikersdata om tijdelijke testgegevens op te ruimen. Deze migratie ondersteunt ook de eerdere applicatieversie.
