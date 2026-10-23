---
type: workflow
unit: feature-issue
---
# Contract van de startmap

Inputs: [centrale regels](../CONTRIBUTING.md), [release-runbook](../docs/STAGING_RELEASE_FLOW.md), één backlogissue en relevante code.

Route: [01 setup](01-setup/CONTEXT.md) → [02 feature](02-feature/CONTEXT.md) → [03 release](03-release/CONTEXT.md). Laad alleen de huidige stap. De afgesproken issue-scope geeft toestemming voor gewone implementatie en tests; maak geen extra toestemmingsrondes.

Vaste instructies/templates blijven hier. Kopieer [_templates/feature](_templates/feature/CONTEXT.md) per taak naar de genegeerde `.dev-work/<taakcode>/`. Het gedeelde resultaat en testbewijs horen in issue/PR, niet uitsluitend in privénotities.

Status volgt uit bestanden en GitHub: TASK = voorbereiding; ingevulde HANDOFF = overdracht voorbereid; geslaagde PR-checks en stagingreceipt = integratie bewezen; geslaagde productiejob = uitgebracht. Een checkbox bewijst geen deployment.

Menselijke controle: Dylan controleert zijn lokale login; reviewer leest scope/diff/testbewijs vóór samenvoegen; Ward beoordeelt de kandidaat vóór productie-vrijgave. Een al goedgekeurd issue/review kan de betreffende controle leveren.
