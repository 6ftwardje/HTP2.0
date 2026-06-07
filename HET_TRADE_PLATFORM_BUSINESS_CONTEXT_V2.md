# Het Trade Platform - Business en Platform Context voor V2

Laatst opgesteld: 23 mei 2026  
Doel: startdocument voor een nieuw dedicated project rond businessbeslissingen en de bouw van Het Trade Platform V2.

## 1. Korte samenvatting

Het Trade Platform is een Nederlandstalig educatief tradingplatform van Cryptoriez. De huidige applicatie combineert een gratis instaptraject, video modules, praktijklessen, examens, voortgangstracking, community en mentorship.

De business beweegt duidelijk richting een funnel:

1. Gratis account zonder creditcard.
2. Directe toegang tot module 1 t/m 6.
3. Leren via gestructureerde video, praktijk en examens.
4. Upgrade naar volledige toegang via een eenmalige betaling.
5. Upsell of begeleiding via gratis call, mentorship, community en mogelijk partneraanbod zoals TradeZella.

De huidige V1 is functioneel genoeg om tractie te draaien, maar V2 moet vooral duidelijkheid brengen in positionering, access levels, aanbodstructuur, pricing, admin workflows, data betrouwbaarheid, security en productarchitectuur.

## 2. Wat zeker uit het huidige project blijkt

Deze samenvatting is gebaseerd op:

- `README.md`
- `TECHNICAL_README.md`
- `TECHNICAL_README_HETTRADEPLATFORM.md`
- `CHANGELOG.md`
- `MAIL_1.html` en `MAIL_2.html`
- landingspagina `src/app/page.tsx`
- upgradepagina `src/app/upgrade/page.tsx`
- dashboard, modules, lessen, examens, praktijklessen, mentorship, community, admin en billing routes
- Supabase/Stripe-gerelateerde code

Belangrijk: sommige technische documentatie is verouderd of loopt achter op de code. Zo vermeldt de technische readme Next.js 16/React 19 en deprecated auth helpers, terwijl `package.json` momenteel Next.js 14/React 18 en `@supabase/ssr` toont. Voor V2 is een frisse technische audit nodig.

## 3. Merk en positionering

Huidige merknamen:

- Publieke productnaam: Het Trade Platform.
- Business/brand achter het platform: Cryptoriez.
- Domein/e-mail in juridische pagina's: `info@hettradeplatform.be`.

Huidige positionering:

- Nederlandstalig educatief tradingtraject.
- Gericht op beginners en aspirant-traders die "vanaf nul" willen leren.
- Nadruk op structuur, voortgang, examens, praktijkvoorbeelden en begeleiding.
- Duidelijke disclaimer: educatie, geen financieel of beleggingsadvies.

Belangrijke boodschap op de landingspagina:

- "Leer traden vanaf nul. Gratis gestart."
- Module 1 t/m 6 gratis.
- Geen creditcard nodig.
- Gestructureerd traject met lessen, praktijkvoorbeelden en examens.
- Examen is een checkpoint, geen eindstation.

## 4. Doelgroep

De impliciete doelgroep:

- Beginnende traders die nog geen solide basis hebben.
- Mensen die losse YouTube-video's of losse tradingtips willen vervangen door een gestructureerd leerpad.
- Studenten die behoefte hebben aan accountability, community en persoonlijke begeleiding.
- Mensen die technisch willen leren traden, maar ook mindset, riskmanagement en discipline nodig hebben.

De huidige copy richt zich sterk op:

- Overweldiging verminderen.
- Stap voor stap leren.
- Niet zomaar signalen kopieren.
- Zelf leren denken als trader.
- Risico en discipline serieus nemen.

## 5. Waardepropositie

Kernwaarde:

Het platform geeft studenten een gestructureerd pad om trading te leren, met video, praktijk en examens, zodat ze niet blijven hangen in losse content maar steeds weten wat de volgende stap is.

Belangrijke value drivers:

- Gratis startmodules.
- Video course op eigen tempo.
- Examens met 75 procent slaaggrens.
- Module unlocks op basis van voortgang en examenresultaat.
- Praktijklessen per module.
- Mentorship en gratis call als vervolgstap.
- Community voor marktupdates, setups, analyses, accountability en reflectie.
- Course PDF voor full access gebruikers.
- Trading session tool in dashboard.
- Student testimonials en social proof.

## 6. Huidig aanbod

### Gratis account

Gratis gebruikers krijgen toegang tot module 1 t/m 6. In de code is dit centraal vastgelegd als:

- `FREE_MODULE_ORDER_LIMIT = 6`
- `FULL_ACCESS_LEVEL = 2`

Gratis belofte:

- Module 1 t/m 6 gratis.
- Lessen, praktijklessen en examens binnen die modules.
- Geen creditcard nodig.
- Upgrade later mogelijk.

### Full toegang

Full toegang is access level 2.

Wat full toegang volgens de upgradepagina ontgrendelt:

- Alle modules na de gratis startmodules.
- Volledige video course.
- Examens en praktijklessen.
- Cursusmateriaal en toekomstige platformupdates.
- Eenmalige betaling.
- Geen abonnement.

Prijs op de huidige upgradepagina:

- EUR 999 incl. btw.

### Mentorship

Mentorship bestaat als aparte sectie binnen het platform.

Huidige elementen:

- Mentorship pagina met video "Waarom mentorship?"
- Mentor cards voor Rousso en Jason.
- Calendly booking via `https://calendly.com/cryptoriez/30min`.
- Algemene gratis call link via `https://calendly.com/hettradeplatform/30min`.
- Copy positioneert mentorship als persoonlijke begeleiding om trading skills naar een hoger niveau te brengen.

Er is een business-inconsistentie:

- Upgradepagina zegt dat full course niet hetzelfde is als mentorship.
- Mailtemplates suggereren een tijdelijke aanbieding van EUR 997 in plaats van EUR 1800 inclusief persoonlijke mentorship.
- Terms zeggen dat toegangsniveau door mentor wordt bepaald.

Voor V2 moet dit aanbod scherp worden gescheiden of bewust gebundeld.

### Community

De oude updates feed is verwijderd. De route `/updates` is nu Community.

Community propositie:

- Discord CTA.
- Marktupdates en charts.
- Wekelijkse marktupdates.
- Live chart breakdowns.
- Scenario's en marktverwachtingen.
- Accountability en mindset.
- Q&A en begeleiding.
- Direct contact met andere serieuze traders.

De community is dus geen simpele updatepagina meer, maar een retentie- en engagementlaag rond het leerplatform.

### Partneraanbod

Op de mentorship pagina staat TradeZella als partner/affiliate aanbod:

- Positionering: edge in trade journaling.
- Gebruik in coaching op data in plaats van gevoel.
- Referral link: `https://refer.tradezella.com/cryptoriez`.
- Code: `Cryptoriez`.

Dit wijst op mogelijke extra revenue via affiliate of strategische partnerrelaties.

## 7. Huidige funnel

De huidige funnel lijkt als volgt:

1. Bezoeker komt op landingspagina.
2. Meta Pixel trackt PageView.
3. Landing zet in op gratis module 1 t/m 6.
4. Bezoeker registreert zonder creditcard.
5. Student komt in dashboard.
6. Student volgt lessen in volgorde.
7. Student maakt examens om verder te gaan.
8. Bij betaalde modules of upgrade-momenten wordt de upgradepagina gebruikt.
9. Stripe Checkout verwerkt eenmalige betaling.
10. Webhook verhoogt `students.access_level` naar 2.
11. Student krijgt full access.
12. Student wordt richting mentorship, community, course material en eventueel TradeZella geleid.

Conversiepunten:

- Register CTA op landingspagina.
- Module locks vanaf module 7.
- Upgrade CTA in dashboard/modules/lesson/exam flow.
- Gratis call CTA in dashboard/trading sessions/upgradepagina.
- Community Discord CTA.
- Mentorship booking CTA.

## 8. Pricing en aanbod-inconsistenties

Er zijn meerdere prijs- en aanbodsignalen in het project:

- Upgradepagina: EUR 999 incl. btw, eenmalige betaling, volledige zelfstandige course, geen mentorship.
- Mailtemplates: EUR 997 tijdelijke webinar-aanbieding, normale prijs EUR 1800, inclusief persoonlijke mentorship.
- Copy: "geen abonnement".
- Refund policy: restituties case-by-case binnen 14 dagen.

Voor V2 moeten minimaal deze keuzes worden gemaakt:

- Is het kernproduct een self-paced course, mentorshipprogramma, community membership, of combinatie?
- Is EUR 999 de standaardprijs?
- Is EUR 997 enkel een campagneprijs?
- Is EUR 1800 een oude normale prijs, toekomstige prijs of mentorshipprijs?
- Is mentorship inbegrepen, los verkocht of een premium tier?
- Blijft "eenmalige betaling" de kern, of komt er een abonnement/community-model?

## 9. Productstructuur

### Modules

De huidige landingspagina toont expliciet de eerste modules:

1. Introductie en basisbegrippen.
2. Wat is traden echt?
3. Mindset deel I.
4. Marktbewegingen en price action.
5. Technische analyse deel I.
6. Technische analyse deel II.
7. Supply en Demand deel I.

Daarnaast is er een preview van module 10:

- Supply & Demand deel 2.
- Thema's: market maker perspectief, stoplosses, liquiditeit, accumulatie, order flow, minder afhankelijkheid van lagging indicators.

De daadwerkelijke moduledata komt uit Supabase, dus het platform kan meer modules bevatten dan de landing hardcoded toont.

### Lessen

Lessen zijn video-based, meestal via Vimeo.

Lessen hebben:

- titel
- beschrijving
- Vimeo/video URL
- thumbnail
- module koppeling
- sortering

De lespagina:

- toont Vimeo player
- markeert les als watched wanneer video eindigt
- toont vorige/volgende navigatie
- toont exam CTA na laatste les indien relevant
- toont lock screens bij onvoldoende access

### Praktijklessen

Praktijklessen zijn gekoppeld aan modules.

Ze zijn bedoeld als extra praktijkcases of toepassingen bij de module. In de gratis propositie worden praktijklessen expliciet genoemd als onderdeel van module 1 t/m 6.

### Examens

Examens zijn modulegebonden.

Huidige logica:

- Examen pas beschikbaar na bekijken van alle lessen in een module.
- Slaaggrens: 75 procent.
- Examens bestaan uit vragen met opties en correct antwoord.
- Resultaten worden opgeslagen in `exam_results`.
- Geslaagd examen unlockt de volgende module.
- Studenten kunnen vermoedelijk herkansen.

De examenflow is productmatig belangrijk: het platform verkoopt geen losse contentbibliotheek, maar een guided learning path.

### Course material

Er is een protected course material pagina voor een cursus-PDF:

- Bucket: `course-materials`.
- Bestand: `cursus.pdf`.
- Toegang vereist access level 2.
- Signed URL via Supabase Storage.

## 10. Access levels

De huidige access levels:

- Level 1: Basic/gratis.
- Level 2: Full/betaald.
- Level 3: Admin in de admin UI, maar technische documentatie noemt dit soms Mentor.

Belangrijke observatie:

Level 3 is functioneel admin in de huidige code. Het is dus risicovol om dit tegelijk als "Mentor" te beschouwen. V2 heeft aparte rollen nodig:

- student/free
- student/full
- mentor
- admin
- mogelijk support/content manager

Access logic in V1:

- Middleware beschermt vooral auth routes.
- Veel access checks gebeuren client-side.
- Sommige API routes doen server-side admin checks.
- Billing webhook zet paid studenten naar level 2.
- Admin kan access levels handmatig wijzigen.

## 11. Admin en operations

Er is een admin studentenoverzicht voor level 3 gebruikers.

Admin kan zien:

- totaal aantal studenten
- nieuwe studenten laatste 7 dagen
- aantallen per level
- paid students
- studenten zonder telefoonnummer
- naam, e-mail, telefoon, auth-status, laatste login
- voortgang: bekeken lessen, totaal lessen, percentage
- examens: attempts, passed, beste score, laatste examen
- betaling: status, bedrag, valuta, betaaldatum
- laatste activiteit

Admin kan:

- studenten zoeken/filteren/sorteren
- access level aanpassen
- contactgegevens kopieren
- e-mail/WhatsApp openen

Er is ook een admin content editor voor:

- modules
- lessen
- praktijklessen

Deze editor ondersteunt vooral titel en beschrijving aanpassen. Video's, examens, pricing, funnels en marketingcontent lijken nog niet volledig beheersbaar via admin.

## 12. Technische architectuur V1

Stack volgens huidige `package.json`:

- Next.js 14 App Router.
- React 18.
- TypeScript.
- Tailwind CSS v4.
- Supabase SSR en Supabase JS.
- Stripe.
- Vimeo Player.
- Framer Motion/Motion.
- Lucide icons.
- Radix UI.

Backend:

- Supabase Auth.
- Supabase Postgres.
- Supabase Storage.
- Next.js API routes.
- Stripe Checkout en webhook.

Belangrijke tabellen:

- `students`
- `modules`
- `lessons`
- `progress`
- `exams`
- `exam_questions`
- `exam_results`
- `practical_lessons`
- `payments`

Belangrijke buckets:

- `HTP` of vergelijkbaar voor brand assets.
- `lesson-thumbnails`.
- `mentor-photos`.
- `course-materials`.
- oude `update-images` bucket is niet meer nodig.

## 13. Betalingen

Betaalflow:

- Authenticated student klikt upgrade.
- `/api/billing/checkout` controleert user en student.
- Alleen `access_level === 1` mag checkout starten.
- Stripe Checkout session wordt gemaakt met `STRIPE_PRICE_ID`.
- `client_reference_id` is `student.id`.
- Succes URL: `/paymentconfirmed`.
- Cancel URL: `/billing/cancel`.
- Stripe webhook luistert op `checkout.session.completed`.
- Webhook schrijft betaling naar `payments`.
- Webhook zet `students.access_level` naar 2.

Businessimplicatie:

De huidige betaalflow ondersteunt vooral een eenvoudige eenmalige upgrade van gratis naar full. Voor V2 moet worden bepaald of dit genoeg is of dat er meerdere producten/prijzen nodig zijn.

## 14. Marketing en social proof

Huidige marketingelementen:

- Meta Pixel op landingspagina.
- Gratis module 1 t/m 6 als lead magnet.
- Claims/social proof op landing:
  - 4600+ abonnees.
  - 400+ video's.
  - 6 gratis modules.
- Student testimonial videos:
  - Mark
  - Jens
  - Laurens
  - Domi
  - Dean
- Module 10 preview als proof of depth.
- "Geen losse video's. Een pad dat je vooruit duwt."

Voor V2 is dit waardevol:

- Testimonials kunnen sterker gekoppeld worden aan specifieke outcomes.
- Funnel kan beter meetbaar worden gemaakt.
- Gratis modules kunnen als product-led acquisition worden gezien.
- Webinar/urgency pricing uit mailtemplates kan worden ingebouwd als campaign layer.

## 15. Juridisch, compliance en vertrouwen

Huidige juridische pagina's:

- Privacy Policy.
- Terms of Service.
- Refund & Cancellation Policy.
- Cookies pagina.
- Account removal policy.

Belangrijke disclaimers:

- Educatieve content.
- Geen financieel of beleggingsadvies.
- Traden brengt risico's met zich mee.
- Resultaten zijn nooit gegarandeerd.
- Geen garantie op toekomstige resultaten.

Refund policy:

- Case-by-case.
- Verzoek binnen 14 dagen na aankoop.
- Mogelijke redenen: technische problemen, onjuiste informatie, andere support-beslissingen.
- Verwerking binnen 5-10 werkdagen na goedkeuring.

V2 aandachtspunt:

Trading education is gevoelig. De juridische teksten moeten professioneel worden aangescherpt, vooral als de business mentorship, community, marktupdates, scenario's of concrete setups aanbiedt.

## 16. Huidige sterke punten

- Heldere gratis instap zonder creditcard.
- Guided progression met module gates en examens.
- Bestaande betaalflow met Stripe.
- Bestaande admin voor studenten en access management.
- Bestaande contentstructuur in Supabase.
- Social proof en testimonials aanwezig.
- Community richting Discord aanwezig.
- Mentorship/Calendly flow aanwezig.
- Course material en praktijklessen aanwezig.
- Duidelijke educatieve disclaimer.

## 17. Huidige zwakke plekken en risico's

### Business

- Onduidelijke scheiding tussen course, mentorship, community en volledige toegang.
- Prijsinconsistentie tussen upgradepagina en mailtemplates.
- Level 3 is onduidelijk: mentor of admin?
- Gratis modules 1 t/m 6 zijn royaal; impact op conversie moet gemeten worden.
- Community is buitenplatform via Discord, dus retentie- en data-inzicht zitten deels extern.
- Geen zichtbaar subscription/recurring model, ondanks communitywaarde.

### Product

- Veel unlock/access logica zit verspreid.
- Moduleprogressie is sterk afhankelijk van watched status en examens.
- Geen duidelijke certificering of einddoel zichtbaar.
- Course material is beperkt tot een PDF.
- Geen ingebouwde feedback, opdrachten, trading journal of portfolio van studentwerk.
- Praktijklessen lijken relatief simpel gemodelleerd.

### Tech

- Documentatie en code zijn niet volledig gelijk.
- Veel client-side access checks.
- Student sync is complex en historisch gegroeid.
- LocalStorage speelt nog een rol in student state.
- Geen tests zichtbaar.
- Geen generated Supabase types zichtbaar.
- Geen duidelijke analytics events buiten Meta PageView.
- Geen feature flags/campaign config voor aanbiedingen.

## 18. Strategische V2-richting

V2 zou niet alleen een technische rebuild moeten zijn, maar een product- en businessherpositionering.

Aanbevolen V2-principes:

1. Definieer de productladder.
   - Free starter.
   - Full self-paced course.
   - Community membership.
   - Mentorship/coaching.
   - Eventueel pro tools/partners.

2. Maak access en rollen expliciet.
   - Product access is iets anders dan interne rollen.
   - Rollen: student, mentor, admin, content manager.
   - Entitlements: free modules, full course, mentorship, community, material, admin.

3. Bouw pricing en campagnes configureerbaar.
   - Standaardprijs.
   - Webinarprijs.
   - Tijdelijke aanbieding.
   - Bundels.
   - Coupon/discount via Stripe of eigen campaign table.

4. Versterk de leerervaring.
   - Module progress.
   - Exam mastery.
   - Praktijkopdrachten.
   - Trading journal integratie of eigen journaling.
   - Feedbackmomenten.
   - Certificaat of milestone.

5. Versterk data en decision making.
   - Funnel events.
   - Activation metrics.
   - Lesson completion.
   - Exam pass rates.
   - Drop-off per module.
   - Upgrade conversion.
   - Community click-through.
   - Mentorship booking conversion.

6. Maak admin echt operationeel.
   - Student CRM.
   - Payments en refunds.
   - Content management.
   - Exam management.
   - Campaign management.
   - Mentorship/session management.
   - Notes/tags per student.

## 19. Belangrijke businessbeslissingen voor V2

### Aanbod

- Wat is het hoofdproduct: course, mentorship, community of platform?
- Is full access een eenmalige aankoop of hoort er recurring communitywaarde bij?
- Is mentorship inbegrepen bij full access of een premium upsell?
- Blijft Discord extern, of krijgt V2 een interne communitylaag?

### Pricing

- Wordt EUR 999 de standaardprijs?
- Wat betekent EUR 997 uit de mailtemplates?
- Wat betekent EUR 1800?
- Komt er een betaalplan?
- Komt er een abonnement voor community/marktupdates?
- Welke refund policy hoort bij digitale content en mentorship?

### Gratis strategie

- Blijven module 1 t/m 6 gratis?
- Is dat genoeg spanning richting conversie?
- Moet de gratis laag eindigen met een sterker upgrade-moment?
- Welke content is preview vs echt unlocked?

### Mentorship

- Wie zijn mentors in het systeem?
- Moeten mentors eigen availability, studenten, notities en sessies beheren?
- Is Calendly genoeg of moet booking native worden?
- Hoe meet je call bookings en show-up/conversion?

### Community

- Is Discord gratis of alleen voor bepaalde levels?
- Worden marktupdates educatief genoeg gepositioneerd?
- Hoe voorkom je dat setups als signalen worden geinterpreteerd?
- Welke community-data wil je terug in het platform?

## 20. Productkansen voor V2

Hoogste impact:

- Entitlements systeem in plaats van enkel `access_level`.
- Sterke onboarding na registratie.
- Upgrade moments rond module 6 en module locks.
- Analytics dashboard voor businessbeslissingen.
- Campaign/pricing manager.
- Exam en content management in admin.
- Student CRM met tags, notes, status en call history.
- Trading journal of TradeZella-integratie.
- Praktijkopdrachten met upload/feedback.
- Mentor portal.
- Betere legal/compliance guardrails rond marktupdates en scenario's.

## 21. Mogelijke V2 informatiearchitectuur

Publiek:

- Landing.
- Curriculum.
- Testimonials.
- Pricing.
- Mentorship.
- Login/register.
- Legal.

Student:

- Dashboard.
- Mijn leerpad.
- Module detail.
- Lesson player.
- Praktijk.
- Exams.
- Course material.
- Community.
- Mentorship/calls.
- Account/billing.

Mentor:

- Mijn studenten.
- Student detail.
- Notes.
- Progress/exams.
- Sessions/calls.
- Feedback op opdrachten.

Admin:

- Students CRM.
- Content CMS.
- Exam builder.
- Payments.
- Campaigns/pricing.
- Analytics.
- Roles/permissions.
- Settings/integrations.

## 22. Aanbevolen datamodel voor V2

Naast bestaande tabellen:

- `profiles`
- `roles`
- `products`
- `prices`
- `entitlements`
- `student_entitlements`
- `campaigns`
- `coupons`
- `orders`
- `subscriptions` indien recurring
- `modules`
- `lessons`
- `lesson_assets`
- `practical_assignments`
- `assignment_submissions`
- `exams`
- `exam_questions`
- `exam_attempts`
- `community_links`
- `mentor_profiles`
- `mentor_sessions`
- `student_notes`
- `events`
- `audit_logs`

Belangrijk concept:

Gebruik access levels niet meer als alles-in-een oplossing. Maak onderscheid tussen:

- identiteit
- rol
- aankoop/product
- entitlement
- voortgang
- adminrechten

## 23. Aanbevolen metrics voor businessbeslissingen

Acquisitie:

- Landing visitors.
- Register CTA clicks.
- Registration conversion.
- Source/campaign.

Activatie:

- Eerste login.
- Eerste les gestart.
- Eerste les voltooid.
- Module 1 voltooid.
- Eerste examen gestart.
- Eerste examen geslaagd.

Engagement:

- Lessons watched per week.
- Active students per week.
- Drop-off per module.
- Exam pass/fail per module.
- Praktijklessen geopend/afgerond.

Conversie:

- Upgrade page views.
- Checkout starts.
- Checkout completed.
- Free-to-paid conversion.
- Time to upgrade.
- Module 6 completion to upgrade rate.

Expansion:

- Gratis call clicks.
- Calendly bookings.
- Mentorship conversion.
- Discord joins.
- TradeZella clicks/conversions.

Retention:

- Login frequency.
- Community usage.
- Course completion.
- Re-engagement after inactivity.

## 24. Concrete V2 bouwprioriteiten

Fase 1: foundation

- Nieuwe auth en profile architectuur.
- Rollen en entitlements.
- Supabase types en RLS design.
- Stripe product/pricing model.
- Analytics events.
- Clean dashboard shell.

Fase 2: learning core

- Modules/lessons/progress.
- Praktijklessen/opdrachten.
- Exam engine.
- Module gating.
- Course material.

Fase 3: business ops

- Admin CRM.
- Content CMS.
- Exam builder.
- Payment overview.
- Campaign/pricing config.
- Student notes.

Fase 4: growth en mentorship

- Mentorship portal.
- Booking/call tracking.
- Community integration.
- Testimonials/results.
- Referral/partner tracking.

## 25. Open vragen

1. Is V2 bedoeld als rebuild van het bestaande platform of als nieuw product naast V1?
2. Moet V2 starten vanuit dezelfde Supabase database of een schoon schema?
3. Wat is de definitieve productladder?
4. Welke prijs is leidend: EUR 999, EUR 997 of EUR 1800?
5. Is mentorship inbegrepen, optioneel of premium?
6. Blijven de eerste 6 modules gratis?
7. Moet Discord gratis toegankelijk zijn of onderdeel van paid/community?
8. Welke business metrics zijn nu het belangrijkst: conversie, retentie, completion, calls of revenue?
9. Moet V2 multi-tenant of enkel voor Het Trade Platform?
10. Moeten mentors echte accounts krijgen met eigen rechten en workflows?

## 26. Kernconclusie

Het Trade Platform V1 bewijst de richting: een gestructureerd trading education platform met gratis instap, examens, progression gates, betaalde upgrade, community en mentorship. De grootste V2-kans zit niet in "meer pagina's", maar in scherpere businesslogica: duidelijke producten, duidelijke rechten, meetbare funnel, betere admin, sterkere learning loop en een architectuur die groei, campagnes en mentorship aankan.

Als V2 goed wordt opgezet, kan Het Trade Platform evolueren van een video course met login naar een volwaardig trading education operating system: leren, oefenen, meten, begeleiden, converteren en behouden.
