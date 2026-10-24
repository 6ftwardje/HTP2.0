# Plan voor invoering

## 1. Meteen beginnen

Ward deelt repo/startmap. Dylan gebruikt een nieuwe clone, ontvangt stagingkeys en dummylogin privé en controleert zijn lokale login. Daarna kiest hij één klein issue zonder nieuwe provider, migratie of betaling en volgt de [werkafspraken](../CONTRIBUTING.md).

Klaar wanneer hij zelfstandig een geldige taakbranch maakt, `dev:check` slaagt, hij lokaal met een dummyaccount inlogt en een draft-PR naar staging opent.

## 2. Eerste gezamenlijke proef

Dylan maakt de PR; Ward leest diff en bewijs. Na groene CI: stagingmerge, automatische uitrol en functionele controle door Dylan. Ward doorloopt de release-PR en beschermde vrijgave wanneer die wijziging werkelijk naar productie mag. Doe geen betekenisloze productierelease alleen om een procedure af te vinken.

Klaar wanneer issue/PR duidelijk onderscheid maken tussen getest op staging en live op productie, deploymentlinks vindbaar zijn en main na de release terug naar staging wordt gesynchroniseerd.

## 3. Daarna versterken

| Prioriteit | Actie | Eigenaar / gereed wanneer |
| --- | --- | --- |
| Eerst | Minimaal één PR-review technisch afdwingen | Ward, zodra beiden reviewer-toegang en beschikbaarheid hebben |
| Daarna | Eigen lokale Supabase per ontwikkelaar/checkout | Aparte engineeringtaak: gecontroleerde baseline/fixtures, localhost-only bootstrap, eigen poorten, schemafingerprint en cleanup |
| Daarna | Sandboxen voor ClickMeeting/video, mail en betaling | Afzonderlijke testkeys, callbacks, verbruikslimieten en acceptatie; geen productiekeys kopiëren |
| Daarna | Storage-backups en restore-oefening op wegwerpdoel | Ward bewaart herstelbewijs; databasebackup bevat geen Storage-objectinhoud |

De eigen ontwikkeldatabase is nog geen ingebouwde installer. De werkende eerste route gebruikt lokaal de gedeelde dummy-stagingdatabase; CI repeteert schemawijzigingen wel geïsoleerd. De documentatie stelt toekomstige isolatie niet als al aanwezig voor.

Een feature is klaar na beperkt en beoordeeld werk, passend bewijs en geslaagde staginguitrol. Productie is pas live na de afzonderlijke vrijgave en geslaagde productiejob; een AI-bewering of checkbox vervangt geen bewijs.
