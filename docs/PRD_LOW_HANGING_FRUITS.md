# PRD - Low Hanging Fruits voor Het Trade Platform 2.0

Laatst bijgewerkt: 7 juni 2026  
Status: voorstel voor directe productprioriteiten  
Doel: snel meer waarde leveren voor student en mentor, zonder het platform onnodig complex te maken.

## Implementatiestatus

Release 1 is gebouwd op 7 juni 2026:

- dashboard "Vandaag";
- onboarding questionnaire met skip-mogelijkheid;
- mentor notes op studentdetail;
- student mentor status en tags;
- studententabel met triage-informatie;
- database migration: `20260607000000_prd_release1_mentor_foundation.sql`.

Volgende aanbevolen release: assignment submissions en admin review queue.

## 1. Productvisie

Het Trade Platform moet evolueren van een course dashboard naar een trading development system.

De waarde zit niet alleen in video lessen, maar in de combinatie van:

- gestructureerd leren;
- toepassen via opdrachten;
- bewijs van oefening;
- mentorfeedback;
- accountability;
- inzicht in voortgang en gedrag.

De centrale productvraag:

> Helpt deze feature de student sneller aantoonbaar beter worden, en helpt ze de mentor efficienter begeleiden?

Als het antwoord nee is, hoort de feature voorlopig niet in de eerste roadmap.

## 2. Probleem

De huidige basis is sterk: modules, lessen, examens, voortgang, lesson actions, video en admin studentprogressie bestaan al. Toch voelt de ervaring nog vooral als een leeromgeving waar studenten content consumeren.

Voor een high-ticket trading education product is dat niet genoeg. Studenten kopen uiteindelijk geen videos; ze kopen richting, accountability, confidence en toegang tot betere feedback.

Belangrijkste gaps:

- opdrachten zijn nog te vrijblijvend;
- mentor-student interactie zit nog niet centraal in het product;
- admin geeft progressie, maar nog geen echte mentor cockpit;
- dashboard stuurt studenten nog niet genoeg naar de ene beste actie van vandaag;
- weinig bewijs dat studenten trading concepten toepassen;
- weinig data om inactieve of risicovolle studenten tijdig te detecteren;
- community, calls en feedbackloops zitten nog niet zichtbaar genoeg in de platformervaring.

## 3. Doelstellingen

### Businessdoelen

- Hogere activatie na registratie.
- Meer les- en modulecompletion.
- Meer conversie van gratis student naar full access of mentorship.
- Hogere perceived value van mentorship.
- Minder handmatig werk voor mentors.
- Fundament leggen voor white-label coach platforms.

### Studentdoelen

- Altijd weten wat de volgende stap is.
- Actief oefenen in plaats van passief kijken.
- Feedback krijgen op echte trading-output.
- Zien waar ze staan en waar ze nog zwak zijn.
- Sneller een eigen trading playbook opbouwen.

### Mentordoelen

- In een oogopslag zien wie aandacht nodig heeft.
- Per student context hebben zonder alles te moeten navragen.
- Feedback geven op opdrachten, trades en reflecties.
- Studenten segmenteren op status, gedrag en risico.
- Calls beter voorbereiden.

## 4. Scope

### In scope voor deze PRD

- Dashboardverbeteringen.
- Assignment submissions.
- Mentor notes.
- Student tags/statussen.
- Onboarding questionnaire.
- Exam feedbackverbetering.
- Basisnudges.
- Eerste versie mentor cockpit.

### Niet in scope voor directe uitvoering

- Volledige community/feed bouwen.
- Volledige TradeZella-achtige journal met broker imports.
- Mobiele native app.
- White-label multi-tenant architectuur.
- Complexe AI-coaching.
- Live video/call hosting.
- Volledige gamification engine.

Die onderdelen blijven belangrijk, maar zijn geen low hanging fruit.

## 5. Prioriteiten

## P0 - Direct Aanpakken

P0 features hebben hoge waarde, lage tot middelmatige complexiteit en sluiten aan op bestaande data en UI.

### 5.1 Dashboard: "Vandaag"

#### Probleem

Het dashboard toont een volgende stap, maar mag nog scherper aanvoelen als dagelijkse coaching.

#### Oplossing

Voeg een primair blok toe: "Vandaag".

Dit blok toont exact een tot drie acties:

- bekijk huidige les;
- rond open lesson action af;
- maak moduletoets;
- upload opdrachtbewijs;
- boek een call;
- hervat na inactiviteit.

#### Functionele eisen

- Toon maximaal drie acties.
- Eén actie is visueel primair.
- Acties zijn gebaseerd op bestaande progressie, exam state en action progress.
- Als alles afgerond is, toon "Bekijk je traject" of "Boek een evaluatiecall".
- Copy moet menselijk en trading-specifiek zijn.

#### Acceptatiecriteria

- Student ziet binnen 3 seconden wat hij vandaag moet doen.
- CTA leidt direct naar de juiste les, toets of actie.
- Geen extra handmatige adminconfiguratie nodig voor V1.

#### Technische impact

- Uitbreiden van `getDashboardOverview`.
- UI aanpassen in `app/(protected)/dashboard/page.tsx`.
- Hergebruik bestaande lesson action progress.

---

### 5.2 Assignment Submissions bij Lesson Actions

#### Probleem

Lesson actions zijn nu checklist-items. Dat stimuleert afronden, maar niet noodzakelijk toepassen.

#### Oplossing

Maak van geselecteerde lesson actions echte opdrachten waarop de student bewijs kan indienen.

V1 ondersteunt:

- tekstreflectie;
- screenshot/chart upload;
- status: `draft`, `submitted`, `reviewed`;
- mentorfeedback tekst;
- reviewed timestamp.

#### Functionele eisen

- Student kan per opdracht een antwoord schrijven.
- Student kan optioneel een afbeelding uploaden.
- Student kan opdracht indienen.
- Mentor/admin kan opdracht bekijken en feedback geven.
- Student ziet feedback terug bij de les.
- Checklist-progressie blijft bestaan, maar submission maakt de opdracht waardevoller.

#### Acceptatiecriteria

- Student kan binnen een les een opdracht indienen.
- Admin kan per student zien welke opdrachten wachten op review.
- Feedback verschijnt zichtbaar bij de opdracht.
- Bestaande lesson action checklist blijft werken.

#### Technische impact

- Nieuwe tabel: `lesson_action_submissions`.
- Nieuwe admin view of uitbreiding studentdetail.
- Nieuwe server actions voor submit en review.
- Mogelijk Supabase storage bucket voor assignment screenshots.

---

### 5.3 Mentor Notes

#### Probleem

Mentors missen een plek om context per student vast te leggen.

#### Oplossing

Voeg privé mentor notes toe op de studentdetailpagina.

#### Functionele eisen

- Admin kan notitie toevoegen.
- Admin kan notitie markeren als belangrijk.
- Admin ziet notities chronologisch.
- Notities zijn niet zichtbaar voor studenten.
- Notities tonen auteur en datum.

#### Acceptatiecriteria

- Mentor kan binnen 30 seconden na een call een duidelijke note toevoegen.
- Notes blijven gekoppeld aan student.
- Notes verschijnen in studentdetail zonder extra navigatie.

#### Technische impact

- Nieuwe tabel: `student_mentor_notes`.
- Server actions voor create/update/delete of minimaal create.
- UI in `app/admin/students/[id]/page.tsx`.

---

### 5.4 Student Tags en Statussen

#### Probleem

Admin kan studenten zien, maar nog niet goed prioriteren.

#### Oplossing

Voeg student tags/statussen toe voor mentortriage.

Voorbeelden:

- `Needs attention`;
- `Inactive`;
- `Ready for call`;
- `High potential`;
- `Risk management`;
- `Mindset`;
- `Technical analysis`;
- `Full access lead`;
- `Mentorship lead`.

#### Functionele eisen

- Admin kan tags toevoegen/verwijderen.
- Tags zijn zichtbaar in studententabel en studentdetail.
- Er komt minimaal één handmatige status: `active`, `watch`, `needs_attention`.

#### Acceptatiecriteria

- Mentor kan studentlijst filteren op aandacht nodig.
- Studentdetail toont tags bovenaan.
- Tags zijn admin-only.

#### Technische impact

- Simpele V1-optie: `students.mentor_status` en `students.tags text[]`.
- Betere schaaloptie: aparte `student_tags` tabel.
- UI in `StudentsTable` en studentdetail.

---

### 5.5 Onboarding Questionnaire

#### Probleem

Studenten komen binnen zonder context. Daardoor voelt het platform minder persoonlijk en mist de mentor waardevolle informatie.

#### Oplossing

Na eerste login krijgt de student een korte onboarding.

Vragen:

- ervaring met trading;
- primaire markt/interesse;
- grootste uitdaging;
- doel voor de komende 90 dagen;
- hoeveel tijd per week;
- voorkeur voor begeleiding;
- al een TradingView/TradeZella/Discord account?

#### Functionele eisen

- Onboarding verschijnt alleen als profiel nog niet compleet is.
- Antwoorden zijn zichtbaar in studentdetail.
- Student kan antwoorden later aanpassen in profiel.
- Dashboardcopy kan op termijn op antwoorden reageren.

#### Acceptatiecriteria

- Nieuwe student vult onboarding in voor hij naar dashboard gaat, of kan eenmaal overslaan.
- Admin ziet onboardingcontext bij student.
- Geen blocking flow voor bestaande studenten zonder migratieproblemen.

#### Technische impact

- Nieuwe tabel `student_onboarding_responses` of JSON kolom op `students`.
- Nieuwe route of component in protected layout.
- Profielpagina uitbreiden.

---

## P1 - Na P0, Nog Steeds Hoog Rendement

### 5.6 Exam Feedback per Thema

#### Probleem

Een score zegt weinig over waar de student inhoudelijk zwak is.

#### Oplossing

Label exam questions met een thema en toon na afloop themafeedback.

Voorbeelden:

- risk management;
- market structure;
- entries;
- psychology;
- technical analysis;
- execution rules.

#### Functionele eisen

- Exam question heeft optioneel `topic`.
- Resultaatscherm toont zwakke thema's.
- Student krijgt links naar relevante lessen.
- Admin ziet per student waar exam failures vandaan komen.

#### Acceptatiecriteria

- Student weet na een mislukte toets wat hij moet herhalen.
- Mentor kan examdata gebruiken voor callvoorbereiding.

#### Technische impact

- Kolom `exam_questions.topic`.
- Scoring uitbreiden in `submitExam`.
- Result UI uitbreiden in `ExamForm`.
- Admin exam overview uitbreiden.

---

### 5.7 Mentor Cockpit V1

#### Probleem

Studentdetail is nuttig, maar mentor mist nog een compacte dagelijkse werkview.

#### Oplossing

Maak een adminpagina "Mentor Cockpit" met de studenten die aandacht nodig hebben.

#### Functionele eisen

Toon per student:

- naam en email;
- mentor status/tags;
- laatste activiteit;
- huidige module;
- open submissions;
- laatste exam result;
- laatste mentor note;
- snelle acties: view, add note, mark status.

#### Acceptatiecriteria

- Mentor kan dagelijks deze pagina openen en weet wie prioriteit heeft.
- Open submissions staan bovenaan.
- Inactieve studenten zijn zichtbaar.

#### Technische impact

- Nieuwe route: `/admin/mentor`.
- Query combineren uit students, progress, exams, submissions, notes.
- Mogelijk materialized helperfunctie later, maar V1 kan server-side query zijn.

---

### 5.8 Basisnudges

#### Probleem

Studenten vallen stil zonder dat platform of mentor dat tijdig opvangt.

#### Oplossing

Maak eenvoudige nudges in-app. Email kan later.

Nudges:

- student is 5+ dagen inactief;
- toets staat klaar;
- opdracht wacht op feedback;
- feedback ontvangen;
- volgende module vrijgespeeld.

#### Functionele eisen

- Dashboard toont relevante nudges.
- Admin ziet inactivity status.
- Geen spammy gamification.

#### Acceptatiecriteria

- Student ziet waarom hij terug moet komen.
- Mentor ziet wie dreigt af te haken.

#### Technische impact

- In eerste versie afleidbaar uit bestaande data.
- Later eventueel `notifications` tabel.

---

## P2 - Strategisch, Maar Niet Meteen

### 5.9 Trading Journal V1

Een lichte journal zonder broker-imports:

- datum;
- markt/symbol;
- setup;
- screenshot;
- risk;
- resultaat;
- emotie;
- regel gevolgd;
- reflectie;
- gekoppelde les of playbook.

Waarom later: veel waarde, maar groter datamodel en UX-vraagstuk.

### 5.10 Playbook Builder

Student bouwt eigen approved setups:

- setupregels;
- voorbeelden;
- fouten;
- checklist;
- mentor approved status.

Waarom later: extreem waardevol, maar beter bouwen nadat assignments en mentorfeedback bestaan.

### 5.11 Calendar en Calls

Platform toont calls, replays, RSVP en call prep.

Waarom later: kan eerst via Calendly/Discord extern blijven, zolang dashboard naar de juiste actie linkt.

### 5.12 Community Integratie

Eerst Discord zichtbaar koppelen aan lessen/modules. Later native feed of community.

Waarom later: native community is groot en kan afleiden van de mentor-feedback core.

## 6. Eerste Releasevoorstel

### Release 1 - Mentor Relationship Foundation

Doel: binnen korte tijd meer persoonlijke begeleiding voelen.

In scope:

- dashboard "Vandaag";
- onboarding questionnaire;
- mentor notes;
- student tags/status;
- eerste admin filters.

Succesmetric:

- meer studenten klikken op primaire dashboard CTA;
- mentor kan studenten segmenteren;
- onboardingdata beschikbaar voor minstens 80% van nieuwe studenten.

### Release 2 - Proof of Work

Doel: studenten gaan zichtbaar toepassen.

In scope:

- assignment submissions;
- screenshot upload;
- admin review;
- feedback terug naar student;
- open submissions in admin.

Succesmetric:

- percentage studenten met minimaal 1 ingediende opdracht;
- gemiddelde reviewtijd;
- aantal feedbackmomenten per actieve student.

### Release 3 - Mentor Cockpit

Doel: mentor werkt vanuit een dagelijkse triagepagina.

In scope:

- mentor cockpit;
- inactivity signals;
- open submissions queue;
- latest notes;
- snelle statusupdates.

Succesmetric:

- minder tijd nodig om call voor te bereiden;
- sneller opvolgen van inactieve studenten;
- hogere completion van actieve studenten.

## 7. Datamodel Voorstel

### `student_mentor_notes`

- `id uuid primary key`
- `student_id uuid references students(id)`
- `author_student_id uuid references students(id)`
- `body text not null`
- `is_pinned boolean default false`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `student_onboarding_responses`

- `id uuid primary key`
- `student_id uuid unique references students(id)`
- `experience_level text`
- `primary_market text`
- `main_challenge text`
- `goal_90_days text`
- `weekly_time_commitment text`
- `mentorship_interest text`
- `tools jsonb default '{}'`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

### `lesson_action_submissions`

- `id uuid primary key`
- `student_id uuid references students(id)`
- `lesson_id bigint references lessons(id)`
- `action_index int not null`
- `response text`
- `attachment_url text`
- `status text check (status in ('draft', 'submitted', 'reviewed'))`
- `mentor_feedback text`
- `reviewed_by uuid references students(id)`
- `submitted_at timestamptz`
- `reviewed_at timestamptz`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- unique `(student_id, lesson_id, action_index)`

### Kleine uitbreiding op `students`

- `mentor_status text default 'active'`
- `tags text[] default '{}'`

## 8. UX Richting

### Student dashboard

Moet voelen als:

- "dit is mijn trading desk";
- "ik weet wat ik vandaag moet doen";
- "mijn mentor ziet mijn werk";
- "ik bouw aan iets concreets".

Niet als:

- generiek analytics dashboard;
- statische cursusfolder;
- te veel kaarten met abstracte copy.

### Admin

Moet voelen als:

- CRM voor begeleiding;
- snelle triage;
- minder zoeken, meer coachen.

Niet als:

- database viewer;
- enkel contentbeheer;
- losse progressiepagina zonder context.

## 9. Metrics

### Activatie

- percentage nieuwe studenten dat onboarding voltooit;
- percentage nieuwe studenten dat eerste les start;
- percentage studenten dat binnen 7 dagen eerste opdracht indient.

### Engagement

- weekly active students;
- lesson completion rate;
- assignment submission rate;
- feedback received rate;
- exam pass/retake ratio.

### Mentorship

- open submissions;
- gemiddelde reviewtijd;
- studenten met `needs_attention`;
- inactieve studenten per week;
- notes per active mentorship student.

### Conversie

- gratis naar full access;
- full access naar mentorship call;
- call booked na dashboard CTA;
- module 6 completion naar upgrade intent.

## 10. Open Productvragen

- Moeten alle lesson actions submitbaar zijn, of alleen acties die admin markeert als opdracht?
- Mag een student verder zonder reviewed assignment, of is mentor approval soms gating?
- Is mentorship een aparte access level of een tag/status bovenop full access?
- Willen we screenshots in Supabase Storage houden of extern via links toestaan?
- Moet onboarding verplicht zijn of optioneel met herinnering?
- Welke coach-data moet later white-label per coach gescheiden worden?

## 11. Aanbevolen Beslissing

Start niet met community of AI. Start met bewijs en begeleiding.

De beste eerste bouwvolgorde:

1. Dashboard "Vandaag".
2. Onboarding questionnaire.
3. Mentor notes.
4. Student tags/status.
5. Assignment submissions.
6. Admin review queue.
7. Mentor cockpit.

Deze route maakt het platform direct waardevoller, zonder het product te zwaar te maken. Het legt ook de juiste fundering voor latere producten voor andere coaches: elke coach heeft content nodig, maar vooral context, accountability en feedbackloops.
