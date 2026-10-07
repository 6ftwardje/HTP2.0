# Het Trade Platform 2.0 - Schema Overview

## 1. Full SQL migration

The migration lives in:

**`supabase/migrations/20250316000000_het_trade_platform_schema.sql`**

It includes:

- `pgcrypto` extension
- Tables: `students`, `modules`, `lessons`, `exams`, `exam_questions`, `exam_results`, `progress`
- Follow-up migrations: `lesson_action_progress`, plus `lessons.takeaway`, `lessons.action_items`, and `lessons.type`
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
| **lessons** | Content inside a module (e.g. video lessons). `type` is required and distinguishes `theorie` from `praktijk`. `order_index` per module drives lesson order and locking (complete lesson N before N+1). `video_url` / `video_provider` support legacy Vimeo and Mux playback. Mux uploads store `mux_asset_id`, `mux_playback_id`, `mux_playback_policy`, `mux_status`, `mux_upload_id`, and `mux_error_message`. |
| **exams** | One exam per module (v1). `passing_score` (0–100) defines what “passed” means for unlocking the next module. |
| **exam_questions** | Questions for an exam. `options` is a JSON array of answer strings; `correct_answer` stores the correct option value for scoring. |
| **exam_results** | One row per attempt. Stores `score`, `passed`, and `submitted_at`. No unique on `(student_id, exam_id)` so retakes are allowed. |
| **progress** | One row per student per lesson: `watched` and `watched_at`. Used to enforce “complete all lessons before exam” and to drive lesson locking. |
| **lesson_action_progress** | One row per student, lesson, and action index. Stores personal checklist progress without affecting lesson or module gating. |

Together: **modules** and **lessons** define the curriculum; **exams** and **exam_questions** define assessments; **progress** and **exam_results** record what each **student** has done, so the app can lock lessons in sequence and unlock the next module only after passing the previous exam.

`lessons.type` classifies each lesson as theory or practice for authoring and student-facing grouping. `lessons.takeaway` and `lessons.action_items` add optional lesson-level context. Actions stay scoped to the relevant lesson and remain separate from the gating rules, so they add value without blocking the training flow.

---

## 3. Intentionally left out (for simplicity)

These were excluded from the initial Het Trade Platform 2.0 schema:

- **updates** – No dedicated “updates” or announcements table.
- **update_reads** – No read-tracking for updates.
- **payments** – No subscriptions, one-time payments, or payment history; access can be controlled later via `students.access_level` or an external system.
- **practical_lessons** – Practice is represented by `lessons.type = 'praktijk'`; no separate practical-lesson table.

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

## Market post detail, reactions and avatars (2026-10-07)

`weekly_updates.content_kind` defaults to `video`; `article` uses sanitized
`article_html` and an optional separate `intro`. Existing video identifiers,
content and author FKs remain authoritative. `author_name` is only a legacy
fallback; no display-name mapping is performed. Publication formatting uses
`Europe/Brussels` explicitly. `updated_at` is not presented as a content revision.

`market_post_reactions` has a `(post_id, student_id)` primary key and cascading
FKs. Its own-row RLS limits direct mutations; the authenticated
`set_market_post_reaction(post_id, active)` RPC is idempotent, checks published
post access and returns an aggregate plus the caller's status. The aggregate
never returns reacting identities. `can_read_market_post` mirrors the deployed
content RLS, including the dormant subscription rollout; change this function
alongside content policies if the subscription entitlement policy is activated.

`student_avatars` stores only the versioned object path. Private
`profile-avatars` Storage contains processed static WebP files, never source
uploads. Only the server service role can write. Authenticated reads require
own-profile access or an accessible post linked to that author; author RPCs
expose only name, avatar path and the linked author key. Existing private
`students` read policies are unchanged.

`avatar_objects` tracks pending/active/garbage objects. The commit RPC locks the
student and new object, swaps references atomically and marks the previous file
for cleanup. Garbage cannot become active again. Pending uploads expire after
one hour. Profile deletion queues objects before cascading avatar records. Auth account deletion removes reactions and avatar references and queues files without changing existing history retention. Deleted accounts cannot react using an unexpired JWT.
Cleanup also rediscovers orphaned Storage files, including uploads that finish after their pending record expires. Reaction inserts and avatar commits lock the live Auth account so account deletion cannot leave a new reference behind.
The server cleans up after mutations; configure a daily authenticated POST to
`/api/maintenance/avatars` with `AVATAR_CLEANUP_SECRET` for abandoned uploads and
account removals during quiet periods. Cleanup retries are safe.

`guard_student_identity` blocks client reassignment of profile identity and
self-granted access. It preserves admin changes to access levels and trusted
service integrations. All three new migrations were applied to local Supabase and
the linked HTP2 project (`swohtycdqbydqrtjzwwf`) on 7 October 2026. The missing
remote tables, RPCs and bucket caused profile-photo saves to fail. Other environments
require these versioned migrations and the server-only `SUPABASE_SERVICE_ROLE_KEY`.
Never expose that key in public environment variables. Run
`npm run verify:avatar-storage` against the target environment to check the tables,
service RPCs and private WebP-only bucket without writing files or profile data.

The upload route returns 400 for invalid images/crops and 500 for persistence
failures. Server logs retain the Supabase error and failed operation (registration,
upload or commit); responses do not expose database errors. Cross-tab notifications
are optional and cannot turn a committed upload into an apparent client-side failure.

Local verification uses synthetic data against real Auth/Postgres/Storage:
`LOCAL_SUPABASE_ENV_FILE=/tmp/local.env node --import tsx scripts/verify-market-posts-local.ts`.
Generate the env file with `supabase status -o env`; the script refuses remote
hosts. Start the local app at `http://localhost:3107` against the same Supabase.
`--keep` retains labeled fixtures for browser checks; `--cleanup` removes them.

Verification on local Supabase: 72 tests, TypeScript and the production build pass. Real Auth/Postgres/Storage integration covers own-only member/admin writes, denied forged requests, persistent counts, concurrent mutations, failed/lost-response uploads, expired pending uploads finishing late and concurrent Auth deletion. Browser checks pass at 390/768/1440 px, including chart Escape/focus restoration, member/admin crop controls, theme rendering and unchanged Vimeo iframe/playback position after reacting. The public Vimeo clip did not start continuous playback in browser automation; live signed Mux, fullscreen and subtitle playback still require end-to-end verification. Build lint has two native-image warnings: private processed avatars and the original chart viewer intentionally use `img`.

Versioned rollout files:

- `20261007000000_market_post_reactions_avatars.sql` — content fields, FKs/indexes, own-row reaction RLS/RPCs, private avatar bucket, author projection and safe commit/cleanup.
- `20261007010000_profile_identity_guard.sql` — immutable client identity and protected content access.
- `20261007020000_auth_account_media_cleanup.sql` — Auth deletion cleanup, revoked-account checks and upload/account-deletion serialization.
