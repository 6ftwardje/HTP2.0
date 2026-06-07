# Het Trade Platform 2.0 - Schema Overview

## 1. Full SQL migration

The migration lives in:

**`supabase/migrations/20250316000000_het_trade_platform_schema.sql`**

It includes:

- `pgcrypto` extension
- Tables: `students`, `modules`, `lessons`, `exams`, `exam_questions`, `exam_results`, `progress`
- Follow-up migration: `lesson_action_progress`, plus `lessons.takeaway` and `lessons.action_items`
- `set_updated_at()` trigger and triggers on all tables with `updated_at`
- Check constraints: `access_level >= 1`, `passing_score` and `score` 0–100, phone length 8–20, `exam_questions.options` as JSON array
- Indexes for FKs, unique keys, and filtered indexes for `is_published`
- RLS enabled on all tables with the policies described below
- Course content is imported separately from the legacy Trade Platform

Run it with Supabase CLI (e.g. `supabase db push`) or apply the file in the SQL editor.

---

## 2. Why each table exists

| Table | Purpose |
|-------|--------|
| **students** | Links Supabase Auth (`auth_user_id`) to a stable app identity (`id`). Holds profile (name, phone, email), `access_level` for future gating, and `last_seen` for activity. |
| **modules** | Top-level curriculum units (e.g. “Technische Analyse”). `order_index` defines sequence; `slug` for URLs; `is_published` for draft/live. |
| **lessons** | Content inside a module (e.g. video lessons). `order_index` per module drives lesson order and locking (complete lesson N before N+1). `video_url` / `video_provider` support legacy Vimeo and Mux playback. Mux uploads store `mux_asset_id`, `mux_playback_id`, `mux_playback_policy`, `mux_status`, `mux_upload_id`, and `mux_error_message`. |
| **exams** | One exam per module (v1). `passing_score` (0–100) defines what “passed” means for unlocking the next module. |
| **exam_questions** | Questions for an exam. `options` is a JSON array of answer strings; `correct_answer` stores the correct option value for scoring. |
| **exam_results** | One row per attempt. Stores `score`, `passed`, and `submitted_at`. No unique on `(student_id, exam_id)` so retakes are allowed. |
| **progress** | One row per student per lesson: `watched` and `watched_at`. Used to enforce “complete all lessons before exam” and to drive lesson locking. |
| **lesson_action_progress** | One row per student, lesson, and action index. Stores personal checklist progress without affecting lesson or module gating. |

Together: **modules** and **lessons** define the curriculum; **exams** and **exam_questions** define assessments; **progress** and **exam_results** record what each **student** has done, so the app can lock lessons in sequence and unlock the next module only after passing the previous exam.

`lessons.takeaway` and `lessons.action_items` add optional lesson-level context. Actions stay scoped to the relevant lesson and remain separate from the gating rules, so they add value without blocking the training flow.

---

## 3. Intentionally left out (for simplicity)

These were excluded from the initial Het Trade Platform 2.0 schema:

- **updates** – No dedicated “updates” or announcements table.
- **update_reads** – No read-tracking for updates.
- **payments** – No subscriptions, one-time payments, or payment history; access can be controlled later via `students.access_level` or an external system.
- **practical_lessons** – Only video/content lessons; no separate practical-lesson type or table.

The schema stays minimal and focused on: identity (students), structure (modules, lessons, exams, exam_questions), and completion (progress, exam_results). Locking and gating are implemented in application logic using this data.

---

## 4. RLS summary

- **Content (read-only for authenticated):**  
  `modules`, `lessons`, `exams` – select where `is_published = true`.  
  `exam_questions` – select where the parent `exam` is published.

- **students:**  
  Select/update only the row where `auth_user_id = auth.uid()`. No client insert/delete. Restrict updates in the app to `name`, `phone`, `last_seen` (and let trigger set `updated_at`); do not allow client updates to `access_level` or `auth_user_id`.

- **progress:**  
  Select/insert/update only rows where `student_id` belongs to the current user (via `students.auth_user_id = auth.uid()`). No client delete.

- **exam_results:**  
  Select and insert only rows where `student_id` belongs to the current user. No client update or delete.

Student-scoped policies use the pattern:

`EXISTS (SELECT 1 FROM students WHERE students.id = <table>.student_id AND students.auth_user_id = auth.uid())`

so that `student_id` is resolved from `students.id`, not directly from `auth.uid()`.
