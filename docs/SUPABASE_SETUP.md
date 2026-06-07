# Supabase instellen voor registratie en login

De app gebruikt Supabase Auth met e-mailadres en wachtwoord. Nieuwe studenten
registreren zichzelf, bevestigen hun e-mailadres en kunnen daarna opnieuw inloggen.
De app maakt na de eerste geldige sessie automatisch de bijbehorende rij in
`public.students` aan.

## 1. API-gegevens in `.env`

1. Ga naar [Supabase Dashboard](https://supabase.com/dashboard) en open het project.
2. Open **Project Settings** -> **API Keys**.
3. Zet de publieke client-key en de Project URL in `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://jouw-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=jouw_publishable_of_legacy_anon_key
```

Gebruik voor `NEXT_PUBLIC_SUPABASE_ANON_KEY` bij voorkeur de **Publishable key**
(`sb_publishable_...`). Een bestaande legacy **anon public** JWT blijft ook werken.
Gebruik nooit een **Secret key**, legacy **service_role** key of databasewachtwoord
in een `NEXT_PUBLIC_` variabele.

Herstart na een wijziging de devserver:

```bash
npm run dev
```

## 2. E-mail en wachtwoord activeren

1. Ga naar **Authentication** -> **Providers** -> **Email**.
2. Zet **Enable Email provider** aan.
3. Zet **Allow new users to sign up** aan.
4. Laat **Confirm email** aanstaan. Dan krijgt een nieuwe student pas toegang na
   het aanklikken van de bevestigingsmail.
5. Sla de wijzigingen op.

De loginpagina gebruikt minimaal 8 tekens voor een wachtwoord. Je kunt in
**Authentication** -> **Password Security** strengere regels instellen als dat
past bij je beleid.

## 3. URL Configuration invullen

Ga naar **Authentication** -> **URL Configuration**.

Voor lokaal ontwikkelen:

| Instelling | Waarde |
| --- | --- |
| **Site URL** | `http://localhost:3000` |
| **Redirect URLs** | `http://localhost:3000/auth/callback**` |

Voeg bij een productieomgeving ook toe:

```text
https://jouw-domein.nl/auth/callback**
```

Zet de **Site URL** in productie op je echte domein. De callback verwerkt zowel
de bevestigingsmail na registratie als de link voor wachtwoordherstel.

## 4. Database-migraties toepassen

De app gebruikt RLS. Een ingelogde gebruiker mag uitsluitend zijn eigen
`students`-profiel aanmaken en bekijken. De benodigde policy staat in:

```text
supabase/migrations/20260319000000_students_insert_policy.sql
```

Pas alle lokale migraties toe op het gekoppelde Supabase-project:

```bash
supabase db push
```

Gebruik je de CLI niet, voer de nog ontbrekende migraties dan in volgorde uit via
**SQL Editor** in het Dashboard.

## 5. E-mailbezorging voor productie

Voor een eerste lokale test kun je de ingebouwde Supabase-mailservice gebruiken
met e-mailadressen van leden van je Supabase-projectteam. Andere adressen worden
zonder eigen SMTP-provider geweigerd. De ingebouwde service is beperkt en niet
bedoeld voor productie. Stel voor live gebruik via
**Project Settings** -> **Authentication** -> **SMTP Settings** een eigen SMTP-provider
in en controleer de afzendernaam en het afzenderadres.

De ingebouwde service verstuurt maximaal 2 auth-mails per uur, gezamenlijk voor
registratie en wachtwoordherstel. Daarnaast geldt standaard een wachttijd van
60 seconden voordat dezelfde gebruiker opnieuw een registratie- of resetmail kan
aanvragen. Bij overschrijding antwoordt Supabase met `429 Too Many Requests`.

Met een eigen SMTP-provider kun je het projectbrede e-maillimiet daarna aanpassen
via **Authentication** -> **Rate Limits**. Laat de wachttijd per gebruiker staan
tenzij er een goede reden is om deze te verlagen.

## 6. Controleren

1. Open `http://localhost:3000`.
2. Kies **Registreren**, vul naam, e-mailadres en wachtwoord in.
3. Klik op de link in de bevestigingsmail.
4. Controleer dat je op `/dashboard` belandt.
5. Log uit en log opnieuw in met hetzelfde e-mailadres en wachtwoord.
6. Test **Wachtwoord vergeten?** en kies via de resetmail een nieuw wachtwoord.

Als registratie wel lukt maar de callback niet, controleer dan eerst
**Authentication** -> **URL Configuration**. Als de app geen profiel kan aanmaken,
controleer dan of de migratie met `students_insert_own` is toegepast.

Krijg je `429 Too Many Requests` bij registratie of wachtwoordherstel, wacht dan
tot het limiet is hersteld of configureer een eigen SMTP-provider. Dit ontstaat
voordat de callbackroute van de app wordt aangeroepen.
