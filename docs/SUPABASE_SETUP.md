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

Zet de **Site URL** in productie op je echte domein. De app gebruikt
`/auth/confirm` voor e-mailtokens en behoudt `/auth/callback` als PKCE-callback.

Voor `hettradeplatform.be`:

| Instelling | Waarde |
| --- | --- |
| **Site URL** | `https://hettradeplatform.be` |
| **Redirect URLs** | `https://hettradeplatform.be/auth/callback**` |
| **Redirect URLs** | `https://hettradeplatform.be/auth/confirm**` |
| **Redirect URLs** | `https://www.hettradeplatform.be/auth/callback**` |
| **Redirect URLs** | `https://www.hettradeplatform.be/auth/confirm**` |
| **Redirect URLs** | `http://localhost:3000/auth/callback**` |
| **Redirect URLs** | `http://localhost:3000/auth/confirm**` |

Zet in je productie-environment ook:

```env
NEXT_PUBLIC_SITE_URL=https://hettradeplatform.be
```

Voor de tijdelijke Netlify-productieomgeving uit de testfase:

| Instelling | Waarde |
| --- | --- |
| **Site URL** | `https://htp2.netlify.app` |
| **Redirect URLs** | `https://htp2.netlify.app/auth/callback**` |
| **Redirect URLs** | `https://htp2.netlify.app/auth/confirm**` |
| **Redirect URLs** | `http://localhost:3000/auth/callback**` |
| **Redirect URLs** | `http://localhost:3000/auth/confirm**` |

Zet in Netlify voor deze tijdelijke omgeving:

```env
NEXT_PUBLIC_SITE_URL=https://htp2.netlify.app
```

De app gebruikt deze waarde om de bevestigingslink na registratie en de
resetlink voor wachtwoordherstel naar het live domein te laten wijzen.

Als je aangepaste Supabase e-mailtemplates gebruikt, controleer dan dat de link
naar `/auth/confirm` wijst en `{{ .TokenHash }}` meestuurt. Dat vermijdt dat de
e-mailbevestiging afhankelijk is van de PKCE code-verifier-cookie van dezelfde
browser.

Voor bevestiging na registratie:

```html
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard
```

### Wachtwoord vergeten correct laten redirecten

De resettemplate moet verwijzen naar:

```text
/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/update-password
```

De aparte resetpagina wordt daarna door de app geopend nadat `/auth/confirm` de
recovery-token heeft gevalideerd en de sessiecookie heeft gezet.

Controleer in **Authentication** -> **URL Configuration**:

| Instelling | Productiewaarde |
| --- | --- |
| **Site URL** | `https://hettradeplatform.be` |
| **Redirect URL** | `https://hettradeplatform.be/auth/callback**` |
| **Redirect URL** | `https://hettradeplatform.be/auth/confirm**` |
| **Redirect URL** | `https://www.hettradeplatform.be/auth/callback**` |
| **Redirect URL** | `https://www.hettradeplatform.be/auth/confirm**` |
| **Redirect URL** | `http://localhost:3000/auth/callback**` |
| **Redirect URL** | `http://localhost:3000/auth/confirm**` |

Controleer in **Authentication** -> **Email Templates** -> **Reset Password**:

1. De knop/link moet `/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/update-password` gebruiken.
2. Gebruik geen hardcoded link naar `/account/update-password`.

De gebruiker klikt dus op de app-link, de app valideert de token via Supabase,
en stuurt daarna veilig door naar `/account/update-password`.

## 3b. Password Security aanscherpen

Controleer in **Authentication** -> **Password Security**:

| Instelling | Aanbevolen |
| --- | --- |
| **Minimum password length** | minimaal `8`, liever `10` of `12` |
| **Password requirements** | minstens letters + cijfers, bij voorkeur hoofdletters/kleine letters/cijfers |
| **Secure password change** | aan |

De UI eist minimaal 8 tekens. Supabase moet dit ook server-side afdwingen, zodat
niemand via een aangepaste request een zwakker wachtwoord kan registreren.

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

Voor Combell Basic Mail op `hettradeplatform.be`:

| Supabase SMTP veld | Waarde |
| --- | --- |
| **Enable Custom SMTP** | aan |
| **Host** | `smtp-auth.mailprotect.be` |
| **Port** | `587` met TLS, of `465` met SSL |
| **Username** | het volledige mailboxadres, bv. `info@hettradeplatform.be` of `no-reply@hettradeplatform.be` |
| **Password** | het wachtwoord van die Combell mailbox |
| **Sender email / From address** | hetzelfde mailboxadres |
| **Sender name** | `Het Trade Platform` |

Gebruik geen poort `25`. Maak in MyCombell eerst de mailbox aan die je als
SMTP-gebruiker gebruikt. Controleer daarna de DNS van `hettradeplatform.be`:
de SPF-record moet Combell mailprotect bevatten, bijvoorbeeld
`include:_spf.relay.mailprotect.be`. Als er al een SPF-record bestaat, voeg je
die include toe aan de bestaande record in plaats van een tweede SPF-record te
maken.

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
