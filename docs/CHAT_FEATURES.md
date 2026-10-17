# Chatprofielen, mentorselectie en online status

Geïmplementeerd op 17 oktober 2026 in de bestaande Next.js/Supabase-chat. Deze uitbreiding is lokaal getest; de applicatie en migratie zijn niet naar productie uitgerold. De beschrijving van de vorige productieversie blijft in `MENTOR_CHAT_ROLLOUT.md` staan.

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
