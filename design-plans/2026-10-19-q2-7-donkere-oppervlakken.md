# Q2.7 — Kaarten en hover onderscheiden via twee bestaande tokens

Written against: `169e6ddfadb34b1cf4d2ca59d6bf546e52cded08` (main, 19 oktober 2026).
Status: goedgekeurd door Ward op 19 oktober 2026; issuekoppeling in het prioriteitenplan. Onderdeel van [het prioriteitenplan](2026-10-19-prioriteiten-en-issuekoppeling.md).

## Evidence chain

- Surface: beschermde leden-/beheeromgeving, met Marktinzicht-kaart als directe consument.
- Problem: Ward meldt vlakke oppervlakken en geeft twee exacte vervangende kleuren (4.1).
- Design evidence: nieuwe expliciete opdracht supersedeert HTP-02/#44 op precies twee donkere waarden.
- Owner: `app/globals.css`, `:root` bezit `--card: #161a21` en `--surface-hover: #1d222b`; `html[data-theme="light"]` bezit aparte overrides.
- Runtime: `MarketUpdateCard.module.css` gebruikt `background: var(--card)` en bij hover `var(--surface-hover)`. `cb-panel`, dashboardpanelen en beheervelden consumeren dezelfde tokens. `html, body` gebruiken `--background`.
- Scope: alleen donkere defaults; alle bestaande tokenconsumenten erven de verandering.
- Uncertainty: de contrastcijfers uit de aangeleverde lijst zijn geen in deze ronde herhaalde meting. Beoordeel de gewijzigde echte componentstaten tijdens uitvoering.

## Design decision

Verander uitsluitend `--card` naar **`#1A1F29`** en `--surface-hover` naar **`#232936`** in de donkere root. Laat achtergrond `#0D0F14`, tekst, accent, randen, marktkleuren en lichte overrides zoals ze zijn. Geen aparte dashboard- of kaartkleur introduceren.

## Reuse

- Exacte eigenaars: `--card`, `--surface-hover`, bestaande `.cb-panel` en kaart-CSS.
- Exemplar: `MarketUpdateCard.module.css` erft al beide tokens correct.
- Geen nieuwe primitive of schaduwlaag nodig. Het oudere lokale plan `02-consolidate-neutral-panel-owner.md` is geen opdracht om nu panelen te refactoren.

## Changes

1. Wijzig twee rootwaarden in `app/globals.css`. Geen brede zoek/vervangactie op hexwaarden door heel de repository.
2. Traceer de werkelijk geraakte consumenten en controleer defaults/hover/focus/selected/disabled. Onverwacht effect documenteren; voeg niet stil nieuwe kleuren toe.
3. Hercontroleer gedeelde kaart, weekhero, dashboard, moduleoverzicht, adminlijst/formuliervelden en thematische 404. De publieke landing gebruikt eigen scope: niet herontwerpen.

## Scope

- Inherit: alle bestaande consumenten van de twee tokens, waaronder admin-productbordoppervlakken; gedrag van het productbord blijft behouden.
- Verify: tekst-/veld-/focuscontrast op de nieuwe oppervlakken, opgeslagen thema en licht/donker-switch.
- Exclude: light theme, logo/typografie, layout, nieuwe randen/schaduwen, bodyachtergrond en wijziging van andere tokens.

## Validation

- Product/interface: rustige maar herkenbare kaartvlakken; 375/768/1440, beide thema's; vergelijk voor/na op dezelfde inhoud en toestanden.
- System: berekende donkere kaart-/hoverwaarde klopt en lichte kaart blijft `#FFFFFF`, hover `#F7F8FA`.
- Repository: `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`, `npm run backlog:check`; geen nieuwe unit-test die uitsluitend twee CSS-literals spiegelt.

## Stop conditions

- Bij aantoonbaar onleesbare bestaande tekst/focus door de twee nieuwe waarden: effect vastleggen en de kleinste noodzakelijke uitzondering voorleggen; geen ongeautoriseerd volledig palet aanpassen.

## Design documentation

Registreer de nieuwe waarden als vervolg op #44 en actualiseer de bindende thema-afspraak na acceptatie. #44 blijft historisch Done; één Q2.7-vervolgissue.
