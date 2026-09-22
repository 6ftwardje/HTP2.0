# Betalingen — productiechecklist

Laatste technische controle: 22 september 2026.

## Afgerond

- Netlify CLI is lokaal gekoppeld aan `htp2` (`https://hettradeplatform.be`).
- Live Stripe-product `Het Trade Platform Subscription`: EUR 99/maand, belasting inbegrepen.
- Live Stripe-product `Het Trade Platform Academy`: EUR 2.000 eenmalig, belasting inbegrepen.
- De bijbehorende live prijs-ID's staan in de Netlify-productiecontext.
- Productiewebhook `Het Trade Platform productie` is actief op
  `https://hettradeplatform.be/api/stripe/webhook`.
- De webhook luistert naar checkout completion, subscription created/updated/deleted,
  invoice paid en invoice payment failed.
- Het nieuwe signing secret staat in de Netlify-productiecontext.
- Beide Checkout-flows beperken adressen hard tot België en Nederland.
- `STRIPE_COLLECT_TERMS_OF_SERVICE` blijft `false` tot de definitieve voorwaarden
  gepubliceerd en in Stripe ingesteld zijn.
- `npm run build` slaagt.

## Eigenaar — Ward

### 1. Live Stripe API-sleutel vrijgeven

1. Open Stripe live mode → Developers → API keys.
2. Kies `Reveal live key`.
3. Rond de gevraagde beveiligingsverificatie af.
4. Vervang alleen de **Production**-waarde van `STRIPE_SECRET_KEY` in Netlify.
5. Start daarna een nieuwe productiedeploy.

De huidige Netlify-productiesleutel authenticeert niet tegen de nieuwe live
Stripe-prijs (HTTP 401) en is dus geen geldige sleutel voor deze live account.

### 2. Definitieve voorwaarden

1. Laat algemene voorwaarden, privacy, herroepingsrecht voor digitale inhoud en
   risicowaarschuwing juridisch goedkeuren.
2. Publiceer de definitieve voorwaarden op een stabiele publieke HTTPS-URL,
   bij voorkeur `https://hettradeplatform.be/algemene-voorwaarden`.
3. Stel die URL in bij de publieke bedrijfsgegevens van Stripe Checkout.
4. Zet daarna in Netlify Production `STRIPE_COLLECT_TERMS_OF_SERVICE=true` en
   voer opnieuw een productiedeploy uit.

### 3. Boekhouder — Stripe Tax en OSS

Vraag schriftelijke bevestiging van:

- de juiste btw-behandeling voor Belgische en Nederlandse B2C- en B2B-klanten;
- Belgische registratie versus Unieregeling/OSS en de ingangsdatum;
- behandeling en validatie van btw-nummers;
- verplichte factuurvelden, nummering, bewaartermijn en creditnota's;
- correcte Stripe Tax-productcode voor de online dienst en Academy;
- of verkoop strikt beperkt moet blijven tot BE/NL wanneer een kaart of
  btw-nummer uit een ander land komt.

Configureer pas daarna de live Stripe Tax-registraties voor België en Nederland.

### 4. Acceptatietests vóór go-live

Gebruik testmodus en leg per scenario event-ID, webhookstatus en verwachte
toegang vast:

- succesvolle eerste subscriptionbetaling → status `active`, toegang open;
- renewal `invoice.paid` → periode verlengd, toegang blijft open;
- mislukte betaling `invoice.payment_failed` → status `past_due`, toegang dicht,
  melding zichtbaar;
- betaalherstel → status `active`, toegang opnieuw open;
- opzeggen aan periode-einde → toegang blijft open tot einde periode;
- definitieve `customer.subscription.deleted` → toegang dicht;
- Belgische en Nederlandse checkout slagen;
- adres buiten BE/NL kan Checkout niet voltooien;
- Academy-betaling geeft lifetime Academy + drie maanden bonus zonder renewal;
- webhook retry en een ouder/out-of-order event beschadigen de actuele status niet.

Zeg de bestaande sandboxsubscription pas op wanneer de opzegtest start; verifieer
eerst `cancel_at_period_end=true`, en daarna het verlies van toegang op het
gesimuleerde periode-einde.

## Go/no-go

Geen echte betaling aannemen voordat de live API-sleutel is vervangen, een
productiedeploy is uitgevoerd, Stripe Tax/OSS en voorwaarden zijn goedgekeurd,
en alle acceptatietests groen zijn.
