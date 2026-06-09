# AI Architecture

Hoe een AI-request door het systeem stroomt. Dezelfde flow geldt voor elke feature.

## Request-flow

```
Admin drukt op knop (client component)
  -> server action (app/actions/admin/ai.ts)        requireAdmin() gate
    -> feature-helper (lib/ai/<feature>.ts)
       1. context bundle ophalen uit Supabase        (bestaande server-side helpers, read-only)
       2. loadKnowledge(featureKey)                  global + feature markdown uit knowledge/
       3. Anthropic-call                             model uit lib/ai/registry.ts, structured output
       4. resultaat cachen                           upsert in cache-tabel (bv. ai_student_summaries)
       5. call loggen                                insert in ai_interactions (model, tokens, status)
  -> revalidatePath() zodat de pagina de nieuwe output toont
```

## Bouwstenen

- `lib/ai/registry.ts` — per feature: `key`, `model`, `knowledgeFiles`, `cacheTable`, `description`. Eén plek om het model te wisselen.
- `lib/ai/anthropic.ts` — maakt de Anthropic-client; leest het model uit de registry of `ANTHROPIC_MODEL`.
- `lib/ai/knowledge.ts` — `loadKnowledge(featureKey)` leest `knowledge/ai/global/*` plus de feature-map, gecachet per request via React `cache()`. Zo laadt elke feature alleen wat hij nodig heeft (kleiner = goedkoper).
- `lib/ai/<feature>.ts` — de feature-logica: context bouwen, prompt samenstellen, call doen, cachen, loggen.

## Structured output
Features die gestructureerde data nodig hebben, gebruiken een Anthropic tool-definitie met `tool_choice` forced, zodat het model gevalideerde JSON teruggeeft in plaats van vrije tekst.

## Faalgedrag
Een mislukte AI-call gooit geen fout naar de UI. De helper logt `status = 'error'` in `ai_interactions` met de foutmelding en geeft een nette foutstatus terug, zodat de admin een duidelijke melding ziet en de pagina blijft werken.
