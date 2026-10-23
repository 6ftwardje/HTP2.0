---
type: implementation
---
# 02 — één feature of bugfix

Inputs: toegewezen issue, [CONTRIBUTING.md](../../CONTRIBUTING.md), relevante code en een kopie van [het taaktemplate](../_templates/feature/CONTEXT.md) in `.dev-work/<taakcode>/`. Laad niet de volledige documentatie of privé-envinhoud.

Proces: leg scope vast in TASK.md, implementeer op een eigen actuele taakbranch, test naar risico, vul HANDOFF.md in en open een PR naar staging. Een bestaande issue-opdracht hoeft niet opnieuw te worden goedgekeurd. Splits extra scope af.

Outputs: code/tests/docs, lokale editbare TASK/HANDOFF en een PR met één primair issue en feitelijk testbewijs. Neem de relevante overdracht over in de PR.

Menselijke controle: reviewer leest diff en bewijs; na merge controleert de eigenaar de geslaagde stagingjob én de functie op staging. Daarna komt de wijziging in aanmerking voor [03](../03-release/CONTEXT.md).
