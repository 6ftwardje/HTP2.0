# Cost Tracking

Hoe we de kosten van AI-features zichtbaar en beheersbaar houden.

## Waar de kosten ontstaan
Elke AI-feature doet Anthropic-calls. De kost hangt af van het model en het aantal tokens (input + output). Het model per feature staat in `lib/ai/registry.ts` (de "cost-knop").

## Hoe we meten
Elke call wordt gelogd in `public.ai_interactions` met:
- `feature` (welke feature)
- `model`
- `input_tokens`, `output_tokens`
- `status` (success of error)
- `created_at`

Daarmee kun je kosten per feature en per periode reconstrueren. Voorbeeldquery (read-only):

```sql
select feature, model,
       count(*) as calls,
       sum(input_tokens) as in_tokens,
       sum(output_tokens) as out_tokens
from public.ai_interactions
where created_at > now() - interval '30 days'
group by feature, model
order by calls desc;
```

## Knoppen om te optimaliseren
1. Model wisselen per feature in `lib/ai/registry.ts` (bv. Sonnet naar Haiku voor goedkopere, eenvoudigere taken).
2. Prompt kleiner maken: alleen de nodige knowledge-bestanden laden per feature (gebeurt al via `knowledgeFiles` in de registry).
3. Cachen: features met een cache-tabel (zoals Mentor Copilot) doen niet bij elke paginaweergave een nieuwe call, alleen op expliciete generatie of vernieuwing.
4. Output beperken via `max_tokens` per feature.

## Modellen en richtprijs
Vul hier de actuele Anthropic-prijzen in per model dat we gebruiken, zodat tokens naar euro's te vertalen zijn. (Bewust leeg gelaten; prijzen wijzigen en horen niet hardcoded in code.)

| Model | Input ($/Mtok) | Output ($/Mtok) | Gebruikt door |
|-------|----------------|-----------------|---------------|
| claude-sonnet-4-6 | (vul in) | (vul in) | Mentor Copilot |
