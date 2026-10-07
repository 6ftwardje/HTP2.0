# Synthetische acceptatie en pilotrunbook

## Acceptatiescenario

Het reproduceerbare scenario gebruikt uitsluitend synthetische data en fakes.
De verwachte waarneembare keten is:

1. Een geldig ondertekend Mux-event projecteert een Nederlandstalige
   captiontrack naar `processing`.
2. Synthetische WebVTT wordt geparseerd en het transcript wordt `ready`.
3. Eén gemockte AI-call maakt één gevalideerd concept; dezelfde idempotency key
   maakt geen tweede output of kostenregistratie.
4. Een admin bevestigt publicatie expliciet. Een student ziet daarna uitsluitend
   samenvatting, aandachtspunten, hoofdstukken en publicatietijd.
5. Transcripttekst, providertrack, interne IDs en conceptinhoud komen niet in de
   studentenprojectie.

Het foutscenario laat de eerste AI-call retrybaar falen, hervat dezelfde job en
slaagt bij de tweede poging. Een derde poging hergebruikt het bestaande resultaat:
exact twee providercalls, één concept en één succesvolle kostenregistratie.

Vertaling is conform S0.1 uitgeschakeld. De bewezen MVP-keten is daarom
`fetch_transcript -> enrich -> review -> complete`; er bestaat geen impliciete
vertaalprovider of vertaalartefact in het scenario.

## Configuratie voor de handmatige pilot

Vereist, uitsluitend als server-environment:

- `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` en voor signed playback de bestaande
  Mux-signingvariabelen;
- `MUX_WEBHOOK_SECRET` voor webhookauthenticatie;
- `ANTHROPIC_API_KEY` en het centraal geconfigureerde model;
- `AI_ENRICHMENT_INPUT_EUR_PER_MILLION`,
  `AI_ENRICHMENT_OUTPUT_EUR_PER_MILLION` en
  `AI_ENRICHMENT_PRICING_VALID_UNTIL`;
- `ALLOW_AI_PROVIDER_CALLS=1` alleen tijdens een expliciet goedgekeurde pilot;
- `BACKFILL_DRY_RUN_SIGNING_SECRET` van minimaal 32 willekeurige tekens.

Secrets horen nooit in Git, browservariabelen, screenshots of logs. Pas eerst de
additieve Supabase-migraties toe en verifieer het beoogde project vóór een pilot.

## Handmatige pilot

1. Kies één nieuwe, niet-gevoelige Mux-video; de pilot blijft maximaal tien
   video's en circa 90 minuten nieuwe content per week.
2. Controleer videoduur, playbackstatus, actuele prijsconfiguratie en resterend
   maandbudget.
3. Start captions expliciet in admin en wacht op het geauthenticeerde event.
4. Start de AI-verwerking pas na de kostenbevestiging. Bij `dead_letter` eerst de
   veilige foutcode onderzoeken; voer geen blinde herstart uit.
5. Vergelijk concept en hoofdstukken met de video, corrigeer waar nodig en
   publiceer of wijs af met expliciete bevestiging.
6. Controleer als student dat uitsluitend de gepubliceerde projectie zichtbaar
   is en chapter seek werkt.

Een echte providerpilot, productiebackfill of loadtest valt buiten S4.3 en
vereist een afzonderlijke operationele toestemming.

## Monitoring en kostencontrole

- Volg transcript-, workflow- en enrichmentstatus in admin; behandel
  `dead_letter`, `mux_*`, `cost_gate_blocked` en onbekende outcomes handmatig.
- Controleer `ai_interactions` alleen op feature, model, promptversie, tokenaantal,
  geschatte EUR-kosten, status en veilige foutcode. Log nooit transcripttekst.
- Stop vóór een call bij ontbrekende/verlopen prijsconfiguratie, meer dan EUR 2
  per video of meer dan EUR 50 in de kalendermaand.
- Controleer dubbele Mux-events via de idempotente eventregistratie en dubbele
  enrichments via `(transcript_id, prompt_version, model)`.

## Rollback

1. Zet `ALLOW_AI_PROVIDER_CALLS=0` of verwijder de variabele. Dit blokkeert nieuwe
   betaalde AI-calls fail-closed.
2. Start geen nieuwe captions en laat bestaande concepten ongepubliceerd of wijs
   ze af. Gepubliceerde handmatig beoordeelde inhoud blijft intact.
3. Draai geen destructieve databaseterugrol. De migraties zijn additief; herstel
   applicatiecode via een normale revert/deploy en bewaar auditmetadata.
4. Bij een webhookprobleem roteer het webhooksecret bij Mux en herstel daarna de
   endpointconfiguratie. Verwijder geen eventhistorie om opnieuw afspelen af te
   dwingen.

## Releasechecklist

- [x] `npm test`
- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm audit --audit-level=critical` — geen critical; bestaande developmentbaseline bevat nog twee high-severity afhankelijkheden
- [x] `npm run backlog:check`
- [x] Browser-smoke op desktop: anonieme adminroute wordt correct naar login gestuurd
- [ ] Authenticated browser-smoke van admin dry-run en studentvideo — bewust niet uitgevoerd omdat een dedicated testaccount ontbreekt
- [ ] Productiecontroles bewust apart houden: echte Mux/Anthropic-call,
      productiebackfill, loadtest en live webhookdelivery

Verificatie uitgevoerd op 2026-09-23. De open vakken zijn geen stilzwijgende
releasegoedkeuring: ze vereisen expliciete operationele toestemming en, voor de
authenticated smoke, veilige testaccountcredentials.
