# Q2.5 — Sessies overzien en een nieuwe sessie op aanvraag invoeren

Written against: `169e6ddfadb34b1cf4d2ca59d6bf546e52cded08` (main, 19 oktober 2026).
Status: goedgekeurd door Ward op 19 oktober 2026; issuekoppeling in het prioriteitenplan. Onderdeel van [het prioriteitenplan](2026-10-19-prioriteiten-en-issuekoppeling.md).

## Evidence chain

- Surface: `/admin/live-sessions`.
- Problem: Wards observatie 3.3 meldt een permanent open formulier. De route rendert inderdaad een `380px`-kolom met sticky nieuwe-sessieformulier; de headerlink is alleen onder xl zichtbaar en springt slechts naar het formulier.
- Design evidence: expliciete opdracht: agenda eerst, aanmaken achter een knop.
- Owner: `app/admin/live-sessions/page.tsx`; `components/admin/LiveSessionActionForm.tsx` bewaart submit/feedback.
- Runtime: route plaatst beide direct in de renderboom; geen eigen modal of toggle op main.
- Scope: presentatie en levenscyclus van het aanmaakformulier, berekende aanmaakdatum.
- Uncertainty: main gebruikt al `localInputDate(new Date(Date.now() + 7 * 24 * 60 * 60_000))`, Europe/Brussels. Een hardcoded 25-10-2025 is niet aangetroffen. Controleer publicatie, caching, browser-restored input en fixtures voordat je een datumoorzaak claimt.

## Design decision

Een zichtbare knop 'Nieuwe sessie' opent een inline aanmaakpaneel boven de agenda. Standaard is het dicht, agenda benut de beschikbare breedte. Opnieuw openen na annuleren/succes begint met een verse toekomstige standaarddatum; geen hardcoded kalenderdag of vaste redactiesessie verzinnen.

## Reuse

- `PageHeader.actions`, `cb-btn`, `cb-panel`, `LiveSessionActionForm` en bestaande `adminCreateLiveSession`.
- Exemplar: bestaande formulierfeedback in `LiveSessionActionForm`; behoud pending-beveiliging, invoer bij fout en serverautorisatie.
- Gebruik een kleine clientwrapper voor open/dicht en formresultaat; geen nieuw dialoogsysteem nodig.

## Changes

1. Routeheader: knop op alle breedtes. Verwijder permanente linkerkolom/sticky bezetting; agenda en archief blijven zichtbaar in normale volgorde.
2. Paneel: knop bedient `aria-expanded` en paneel-ID; focus op titelveld bij openen. 'Annuleren' sluit en brengt focus terug naar de knop. Formulier blijft open bij validatie-/opslagfout, met invoer behouden. Bij bevestigde geslaagde opslag sluiten en agenda verversen.
3. Aanmaakdatum: bereken bij openen zeven Brusselse kalenderdagen vooruit, rond vooruit af op een kwartier. Neem nu opnieuw bij iedere verse opening; als formulier lang open staat, controleert opslaan nog steeds toekomstigheid. Controleer bestaande serverdatumparser, duur en DST-afhandeling; geen opgeslagen sessiedata wijzigen.
4. Breid alleen de aanmaakcompositie uit met een succescallback indien nodig. Andere `LiveSessionActionForm`-gebruikers voor publiceren, annuleren, status en replay behouden hun feedbackgedrag.
5. Datumincident eerst reproduceren. Als actuele main al correct werkt, noteer dat als opgelost/niet reproduceerbaar; alleen openingsgedrag en toekomstigheid wijzigen.

## Scope

- Inherit: uitsluitend nieuw-sessieformulier.
- Verify: publiceren + melding, annuleren, op live zetten, replaykoppeling, paginering agenda/archief en foutfeedback.
- Exclude: HTP-43 replayketen, ClickMeeting-integratieherbouw, automatisch publiceren, notificaties opnieuw versturen, bestaande sessietijden verschuiven.

## Validation

- Product: alleen kijken/plannen gebruikt geen open formulier; toevoegen werkt na knop; fout bewaart inhoud en succes verschijnt in agenda.
- Interface: 375/768/1440, licht/donker, keyboardfocus; dichte/open/fout/pending/successtaat.
- Functioneel: vaste klok rond Brusselse DST/jaargrens, heropenen na tijdsverloop, submit met verstreken tijd. Serverfout vindbaar via Q2.1, zonder formulierinhoud te loggen.
- Repository: bestaande sessietests + noodzakelijke klok-/actieproeven, `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`, `npm run backlog:check` groen.

## Stop conditions

- Stop het datumherstel wanneer de afwijking alleen uit een andere deployment komt; leg eerst versie/bron vast. Stop bij benodigde providerwrites of wijziging van publicatie-/meldingssemantiek buiten deze UI-scope.

## Design documentation

Leg het aanmaken-op-aanvraag en de standaarddatum vast in het uitvoerissue. Geen wijziging van HTP-43. Logging volgt Q2.1.
