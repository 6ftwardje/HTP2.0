# Subscription rollout — €99 per maand

## Vastgelegde productregels

- Consumentenprijs: **€99 per maand, inclusief btw**.
- Verkoopgebied: België en Nederland.
- Inbegrepen: minstens twee marktupdates in totaal per week, verdeeld over de markten volgens de actualiteit.
- Inbegrepen: één Weekly Outlook-livesessie per week.
- Replays blijven vanaf publicatie minstens 28 dagen beschikbaar.
- Opzegging stopt de automatische verlenging; toegang blijft tot het einde van de betaalperiode.
- `past_due`, `unpaid`, `paused`, `incomplete_expired` en `canceled` geven geen subscriptiontoegang.
- Nieuwe Academy-aankoop: drie maanden gratis entitlement, zonder automatische betaalstart.
- Bestaande Academy-student bij introductie: één maand gratis entitlement.

## Fase 1 — billing en toegang

Status: gebouwd en in Stripe/Supabase sandbox end-to-end getest voor succesvolle
checkout, webhookprojectie, entitlement, profielstatus, afgeschermde content en
de Billing Portal. Foutscenario's en productieconfiguratie blijven vereist.

- Stripe-hosted Checkout voor het maandabonnement.
- Stripe Billing Portal voor betaalmethode, facturen en opzegging.
- Ondertekende webhook met idempotente eventregistratie.
- Eigen billing-projectie in Supabase; Stripe blijft de bron voor betaalstatus.
- Los entitlementmodel zodat Academy, bonus en subscription elkaar niet vervuilen.
- Subscriptionstatus en beheerknop op het profiel.
- Server-side paywall op marktupdates, Weekly Outlook-replays en livesessies.

Benodigde productieconfiguratie:

1. Maak in de juiste Stripe-account één recurring EUR-prijs van €99 per maand aan met inclusief belastinggedrag.
2. Activeer en configureer Stripe Tax voor België en Nederland. Laat btw-registratie, OSS en factuurvereisten bevestigen door de boekhouder.
3. Configureer de Customer Portal: opzeggen aan periode-einde, betaalmethode aanpassen en factuurhistoriek.
4. Registreer `/api/stripe/webhook` met minimaal:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Zet `STRIPE_SECRET_KEY`, `STRIPE_SUBSCRIPTION_PRICE_ID` en `STRIPE_WEBHOOK_SECRET` in de deploymentomgeving.
6. Verkoopgebied België/Nederland wordt in beide Checkout-flows hard afgedwongen via `shipping_address_collection.allowed_countries`. Stripe biedt geen aparte allowlist voor het facturatieadres. Test daarom vóór livegang een Belgisch adres, Nederlands adres en een geweigerd adres buiten BE/NL.
7. Koppel `grantAcademySubscriptionBonus` aan de bevestigde Academy-betaalflow zodra die flow in deze codebase beschikbaar is.

## Fase 2 — live agenda

Status: lokaal gebouwd voor de MVP.

- Admin plant een Weekly Outlook in Brussel/Amsterdam-tijd.
- Een sessie kan als draft worden bewaard en later gepubliceerd.
- De externe ClickMeeting-link staat in een afgeschermde tabel en wordt niet via normale reads uitgeleverd.
- Studenten zien de volgende sessie op dashboard en agenda.
- Deelname opent 15 minuten voor aanvang en loopt via een server-side entitlementcheck.
- Studenten kunnen een private `.ics`-agenda-entry downloaden.
- Annuleren vereist een reden en maakt een in-appmelding voor actieve subscribers.
- Een mentor kan na afloop een replay voor minimaal 28 dagen koppelen.

Nog vereist:

- Kies en configureer een transactionele e-mailprovider voor plannings-, herinnerings- en annuleringsmails. De in-appmelding bestaat al; e-mailbezorging nog niet.
- Voeg herinneringen toe, bijvoorbeeld 24 uur en 15 minuten vooraf, via een betrouwbare scheduler.
- Beslis of de gedeelde ClickMeeting-link voldoende is. Voor betere lekbeperking gebruikt de volgende versie de ClickMeeting API voor een per-student/autologin-link.
- Voeg wijzigen/verplaatsen van een geplande sessie toe, inclusief een nieuwe melding en bijgewerkte agenda-uitnodiging.
- Leg mentor/content-managerrollen definitief vast. De huidige beheerschermen blijven bewust admin-only.

## Fase 3 — launch hardening

Blokkers vóór betalende livegang:

- Maak een Mux signing key aan, configureer `MUX_SIGNING_KEY_ID` en `MUX_SIGNING_PRIVATE_KEY`, en zet alle subscription-playback-ID's op policy `signed`. De server-tokenflow is gebouwd; test dat een verlopen entitlement geen afspeeltoken meer krijgt.
- Test webhooks met Stripe CLI: succes, geweigerde eerste betaling, renewal, `past_due`, herstel, opzegging en event retries/out-of-order delivery.
- Test bonusverval voor drie maanden en de eenmalige retroactieve maand, inclusief melding en directe lock.
- Maak supportprocedures voor refund, chargeback, dubbele klant, manuele entitlement en foutieve btw-locatie.
- Voeg monitoring toe voor mislukte webhooks, mailbezorging en livesessie-annuleringen.
- Controleer voorwaarden, privacytekst, risicowaarschuwing, herroepingsrecht/digitale inhoud en facturatie met juridisch/fiscaal advies.
- Publiceer daarna de goedgekeurde voorwaarden-URL in Stripe en zet
  `STRIPE_COLLECT_TERMS_OF_SERVICE=true`. In testomgevingen blijft dit uit zolang
  die URL ontbreekt; zo wordt er geen misleidende placeholder als voorwaarden gebruikt.
- Voer een volledige acceptatietest uit als gratis student, Academy-student, actieve subscriber, opgezegde subscriber, `past_due` student en admin.

## Go/no-go

Er gaat pas echt geld door de flow wanneer alle onderstaande punten groen zijn:

- De Supabase-migraties staan op het geverifieerde HTP2-project.
- Stripe test mode is volledig doorlopen en webhookevents worden zonder fouten verwerkt.
- De prijs toont overal expliciet `€99 / maand · incl. btw`.
- De Belgische/Nederlandse verkoopbeperking is getest.
- De betaalstatus sluit of opent content zonder handmatige actie.
- Video-URL's en live-links zijn niet rechtstreeks publiek uitleesbaar.
- Annulerings- en betalingsproblemen zijn zichtbaar voor student én support.
