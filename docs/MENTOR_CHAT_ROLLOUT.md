# Uitvoering van de privéchat met Rousso

Bijgewerkt: 14 oktober 2026. Dit document onderscheidt de live privacybeperking van de lokaal gebouwde nieuwe chatrelease. Het volledige ontwerp staat in [het implementatieplan](MENTOR_CHAT_IMPLEMENTATION_PLAN.md).

## Live: privacy en exclusieve routing

Op HTP2 (`swohtycdqbydqrtjzwwf`) is uitsluitend migratie `20261014005000_mentor_chat_privacy_guard.sql` toegepast. De gebruiker bevestigde het bestaande beheeraccount **Rousso**, student-ID `9c42c1e3-26e7-4fea-b4f8-c7c9d405effd`, als enige mentor. Het andere account met naam `rousso` is niet geselecteerd.

- Iedere ingelogde student, ook een gratis lid, houdt toegang tot zijn eigen gesprek.
- Alleen de betreffende student en de expliciet geconfigureerde Rousso hebben reguliere chattoegang. Beheerrechten verlenen geen toegang tot gesprekken van anderen.
- Dezelfde grens geldt voor berichten, interne notities, events, reacties, notificatie-events, recipients en oude gelezenstatusfuncties.
- Nieuwe meldingen bevatten een generieke tekst en een gespreksreferentie. Oude gekopieerde berichttekst is uit chatnotificaties verwijderd; historische distributie verleent geen actuele rechten.
- Bij ontbrekende, geblokkeerde of ongeldige mentorconfiguratie is er geen terugval naar alle beheerders.
- De oude applicatie kan voorlopig blijven werken met haar bestaande schrijfcontract.

Vooraf zijn schema, chatgegevens en notificaties opgeslagen in een private lokale back-upmap: `/Users/wardjanssen/.codex/backups/htp-chat-privacy-MduJ9n`. De map heeft rechten `0700`, bestanden `0600`. De back-up bevat privégegevens en hoort niet in Git. Er is geen hersteltest van deze productieback-up uitgevoerd; dat blijft onderdeel van de vrijgaveprocedure.

De live controle na uitvoering bevestigde 64 behouden threads en 23 behouden berichten, alle mentorchatthreads toegewezen aan Rousso. Met echte accountidentiteiten onder de `authenticated`-rol konden een andere beheerder en een gratis student geen vreemde threads, vreemde berichten of mentorvraagmeldingen lezen. Een beheerder mag als platformlid wel zijn eigen vraag aan Rousso stellen. De historische eigen thread van Rousso blijft bewaard en wordt geen inboxwerktaak.

Herhaal de read-only controle met:

```sh
node scripts/verify-mentor-chat-target.mjs
```

Dit script weigert een ander project, verstuurt geen berichten en toont alleen aantallen en autorisatieresultaten. Het gebruikt de bestaande lokale Supabase-configuratie; credentials worden niet afgedrukt. Het legacyproject `trogwrgxxhsvixzglzpn` is niet gewijzigd.

## Lokaal gebouwd: nieuwe chatrelease

De volgende migraties en bijbehorende applicatiecode zijn lokaal gebouwd. Ze zijn nog niet toegepast op HTP2 of gepubliceerd naar Netlify:

| Migratie | Gedrag |
| --- | --- |
| `20261014010000_mentor_chat_privacy_routing.sql` | Principals en actieve deelnemers, transactionele verzending, publieke volgnummers, gelezen cursors, veilige inboxquery en snelle notificatieshell. Directe chatmutaties worden ingetrokken. |
| `20261014030000_mentor_chat_attachments.sql` | Private screenshots, gevalideerde uploads, beperkte downloadroute, atomische berichtkoppeling en herhaalbare opruiming. Beide publieke verzendfuncties volgen dezelfde payloadcontrole. |
| `20261014031000_mentor_chat_notifications.sql` | Nieuwe tweeminutenbundels in een private mailoutbox, eigen voorkeuren, leases en controle vlak vóór verzending. Geen historische replay. |

De chatrelease is onafhankelijk van de gelijktijdig ontwikkelde mailcampagnemigraties `20000`/`21000` en hun TypeScript-bestanden. Als die mailbasis later aanwezig is, respecteert de chat ook haar mentor/global suppressions.

### Berichten en interface

Studentchat `/mentor` en Rousso's `/mentor-inbox` gebruiken de volledige beschikbare werkruimte. Op mobiel opent één gesprek tegelijk; de terugknop brengt Rousso naar zijn gesprekkenlijst. De bestaande beschermde platformstijl blijft leidend.

- Eerste vraag zonder aankoop, intake of vooraf aangemaakte lege thread. Gelijktijdige profielinitialisatie wordt veilig afgehandeld.
- Eén client-ID per verzendintentie, ook na een verloren antwoord. De canonieke databasebevestiging bepaalt of het bericht is verzonden. Dezelfde sleutel met andere inhoud of screenshots wordt geweigerd.
- Concepten per account en gesprek in `sessionStorage`, met 24 uur vervaltijd en opruiming bij afmelden. Tekstbewerking start een nieuwe verzendintentie; uploadintentie blijft stabiel zolang screenshots bij hetzelfde concept horen.
- Screenshotverwijdering uit een concept werkt ook als een vorige verzending toch opgeslagen was of een upload verlopen is. Een gepubliceerd bestand wordt daarmee niet verwijderd. Canonieke historie kan een verloren verzendbevestiging herstellen.
- Nieuwste 50 publieke berichten, oudere pagina's via volgnummers, deduplicatie, behouden scrollpositie en een knop voor nieuwe berichten tijdens teruglezen.
- Een niet geladen ongelezen achterstand wordt niet automatisch gelezen. De student of mentor kan eerdere ongelezen pagina's laden. Zichtbare berichten worden alleen in een actieve tab gemarkeerd; terugkeer online probeert de gelezenstatus opnieuw.
- Vaste gesprekselectie, ook buiten de gekozen inboxfilter, en een afzonderlijke composer per student. Een lopend antwoord houdt zijn oorspronkelijke thread-ID vast.
- Zoekfunctie over studentnamen en volledige publieke historie, databasepaginering en één preview per gesprek. Interne notities blijven uitsluitend voor Rousso zichtbaar.
- Werkelijke offline/herstelstatus; ophalen na subscribe, reconnect, focus, terugkeer uit een achtergrondtab en een beperkte periodieke controle. Geen fictieve online-indicator voor Rousso.
- Chatbadges gebruiken dezelfde serverbetekenis als de inbox. De notificatieshell autoriseert identiteit en gespreksdeelname eenmaal per batch.

De notificatiequery werd met 332 zichtbare testdeliveries van circa 1,3 seconde naar enkele milliseconden gebracht. De geauthenticeerde RPC werd in de integratiecontrole maximaal circa 13 ms gemeten. Dit is een lokale meting, geen productie-SLA.

### Screenshots

PNG, JPEG en WebP worden gecontroleerd op daadwerkelijke bytes, maximaal 4 MB, 25 megapixels en 10.000 pixels per dimensie. De requeststream wordt begrensd vóór multipartverwerking. SVG/HTML, animaties en ongeldige of afgebroken afbeeldingen worden geweigerd. Volledige decodering en hercodering verwijderen metadata. Beeldverhouding blijft behouden; uitvoer is maximaal 4096 pixels per dimensie.

Een concept kan maximaal drie screenshots bevatten. De server begrenst tevens openstaande uploads en uploads per uur. Uploadretries worden op verwerkte inhoud en uploadintentie gededupliceerd. De eerste release vraagt een korte tekst bij screenshots.

De bucket is private en staat geen directe clientdownloads of signed URLs toe. `GET /api/chat/attachments/[id]` controleert de actuele gebruiker, deelname én gekoppelde berichttoegang, ook voor interne notities. De route retourneert `private, no-store`, `nosniff` en controleert opnieuw na het ophalen van bytes. Ongekoppelde uploads zijn alleen voor de uploader zichtbaar. Pending bestanden ouder dan 24 uur en verweesde objecten worden herhaalbaar opgeruimd.

### Mailworker en beheer

Nieuwe publieke berichten maken in dezelfde databasetransactie een generieke taak aan voor uitsluitend de betrokken ontvanger. Berichten binnen twee minuten worden gebundeld. De worker controleert actuele deelname, Rousso-configuratie, account, e-mailadres, voorkeuren en gelezen cursor opnieuw. Interne notities maken geen taak aan. Mails bevatten geen berichttekst, studentnaam of screenshot, alleen een geauthenticeerde chatlink.

Een lease en vast provider-ID voorkomen dat gewone retries of dubbele workers opnieuw mailen. Na een onduidelijke provideruitkomst blijven payload en idempotency key gelijk. Pogingen buiten het betrouwbare provider-idempotencyvenster gaan naar `needs_review`. Provideracceptatie geldt als `sent`; dat bewijst geen inboxbezorging.

De worker is standaard uitgeschakeld. In de huidige omgeving ontbreken Resend- en zendercredentials; er zijn geen echte mails verstuurd. Instellingen voor de release:

```dotenv
CHAT_EMAIL_MODE=disabled
CHAT_MAINTENANCE_ENABLED=false
CHAT_MAINTENANCE_SECRET=<willekeurig geheim van minimaal 32 tekens>
RESEND_API_KEY=<providercredential>
EMAIL_FROM=<geverifieerde afzender>
EMAIL_REPLY_TO=<antwoordadres>
NEXT_PUBLIC_SITE_URL=https://<platformdomein>
```

`CHAT_EMAIL_MODE=dry_run` controleert taken zonder externe verzending; `live` activeert verzending na correcte technische configuratie. `CHAT_MAINTENANCE_ENABLED=true` activeert uitsluitend screenshotopruiming, ook wanneer mail uit staat. De minuutcron `netlify/functions/chat-maintenance.ts` roept de beveiligde workerroute aan; een lokaal draaiende ontwikkelserver voert deze Netlify-cron niet zelfstandig uit.

De eigen voorkeur is bereikbaar via de belknop in de chat. Het inschakelen daarvan heft een bestaande algemene afmelding/bouncesuppression niet op. Nooit eerder verstuurde taken vervallen na 24 uur, zodat het inschakelen na een lange pilot geen oude wachtrij aan mails veroorzaakt. Controleer de resterende queue en `needs_review` vóór activering. Er is geen automatische replay van bestaande berichtgeschiedenis.

Operationele signalen bevatten uitsluitend IDs, foutcodes, queueleeftijd, attempts en status. `verify-mentor-chat-target.mjs` toont na uitrol ook aantallen failed/needs_review en verlopen leases. Volg blijvende workerfouten en taken ouder dan 15 minuten op. Repareer een taak zonder het oorspronkelijke chatbericht opnieuw te versturen.

## Uitrol en terugval

De gedeelde checkout bevat ook ongepubliceerd werk aan landingpage, authenticatie, avatars en andere mailflows. Publiceer niet de volledige huidige werkmap als een onbedoelde gecombineerde release. Maak eerst een afzonderlijk beoordeeld chatrelease-artifact met de benodigde gedeelde wijzigingen.

De nieuwe applicatie en migratie `10000` moeten samen overgaan: die migratie trekt de directe writes van de oude applicatie in. De live privacyguard kan zelfstandig blijven staan.

1. Controleer opnieuw het HTP2-project, Rousso-ID, actuele aantallen en back-up. Test databaseherstel en, zodra bestanden aanwezig zijn, afzonderlijk Storage-herstel. Een databaseback-up bevat geen Storage-bytes.
2. Pauzeer chat met de beschermde configuratie `enabled=false`. Daardoor kunnen ook oude clients niet schrijven. Communiceer de korte onderhoudsperiode.
3. Publiceer het gecontroleerde nieuwe applicatie-artifact. Controleer dat ontbrekende/uitgeschakelde chatconfiguratie een herstelbare melding geeft.
4. Pas uitsluitend `10000`, `30000` en `31000` gericht en in volgorde toe en registreer hun migratieversies. Gebruik geen brede `supabase db push` die andere pending migraties meeneemt. De migraties bevatten eigen transacties; stop direct bij een fout.
5. Controleer grants, tabel-RLS, private bucket en functions. Activeer daarna `configure_chat_mentor('9c42c1e3-26e7-4fea-b4f8-c7c9d405effd')` via de vertrouwde service/databaseverbinding. Controleer de applicatieversie vóór heropening.
6. Herhaal de read-only targetcontrole en voer de pilot met Rousso en enkele gratis/betalende leden uit. Test eerste vraag, antwoord, notificaties, screenshotdownload en herstel op mobiel. Activeer externe mail pas met werkende providerconfiguratie en gecontroleerde queue.

Bij een probleem kan chat opnieuw gepauzeerd worden of kunnen mail/uploads afzonderlijk uit. Een oude applicatieversie kan na `10000` niet zonder meer weer schrijven. Herstel nooit de brede adminrechten; behoud de privacyguard, berichtgegevens en canonieke verzendcontracten en herstel de applicatie gericht.

## Verificatie en resterende vrijgave

De verificatie omvat unit tests, TypeScript, lint, productiebuild, echte lokale Supabase Auth/PostgREST/RPC/Realtime/Storage-tests en afzonderlijke browsersessies. Browserfixtures bevatten uitsluitend fictieve lokale accounts en berichten.

```sh
npm test
npx tsc --noEmit
npm run lint
npm run build
LOCAL_SUPABASE_ENV_FILE=/tmp/htp-chat-local.env node --import tsx scripts/verify-mentor-chat-local.ts --keep
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -X -v ON_ERROR_STOP=1 -f tests/sql/mentor-chat-privacy-routing.sql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -X -v ON_ERROR_STOP=1 -f tests/sql/mentor-chat-email.sql
LOCAL_SUPABASE_ENV_FILE=/tmp/htp-chat-local.env CHAT_ATTACHMENT_TEST_BASE_URL=http://localhost:3114 node --import tsx tests/chat/attachments.integration.ts
LOCAL_SUPABASE_ENV_FILE=/tmp/htp-chat-local.env node --import tsx tests/chat/notification-shell.integration.ts
LOCAL_SUPABASE_ENV_FILE=/tmp/htp-chat-local.env node --import tsx scripts/verify-mentor-chat-local.ts --cleanup
```

De SQL-checks draaien in transacties en rollen terug. De lokale scripts weigeren een remote testdatabase. De attachmentcheck vereist de door `--keep` gemaakte fixtures en een aparte Next-server op poort 3114 die expliciet de lokale Supabase-URL en lokale keys gebruikt. Bewaar fixturecredentials uitsluitend in tijdelijke bestanden met rechten `0600` en voer `--cleanup` uit na de laatste browser/API-check. De oudere `privacy-slice.integration.ts` test bewust het oude schrijfcontract vóór `10000`; daarna hoort directe verzending geweigerd te worden.

De afzonderlijke workflow `.github/workflows/mentor-chat.yml` bouwt op PR's en via `workflow_dispatch` een verse, ongekoppelde lokale Supabase-stack. Hij voert Auth/RPC/Realtime-, shell-, rollback-SQL- en HTTP/Storage-tests uit zonder repositorysecrets, providercredentials of remote projectlink. Unit tests en build blijven in de bestaande CI. De helper weigert uitvoering buiten een tijdelijke GitHub Actions-runner. Workflow en helper zijn lokaal op syntax en grenzen gecontroleerd; de volledige verse stack moet op zijn eerste hosted CI-run worden bevestigd. Er is vanuit deze taak geen workflow gepubliceerd of gestart.

Vastgelegde lokale resultaten op 14 oktober:

- **233 tests geslaagd**, TypeScript en productiebuild geslaagd. Lint zonder fouten; bestaande waarschuwingen over afbeeldingen buiten de chat blijven aanwezig.
- Echte Auth/RPC/RLS/Realtime-regressie geslaagd na de nieuwe screenshotverzendgrens: gratis toegang, gelijktijdige eerste sends, retries, 300+ berichten, interne notities en ingetrokken toegang.
- Echte Auth/HTTP/Storage-tests geslaagd voor eerste screenshotbericht zonder bestaande thread, private downloads, interne bijlagen, ongeldige bestanden, uploadlimieten en herhaalde cleanup.
- SQL-integratie voor mailbundeling, leases, ongelezen status, afmelding, herhalen en verlopen wachtrijen geslaagd; transacties teruggerold.
- Browser: nieuw gratis account zonder profiel/intake, concept na reload, concepten per student, realtime antwoord, offline retry met dezelfde sleutel, verloren screenshotbevestiging zonder duplicaat, verlopen upload lokaal verwijderen, e-mailvoorkeur na reload en categorie wissen.
- Schermbreedtes 390, 768 en 1440 pixels gecontroleerd, inclusief donkere modus. Geen horizontale overflow; composer blijft zichtbaar.

De lokale testaccounts, screenshots in Storage en browsercredentials zijn na verificatie opgeruimd; de eerdere lokale mentorconfiguratie is hersteld. Voorbeelden van de interface met fictieve testdata staan in `output/playwright/chat-student-mobile-final.png`, `chat-mentor-desktop-final.png` en `chat-student-tablet-dark-final.png`.

Nog te doen voor volledige productievrijgave: het afzonderlijke applicatie-artifact publiceren met de nieuwe migraties, mailprovider en daadwerkelijke cron activeren, hersteldoelen/bewaartermijnen vastleggen en de pilot met echte gebruikers afronden. Een concrete antwoordverwachting van Rousso wordt pas getoond zodra die afgesproken is. Automatisch springen naar een pagina rond de eerste ongelezen grens, getimed snoozen, uitgebreide interne-notitiehistorie en conversiemetingen kunnen daarna gericht volgen. PDF's, reacties, typindicatoren en automatische AI-antwoorden zijn geen onderdeel van deze release.

Het datamodel heeft menselijke, AI- en systeemidentiteiten en een gespreksmodus. Er is geen model geactiveerd en geen gespreksinhoud aan AI doorgestuurd.
