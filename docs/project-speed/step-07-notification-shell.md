# Project Speed — stap 07: notification shell readmodel

Datum: 24 juli 2026

## Hypothese

Iedere protected route wacht in de layout op twee losse notificationrequests:
één exact unread count en één lijst met maximaal vijftig notificaties waarvan de
shell er acht gebruikt. Eén smalle readfunctie kan dezelfde shellinformatie in
één netwerkroundtrip leveren.

## Architectuur en trust model

`public.get_my_notification_shell()`:

- accepteert geen student-id of andere parameters;
- bepaalt de student uitsluitend met `auth.uid()`;
- is `security invoker` en `stable`;
- behoudt RLS op recipients en events;
- retourneert exact unread count en maximaal acht recente niet-gearchiveerde
  notificaties;
- heeft execute voor `authenticated` en `service_role`, niet voor `anon` of
  `public`.

`PROJECT_SPEED_NOTIFICATION_SHELL=1` selecteert het readmodel. Bij ontbrekende,
ongeldige of student-mismatched data valt de layout terug op beide legacyreads.
De flag is build-deterministisch en standaard uit.

## A/B-status

Nog uit te voeren na gerichte migratie, directe grant/auth-tests, production
builds en stabiele shell/dashboardhash.
