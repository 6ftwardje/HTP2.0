---
type: release
---
# 03 — geteste staging vrijgeven

Inputs: geslaagde stagingjob/receipt, actuele kandidaatcommit, feature-PR's, [release-runbook](../../docs/STAGING_RELEASE_FLOW.md) en de [coördinatieafspraken](../../CONTRIBUTING.md#productie-en-herstel).

Proces: Ward kiest releasevenster, bevriest staging, beoordeelt de kandidaat en opent een release-PR. Alleen de beschermde GitHub-workflow publiceert na Wards vrijgave. Volg het runbook, geen lokale deploycommando's.

Outputs: beoordeelde release-PR, vrijgave, versleutelde backup en productiereceipt. Bewaar deploymentlinks in de PR; geen backupdata of secrets in werknotities.

Menselijke controle: Ward beoordeelt vóór vrijgave; na publicatie controleert de eigenaar de relevante werking. Herstel fouten volgens het runbook. Synchroniseer main daarna via een gewone taak-PR naar staging.
