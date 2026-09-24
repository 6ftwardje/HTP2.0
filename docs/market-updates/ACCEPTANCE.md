# Acceptatie en resterende checks

Op de featurebranch zijn typecontrole, productiebouw en 47 tests geslaagd (waarvan 3 nieuwe formatvalidatietests). De nieuwe afbeeldingsroute geeft zonder sessie `401` en met ongeldige ID `404`. In HTP 2.0 zijn de privébucket, het 10 MB-limiet en de beperkende Storage-policy gecontroleerd; de twee bestaande video-rijen zijn ongewijzigd.

Nog niet handmatig getest met echte admin- en studentaccounts: aanmaken, chartupload, publiceren, abonnementspaywall en mobiel/toetsenbord. Er zijn daarvoor geen testaccounts of wegwerpdata in het productieproject aangemaakt. Deze checks horen bij acceptatie vóór merge/deploy. De schemahistoriedrift blijft een apart releaseblokkerend issue (MU-0).

Productevents: bestaande `weekly_update.created`, `weekly_update.updated` en publicatienotificaties blijven gebruikt. Chartuploads bewaren geen beeldinhoud in auditlog. Publiceren is een conditionele overgang van concept naar live; een tweede request kan daardoor geen tweede notificatie starten.
