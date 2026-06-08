# Feature: Mentor Copilot

**Key:** `mentor_summary` | **Status:** In aanbouw | **Doel:** een admin/mentor een snelle, betrouwbare samenvatting geven van een student ter voorbereiding van een 1-op-1 gesprek.

## Waar in de app
Admin studentdetailpagina: `app/admin/students/[id]/page.tsx`, sectie "Mentor Copilot" naast de mentor-notities. Een knop genereert (of vernieuwt) de samenvatting.

## Input (context bundle)
Hergebruikt de bestaande `getAdminStudentDetail(studentId)` uit `lib/admin/students.ts`, die levert:
- student-profiel (naam, e-mail, access level, mentor-status, tags, last_seen)
- voortgangsoverzicht en per-module voortgang
- intake/onboarding-antwoorden
- mentor-notities

`buildMentorContext()` in `lib/ai/mentor-copilot.ts` zet dit om naar een compacte tekst voor de prompt.

## Knowledge
- `knowledge/ai/global/*` (rol, disclaimer, verboden output, stijl)
- `knowledge/ai/mentor-copilot/call-prep-checklist.md`
- `knowledge/ai/mentor-copilot/student-risk-signals.md`

## Output (gestructureerd)
JSON met: `status` (korte status), `voortgang`, `risicos[]`, `call_focus[]`, `open_vragen[]`. Opgeslagen in `ai_student_summaries` (cache, een rij per student per feature).

## Model en kosten
Default `claude-sonnet-4-6` (zie `lib/ai/registry.ts`). Admin-getriggerd, laag volume. Elke call gelogd in `ai_interactions`. Voor goedkoper: model in de registry naar Haiku zetten.

## Veiligheid
- Admin-only: server action met `requireAdmin()`, tabellen met RLS via `is_platform_admin()`.
- Geen financieel advies of trade-signalen (zie `knowledge/ai/global/forbidden-advice.md`).
- Mentor-notities blijven de menselijke bron van waarheid; de samenvatting is een hulpmiddel, geen vervanging.

## Datatabellen (additief)
- `ai_student_summaries` (cache)
- `ai_interactions` (log)
Migratie: `supabase/migrations/<ts>_ai_mentor_copilot.sql`.
