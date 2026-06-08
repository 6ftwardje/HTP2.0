# AI Data Strategy

Welke data leeft waar, en wat de AI wel en niet mag aanraken.

## Source of truth per datatype

| Datatype | Bron | AI-rol |
|----------|------|--------|
| Studenten, modules, lessen, voortgang, examens, intake, mentor-notities | Supabase (`public.*`) | Alleen lezen. De AI verandert deze data nooit. |
| AI-gedrag: rol, disclaimers, verboden output, coaching-stijl, feature-kennis | Markdown in `knowledge/` | Wordt in de prompt geladen. Versiebeheerd via git. |
| AI-output: samenvattingen, logs | Supabase (`ai_student_summaries`, `ai_interactions`) | De AI schrijft hier (cache + audit). |

## Mentor-notities blijven menselijk
`student_mentor_notes` is de menselijke bron van waarheid over een student. De AI mag deze notities samenvatten en als context gebruiken, maar nooit overschrijven, tegenspreken als feit, of laten doorgaan voor een eigen conclusie.

## Gouden regel: additief only
Werk op dit live klantplatform is strikt additief. We voegen toe (nieuwe tabellen, nieuwe RLS-policies, nieuwe code). We wijzigen of verwijderen nooit bestaande tabellen, kolommen, policies of data zonder expliciete afstemming. AI-features schrijven uitsluitend naar hun eigen `ai_*`-tabellen en lezen de rest read-only.

## Privacy en toegang
- AI-context wordt uitsluitend server-side samengesteld. Studentdata bereikt nooit de browser via een AI-pad.
- De AI-tabellen zijn admin-only via RLS (`is_platform_admin()`). Gewone studenten hebben geen toegang tot AI-output of -logs.
- De Anthropic API-key is server-only (`ANTHROPIC_API_KEY`), nooit `NEXT_PUBLIC`.
