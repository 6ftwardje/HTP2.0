---
type: setup
---
# 01 — lokale omgeving

Inputs: [SETUP.md](SETUP.md), [.env.development.example](.env.development.example), [werkafspraken](../../CONTRIBUTING.md). Laad geen privébestanden voor context.

Proces: nieuwe volledige clone, dependencies installeren, Dylan vult eigen stagingkeys privé in, echte taakbranch kiezen en veilige startcontrole uitvoeren.

Outputs: genegeerde `.env.development.local`, geldige taakbranch en lokale dummylogin. Noteer alleen het resultaat van `dev:check`, geen sleutelwaarden.

Menselijke controle: Dylan ziet localhost, staginglabel en zijn dummyaccount. Ga daarna vanuit een toegewezen issue naar [02](../02-feature/CONTEXT.md).
