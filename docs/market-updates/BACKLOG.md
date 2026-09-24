# Multi-format marktupdates — werkafspraken

Doel: een admin kan een snelle tekst- of chartupdate naast bestaande video's publiceren; studenten zien alle formats in dezelfde Marktinzicht-ervaring.

## Scrumboard

GitHub Project (wanneer projectrechten beschikbaar zijn) met kolommen `Backlog`, `Ready`, `In progress`, `Review`, `Done`. Tot die tijd zijn de gelijknamige statuslabels op issues het uitvoerbare board. Per issue staat exact één statuslabel.

Regel: **voordat iemand code voor een issue wijzigt, zet die het issue op `status:in-progress`** en vermeldt branch of PR. `status:review` volgt zodra de implementatie en verificatie klaar zijn. `status:done` volgt pas na merge en acceptatie. Geblokkeerd werk krijgt `status:blocked` met een concrete reden en volgende actie. WIP-limiet: één actief issue per uitvoerder. Volg de issuevolgorde tenzij een afhankelijkheid anders vraagt.

## Productgrenzen

- Behoud `weekly_updates` en de bestaande video-, toegang- en notificatiestromen.
- Nieuwe databasevelden en storage zijn additief en krijgen veilige defaults.
- Publicatievalidatie gebeurt server-side. Afbeeldingen voor betaalde content staan privé en zijn alleen na toegangscontrole opvraagbaar.
- Geen comments, likes, charteditor of automatische trade-signalen in de MVP.

## Issues

1. MU-1: datamodel en veilige migratie.
2. MU-2: private chartuploads en toegangsgecontroleerd tonen.
3. MU-3: admin-editor voor tekst en charts.
4. MU-4: server-side publicatie en idempotente notificaties.
5. MU-5: gemengde feed en detailpagina.
6. MU-6: end-to-end acceptatie, regressie en toegankelijkheid.

## Definition of done

Een admin kan een chart met duiding binnen twee minuten publiceren. Studenten met toegang zien de update in de juiste markt; anderen kunnen ook de afbeelding niet laden. Video's, transcriptie en bestaande notificaties werken nog. Fouten bij upload/publicatie zijn herstelbaar zonder tekstverlies. Testen en build slagen op de featurebranch.
