# Status van de Netlify stagingomgeving

Bijgewerkt op 23 oktober 2026, Europe/Brussels.

De aparte Netlify-staging is aangemaakt en gekoppeld aan de stagingbranch. Er staat een statische wachtpagina online. De volledige applicatie wacht op Dylans Supabase-project, de inrichting van het bijbehorende schema en de stagingcredentials.

## Aangemaakt en gecontroleerd

| Onderdeel | Waarde |
| --- | --- |
| Stagingwebsite | https://htp-staging.netlify.app |
| Netlify-beheer | https://app.netlify.com/projects/htp-staging |
| Staging-site-ID | d798281b-ff2a-48bb-9ecf-3b9dea2a7c21 |
| Repository | 6ftwardje/HTP2.0 |
| Hoofdbranch van de stagingsite | codex/staging |
| Uitgangscommit van de applicatie | 4f07cf37b7d97cbd67ddacadc51cc8488c802a85, de gepubliceerde productieversie bij aanvang |
| Codecommit met de stagingvoorbereiding | 65a1bfe8c6daf1c252451c2041b3ab6a2b84d5d4 |
| Gepubliceerde wachtpagina | Deploy 6adb65dd6d74db39550a0675 |
| Automatische Netlify-builds | Gestopt tot Supabase en het schema gereed zijn |
| Buildcommand voor de stagingbranch | node scripts/staging-build.mjs |
| Supabase, betalingen en mailproviders op staging | Nog niet gekoppeld |

De wachtpagina bevat uitsluitend HTML en CSS. Er zijn geen applicatiefuncties of geplande workers mee gedeployd. De pagina en robots.txt antwoorden met HTTP 200. De responses bevatten noindex, nofollow, noarchive en Cache-Control: no-store.

De bestaande productieconfiguratie in netlify.toml is behouden. Alleen de context voor codex/staging heeft een eigen buildcommand en website-URL. Netlify heeft bij een lokale configuratiecontrole bevestigd dat deze branch de staging-buildcommand kiest.

## Bescherming van de doelen

scripts/verify-supabase-target.mjs stopt vóór een netwerkverzoek wanneer de URL naar het huidige HTP2-productieproject of het oudere legacyproject wijst. Een onbekend project wordt alleen geaccepteerd als de URL exact overeenkomt met de expliciet opgegeven HTP_STAGING_SUPABASE_PROJECT_REF.

De controle accepteert uitsluitend de HTTPS-project-URL onder supabase.co, zonder credentials, extra pad, queryparameters of afwijkende poort. Er wordt geen .env.local automatisch geladen. Requests volgen geen redirects. De bestaande controle van schema en dubbele sleutels blijft read-only.

De staging-build controleert daarnaast de vaste Netlify-site-ID, branch, stagingmarkering en website-URL. Ontbrekende Supabase-instellingen, een Stripe-livekey of live applicatiemail blokkeren de build. De controle is bedoeld voor de stagingworkflow; de huidige productie-buildcommand is niet aangepast.

Er zijn acht gerichte tests geslaagd, zowel lokaal als in [GitHub Actions](https://github.com/6ftwardje/HTP2.0/actions/runs/39964766423). De tests gebruiken synthetische gegevens en een nagemaakte fetchfunctie; er zijn geen Supabase-projecten aangeroepen. Ook het behouden read-only auditgedrag en de ontbrekende-configuratieblokkering zijn getest. Er is nog geen volledige app-build met de toekomstige stagingdatabase uitgevoerd.

## Wat op de stagingsite is ingesteld

HTP_ENVIRONMENT is staging, NEXT_PUBLIC_SITE_URL is https://htp-staging.netlify.app en NODE_VERSION is 22. De mailmodi EMAIL_MODE en CHAT_EMAIL_MODE staan op disabled. De capture-, campagne-, aankoop-, afloop- en mentormailvlaggen staan uit. CHAT_MAINTENANCE_ENABLED staat op false. Ook de overige mailgoedkeuringsvlaggen staan uit.

De nieuwe site had geen bestaande omgevingsvariabelen voordat deze waarden werden toegevoegd. Er zijn geen productiecredentials gekopieerd en geen fictieve Supabase-keys ingevuld.

## Aansluiten zodra Dylan klaar is

1. Accepteer de uitnodiging voor Dylans stagingorganisatie en controleer de projectref.
2. Richt een gecontroleerde databasebasis in voor de geselecteerde applicatieversie. Controleer eerst de actuele schema- en migratiehistorie; voer de oude migratiemap niet blind uit.
3. Stel uitsluitend op de Netlify-stagingsite HTP_STAGING_SUPABASE_PROJECT_REF, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY en SUPABASE_SERVICE_ROLE_KEY in met gegevens van hetzelfde stagingproject.
4. Configureer Supabase Auth, redirect-URL's en de bijbehorende auth-e-mailtemplates voor https://htp-staging.netlify.app. Test registratie en herstel eerst met teamadressen.
5. Voer de read-only doelcontrole uit vanuit de stagingcheckout. Een lokale kopie van .env.staging.example heet .env.staging.local en blijft buiten Git:

   node --env-file=.env.staging.local scripts/verify-supabase-target.mjs

6. Controleer het benodigde marktschema en voer de app-build en de bestaande applicatietests uit. Voeg bij het aansluiten van de app de herkenbare stagingaanduiding en uitsluiting van zoekmachines toe; de huidige noindex geldt voor de wachtpagina.
7. Zet pas daarna op de stagingsite Build status op Active builds en start een build van codex/staging. Heractiveren alleen start niet direct een build; gebruik daarna Trigger deploy of een nieuwe push.
8. Test de app online. Richt Stripe-sandbox, testmedia en eventuele andere integraties afzonderlijk in. Applicatiemail blijft disabled of dry_run totdat een bezorgtest apart wordt ingericht.

Het eigen subdomein staging.hettradeplatform.be en de DNS-koppeling zijn nog niet ingesteld. Het Netlify-adres is al bruikbaar als vast stagingadres; een later domein vereist ook aanpassing van de staging-URL in configuratie, tests en Supabase Auth.

## Productiecontrole

De productiesite, hoofdbranch, buildinstellingen, domeinkoppeling, publicatievergrendeling en gepubliceerde deploy waren bij de controle na de inrichting gelijk aan de vastgelegde beginwaarden. Productie staat nog op deploy 6adb6393c6db32424f31f83f, commit 4f07cf37b7d97cbd67ddacadc51cc8488c802a85.

Ook de bestanden .netlify/state.json, .env.local, de bestaande Supabase-projectkoppeling en netlify.toml in de oorspronkelijke werkmap zijn met bestandshashes vergeleken en behouden. Er is geen productiedeploy, databasewijziging, DNS-wijziging of wijziging van productiepublicatie uitgevoerd.

De productie-vrijgavestap uit het eerdere plan is uitsluitend een latere vervolgstap onder Wards beheer. De huidige stagingvoorbereiding heeft die instellingen niet geactiveerd.
