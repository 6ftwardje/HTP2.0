# AI op Het Trade Platform

Dit is het startpunt voor alles wat met AI op het platform te maken heeft. Hier zie je welke AI-features bestaan, welk model ze gebruiken, waar hun kennis leeft en wat ze kosten.

## Hoe de AI is opgebouwd (drie lagen)

1. `knowledge/` (in de repo-root) bevat de kennis die in de prompt wordt geinjecteerd. De AI leest dit at runtime.
   - `knowledge/ai/global/` geldt voor elke feature (rol, disclaimers, verboden output, stijl).
   - `knowledge/ai/<feature>/` is feature-specifieke kennis (alleen die feature laadt het).
2. `docs/ai/` (deze map) is documentatie voor mensen. Wordt niet in prompts gebruikt.
3. `lib/ai/registry.ts` is de configuratie in code: per feature het model, de knowledge-bestanden en de cache-tabel. Dit is de plek om een model te wisselen (kosten).

Diepere uitleg: zie [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md), [AI_DATA_STRATEGY.md](./AI_DATA_STRATEGY.md) en [COST_TRACKING.md](./COST_TRACKING.md).

## Feature-overzicht

| Feature | Status | Model (default) | Knowledge | Cache-tabel | Doel |
|---------|--------|-----------------|-----------|-------------|------|
| Mentor Copilot (`mentor_summary`) | In aanbouw | `claude-sonnet-4-6` | `global` + `mentor-copilot` | `ai_student_summaries` | Admin-samenvatting per student voor mentor-calls. Zie [features/mentor-copilot.md](./features/mentor-copilot.md). |

Elke AI-call wordt gelogd in de tabel `ai_interactions` (model, tokens, status). Dat is de bron voor kostenrapportage.

## Een nieuwe AI-feature toevoegen
1. Voeg een submap toe onder `knowledge/ai/<feature>/` met de feature-specifieke kennis.
2. Voeg een entry toe in `lib/ai/registry.ts`.
3. Bouw de server-side helper in `lib/ai/<feature>.ts` (hergebruik `loadKnowledge` en de Anthropic-client).
4. Voeg een pagina toe onder `docs/ai/features/<feature>.md` en een regel in de tabel hierboven.
5. Lever eventuele nieuwe tabellen als additieve migratie (zie de gouden regel in AI_DATA_STRATEGY.md).
