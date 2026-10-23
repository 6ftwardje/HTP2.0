# Bericht voor Dylan

Hey Dylan, staging en de releaseflow staan klaar. Na review en merge van de startkit-PR staat op `codex/staging` ook een `developer-kit` met setup, werkafspraken, AI-startprompt en een template per taak.

Clone `https://github.com/6ftwardje/HTP2.0` met branch `codex/staging`, open de volledige repo in je AI-tool en begin bij `developer-kit/README.md`. Gebruik daarna de prompt uit `developer-kit/AI_START.md`. Ik deel stagingkeys en testlogins apart via een wachtwoordmanager.

We werken telkens vanuit één issue op een nieuwe eigen featurebranch vanaf staging. Wijzigingen gaan via een PR naar `codex/staging`, met tests en review. Na merge wordt staging automatisch getest en uitgerold. Werk nooit rechtstreeks op main of staging en deploy niet zelf naar productie.

Productie loopt via een aparte release-PR en mijn vrijgave. Begin liefst met één kleine taak, dan doorlopen we samen de eerste PR.
