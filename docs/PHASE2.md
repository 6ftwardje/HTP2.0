# Het Trade Platform 2.0 - Imported Phase 2 Summary

## Created and updated files

### New files

**Lib**
- `lib/vimeo.ts` – `extractVimeoId()`, `getVimeoEmbedUrl()` for Vimeo URLs
- `lib/progress.ts` – `getProgressByLessonIds()`, `upsertLessonProgress()`, `areAllLessonsCompleted()`
- `lib/exams.ts` – `getExamByModuleId()`, `getExamQuestions()`, `hasPassedExam()`, `getLatestExamResult()`, `insertExamResult()`
- `lib/lesson-gate.ts` – `getLessonStatuses()`, `lessonsWithStatus()` (locked/available/completed)
- `lib/module-gate.ts` – `getModuleAccessMap()`, `canAccessModule()` (unlock after previous exam passed)

**Extended**
- `lib/types.ts` – Added `Progress`, `Exam`, `ExamQuestion`, `ExamResult`, `LessonStatus`, `LessonWithStatus`
- `lib/lessons.ts` – Added `getLessonBySlug()`
- `lib/modules.ts` – Added `getModuleById()`

**Server actions**
- `app/actions/progress.ts` – `markLessonComplete(lessonId)`
- `app/actions/exam.ts` – `submitExam(examId, answers)` (scoring + insert exam_results)

**Routes**
- `app/(protected)/lessons/[slug]/page.tsx` – Lesson detail: video, completion, prev/next, locked state
- `app/(protected)/lessons/[slug]/MarkCompleteButton.tsx` – Client button to mark lesson complete
- `app/(protected)/lessons/[slug]/loading.tsx`
- `app/(protected)/modules/[slug]/exam/page.tsx` – Exam gate, questions, submit, result
- `app/(protected)/modules/[slug]/exam/ExamForm.tsx` – Client form: questions, submit, score/passed UI
- `app/(protected)/modules/[slug]/exam/loading.tsx`

**Components**
- `components/VimeoPlayer.tsx` – Vimeo embed from `video_url`; empty state when no video

**Middleware**
- `lib/supabase/middleware.ts` – Added `/lessons` to protected paths

### Updated files

- `app/(protected)/modules/[slug]/page.tsx` – Lesson status badges (Available/Locked/Completed), exam CTA, module locked state
- `app/(protected)/dashboard/page.tsx` – Module cards use `getModuleAccessMap()`; locked modules show “Locked — pass previous module exam”
- `app/(protected)/modules/page.tsx` – Same gating for module list
- `app/(protected)/account/page.tsx` – Added access level; reordered name/email

---

## Lesson locking logic

- **Source:** `lib/lesson-gate.ts` and progress data.
- **Rules:**
  - Lesson 1 in a module is always **available**.
  - Lesson N+1 is **available** only when lesson N has progress with `watched = true`.
  - Otherwise it is **locked**.
  - If a lesson has `watched = true`, its status is **completed** (even if it’s not the “next” one).
- **Flow:**
  1. Load published lessons for the module (sorted by `order_index`).
  2. Load progress for current student for those lesson IDs (`getProgressByLessonIds`).
  3. `getLessonStatuses(studentId, lessons)` walks in order: first is available or completed; each next is locked until the previous is completed, then available or completed.
- **Usage:** Module detail page shows badges and only links to non-locked lessons. Lesson page: if status is locked, show “Lesson locked” and link back to module; otherwise show video and “Mark as completed”.

---

## Module gating logic

- **Source:** `lib/module-gate.ts` and `exam_results` (passed).
- **Rules:**
  - Module 1 (lowest `order_index`) is always accessible.
  - Module N+1 is accessible only if the student has at least one **passed** result for the exam of module N.
- **Flow:**
  1. Load all published modules (sorted by `order_index`).
  2. Load passed exam results for the student (`exam_results` where `passed = true`).
  3. Load exams per module (`exams.module_id`).
  4. For each module index: index 0 → access true; index > 0 → access = previous module’s exam is in the passed set.
- **Usage:** Dashboard and modules list show locked cards (no link) for modules without access. Module detail and exam pages: if module not in access map, show “Module locked” and “Pass the previous module’s exam”.

---

## How progress is written

- **Table:** `progress` (student_id, lesson_id, watched, watched_at, …), unique on `(student_id, lesson_id)`.
- **Write path:** Student clicks “Mark as completed” on the lesson page → client calls server action `markLessonComplete(lessonId)` → action uses `ensureCurrentStudent()` then `upsertLessonProgress(student.id, lessonId)`.
- **Upsert:** `upsertLessonProgress()` does a Supabase `upsert` with `onConflict: "student_id,lesson_id"`, setting `watched: true` and `watched_at: now()`. So one row per student per lesson; repeat clicks just update.
- **Read path:** Server-side only: `getProgressByLessonIds(studentId, lessonIds)` used by lesson-gate and module/exam gates. No localStorage.

---

## How exam scoring works

- **Flow:** On exam page, student selects one answer per question and submits. Client sends `[{ questionId, selectedAnswer }, …]` to server action `submitExam(examId, answers)`.
- **Scoring:** Action loads `exam_questions` for the exam (by `order_index`). For each question, compares `selectedAnswer` to `correct_answer`. Score = (correct count / total questions) * 100, rounded. Pass = score >= exam’s `passing_score` (from DB).
- **Persistence:** Action inserts one row into `exam_results`: `student_id`, `exam_id`, `score`, `passed`, `submitted_at` (default now()). No uniqueness on (student_id, exam_id); retakes are allowed.
- **UI:** After submit, `ExamForm` shows score, “Passed” or “Not passed”, and CTAs: “Back to module”, “Continue to next module” (if passed), or “Retake exam” (if not passed).

---

## Intentionally left for phase 3

- **Payments** – Not implemented.
- **Admin tools** – No admin UI.
- **Updates / update_reads** – Not implemented.
- **Practical lessons** – Only video/content lessons.
- **Video “ended” auto-complete** – Completion is manual (“Mark as completed”); optional auto-complete on video end can be added later without changing DB.
- **Profile editing** – Account page is read-only (name, email, access level).
- **Deep link to next module** – “Continue to next module” goes to `/modules`; could later link to next module’s slug.
- **Accessibility** – Basic labels and structure; full a11y audit not done.
- **Analytics** – No tracking of time-on-lesson or exam attempts beyond `exam_results`.
