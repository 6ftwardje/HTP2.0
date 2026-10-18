# F5a — HTP-25 onderzoek en proef

18 oktober 2026. Ward vroeg issues te hervatten. **F5a lokaal gestart bij HTP-25 / [#77](https://github.com/6ftwardje/HTP2.0/issues/77). D7/D8 zijn nog niet gekozen; HTP-25 is niet Done en HTP-26/27/28 zijn niet gestart.** [Conceptcontract en beslispunten](HTP-F5A-CONTRACT.md) · [Backlog](HTP-BACKLOG.md) · [Bord](https://github.com/users/6ftwardje/projects/3).

Branch `codex/htp-f5a-local`, voortbouwend op lokale F4 `f2bf0c3`; proefcommit `ff216c2`. F4 is niet gepubliceerd. Geen applicatiecode, package.json, lockfile, configuratie, database of productieomgeving gewijzigd tijdens deze HTP-25-proef. Alleen planningsdocumenten en herhaalbare synthetische proeven onder `scripts/probes/htp-f5a/`. De oorspronkelijke dirty checkout is behouden.

## Uitgevoerd

- Feedbackrubriek 11 en referenties 3/4 opnieuw gelezen en gerenderd. Bestaande private chartlevering, actuele module-/intake-/legacy-entitlements en huidige Netlify/Nodeconfiguratie gecontroleerd vanuit broncode; geen nieuwe rubriek-/PDF-keten aangetroffen.
- Concreet voorstel voor rechtenmatrix, bestandsgrenzen, semantische leesversie, serverwatermark, beperkte openlog, private opslag, parent-/versiecontract, cache-/rangegedrag, fouten en implementatievolgorde geschreven. D7/D8 staan uitdrukkelijk als voorstellen, niet als stil goedgekeurde aanbevelingen.
- Geïsoleerde installatie buiten de app: pdfjs-dist 6.4.299 en pdf-lib 1.17.1. Audit op 18 oktober: nul gemelde kwetsbaarheden. Lokale Node 22.14 voldoet aan het vereiste >=22.13. App-dependencies zijn identiek gebleven; toekomstige productie-installatie/bundling/Unicodefonts zijn nog niet bewezen.
- Synthetische generator voor 1 pagina, 120 pagina’s met beelddata (18.581.196 bytes), beschadigde en wachtwoordversleutelde PDF. Het grote document ligt buiten de voorgestelde 3 MiB-uploadlimiet en is uitsluitend een renderstressproef.

## Finale proef

10 controlegevallen: grote en enkele pagina op 1440/834/375px (6), beschadigd/versleuteld (2), twee gescheiden serverwatermarkresultaten (2). Geen ongehanteerde paginafouten. Native dialog, Escape/focusherstel, paginaselectie 1/60/120/1, scroll, 200% zoom/passend, tekstextractiestand, vrijgeven van canvas bij sluiten en binnen de viewer blijvende bediening gecontroleerd.

Maximaal drie actieve canvassen, ieder begrensd op twee miljoen pixels; de finale meting staat in `output/playwright/htp-f5a/results.json`. Gemeten maximum over de vastgelegde scroll-/zoomgevallen: **18.827.640 bytes canvas-RGBA**. De theoretische totale RGBA-grens is 24 MB. **Dit is geen meting/garantie van totaal browsergeheugen:** PDF-parsing, afbeeldingen, worker, GPU en andere processen kunnen extra geheugen gebruiken. De JS-heapwaarde is alleen aanvullende Chrome-telemetrie. Geen fysieke iOS-/Safari-/Firefox-acceptatie.

De twee geleverde documenten zijn daadwerkelijk met pdf-lib gemarkeerde PDF-bytes, geen DOM-overlay. Poppler `pdftotext -raw` controleert **vier volledige persoonlijke markeringen per pagina, 120 pagina’s per lezer**, geen naam/e-mail van de andere proefpersoon en verschillende bytehashes. Alleen fictieve `example.invalid`-personen. Die tekstextractie demonstreert tegelijk dat bytes/tekst nog te kopiëren zijn; het watermerk biedt geen absolute beveiliging.

De visuele batch omvat zes schermen en een gerichte bevestiging na correcties. Gevonden en opgelost in de proef: bovenste watermerk buiten paginagrens, mobiele dialoogkop die mee wegscrolde, canvas-cleanup na asynchrone render en actieve pagina op basis van alleen gewijzigde IntersectionObserver-records. Geen productacceptatie afgeleid van de vormgeving van dit laboratorium.

## Wat dit niet bewijst

De proefserver is uitsluitend `127.0.0.1:3120`, bevat alleen vaste synthetische documenten en heeft **geen productauthenticatie**. Verschillende fictieve namen en no-store-headers bewijzen geen echte RLS, account-/sessierevocation, uploadveiligheid, productiecache-/rangeisolatie of beheerderlog. Dat zijn de verplichte HTTP/SQL-integratiecriteria van HTP-26/27, vóór Done. Geen credentials, signed URLs of echte cursusassets gebruikt.

De tekststand gebruikt ruwe PDF-tekstextractie. Die kan verkeerde leesvolgorde en ontbrekende chartbeschrijvingen hebben en is **geen AA-gevalideerde leesversie**. Het contract stelt daarom gecontroleerde semantische HTML met beschrijvingen als publicatievoorwaarde voor. Hiervoor is expliciete D8-keuze nodig vanwege de spanning met de instructie ‘geen tekstlaag/kopiëren’.

Het 18,6 MB-bestand bewijst geen Netlify-uitlevering: buffered binary heeft daar een kleinere limiet dan streaming. Zie het onderbouwde grensvoorstel in het contract. Grotere toegestane uploads niet beloven op basis van een localhost-proef. Beheerlogs/30-dagencleanup, volledige Unicodeprofielen, daadwerkelijke private storage, productviewer en integratie in updates/Academy zijn niet gebouwd.

## Herhalen

Gebruik de bestaande app-Node en een Pythonruntime met ReportLab/Pillow. Installeer de twee exact gepinde proefpackages **buiten** de repository:

```bash
npm install --prefix /tmp/htp-f5a-pilot --no-audit --no-fund --save-exact pdfjs-dist@6.4.299 pdf-lib@1.17.1
python3 scripts/probes/htp-f5a/generate.py
node scripts/probes/htp-f5a/serve.mjs
```

Daarna in een tweede terminal, met de lokale Poppler-binary:

```bash
HTP_PDFTOTEXT=/pad/naar/pdftotext node scripts/probes/htp-f5a/verify.mjs
```

Het laboratorium accepteert uitsluitend zijn exacte loopback-Host; de browserproef blokkeert externe netwerkverzoeken. Output onder genegeerde `output/playwright/htp-f5a/`: fixtures, finale JSON, screenshots/contactvel, servermetingen en twee synthetische gemarkeerde PDF’s/tekstextracties. De live [leesproef](http://127.0.0.1:3120) is een technisch reviewhulpmiddel, geen nieuw product of scrumboard.

## Overdracht

HTP-25 wacht op de twee concrete D7/D8-keuzes in het conceptcontract. Acceptatiecriteria blijven open zolang die keuzes ontbreken; geen Done op alleen dit proefbewijs. Na de keuze het contract actualiseren, HTP-25 afronden indien aan alle criteria voldaan, en HTP-26 → HTP-27 → HTP-28 lokaal uitvoeren. **Geen F4-push, remote migratie of F5b begonnen.**
