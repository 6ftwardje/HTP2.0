# Bijdragen via backlogissues

Elke wijziging start vanuit exact één issue met label `backlog` en een unieke taakcode. Lees vóór uitvoering het issue, `docs/transcription-ai/EXECUTION_PLAN.md` en relevante projectdocumentatie.

1. Controleer open én gesloten issues op dezelfde taakcode.
2. Maak `feat/<taakcode>-<naam>`, `fix/<taakcode>-<naam>` of `docs/<taakcode>-<naam>`.
3. Open vroeg een draft-PR met exact één `Closes #<nummer>`; gebruik `Refs #<nummer>` voor relaties.
4. Houd voortgang, besluiten en blokkades in het issue. Vergroot scope niet stilzwijgend.
5. Gebruik kleine Conventional Commits, bijvoorbeeld `feat(transcript): persist processing state`.
6. Gebruik synthetische testdata en mock externe integraties. Externe writes en betaalde calls vereisen expliciete menselijke toestemming.
7. Noteer uitgevoerd testbewijs én bewust overgeslagen controles in de PR.
8. Merge alleen met afgevinkte acceptatiecriteria, groene CI en vereiste review. Gebruik squash-merge naar een steeds deploybare `main`; de merge sluit het issue automatisch.

Kritieke AI-, Mux- en databaselogica staat in `CODEOWNERS`. Configureer branch protection op `main` met verplichte CI, minimaal één review en Code Owner-review.

Backlog valideren:

```bash
node scripts/sync-transcription-backlog.mjs --check
```

Remote synchroniseren mag uitsluitend na expliciete toestemming en geldige `gh`-authenticatie:

```bash
ALLOW_GITHUB_WRITES=1 node scripts/sync-transcription-backlog.mjs --apply
```
