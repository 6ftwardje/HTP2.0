"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminArchiveExamQuestion,
  adminSaveExamQuestion,
  adminSetExamQuestionActive,
} from "@/app/actions/admin/exams";
import type {
  AdminExamManagementData,
  AdminExamModuleSummary,
  AdminExamQuestion,
} from "@/lib/admin/exams";

type DraftOption = {
  key: string;
  id?: number;
  optionText: string;
  isCorrect: boolean;
};

type DraftQuestion = {
  id?: number;
  moduleId: number;
  questionText: string;
  explanation: string;
  isActive: boolean;
  options: DraftOption[];
};

function fieldClass() {
  return "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[color-mix(in_oklab,var(--foreground)_35%,var(--border))]";
}

function iconButtonClass(tone: "normal" | "danger" = "normal") {
  return `inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
    tone === "danger"
      ? "border-red-500/20 text-red-700 hover:bg-red-500/10 dark:text-red-300"
      : "border-[var(--border)] text-[var(--muted)] hover:bg-[color-mix(in_oklab,var(--card)_70%,var(--foreground)_6%)] hover:text-[var(--foreground)]"
  }`;
}

function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: "plus" | "edit" | "trash" | "check" | "search";
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    "aria-hidden": true,
  };

  if (name === "edit") {
    return (
      <svg {...common}>
        <path d="m4 16.8-.7 3.9 3.9-.7L18.9 8.3 15.7 5.1 4 16.8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m14.6 6.2 3.2 3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "trash") {
    return (
      <svg {...common}>
        <path d="M5 7h14M9 7V5h6v2m-8 0 .8 13h8.4L17 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "check") {
    return (
      <svg {...common}>
        <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "search") {
    return (
      <svg {...common}>
        <path d="m20 20-4.5-4.5M10.8 17a6.2 6.2 0 1 1 0-12.4 6.2 6.2 0 0 1 0 12.4Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function blankOptions(): DraftOption[] {
  return [0, 1, 2, 3].map((index) => ({
    key: crypto.randomUUID(),
    optionText: "",
    isCorrect: index === 0,
  }));
}

function createDraft(moduleId: number): DraftQuestion {
  return {
    moduleId,
    questionText: "",
    explanation: "",
    isActive: true,
    options: blankOptions(),
  };
}

function draftFromQuestion(question: AdminExamQuestion): DraftQuestion {
  return {
    id: question.id,
    moduleId: question.module_id,
    questionText: question.question_text,
    explanation: question.explanation ?? "",
    isActive: question.is_active,
    options: question.options.map((option) => ({
      key: `option-${option.id}`,
      id: option.id,
      optionText: option.option_text,
      isCorrect: option.is_correct,
    })),
  };
}

function validateDraft(draft: DraftQuestion): string | null {
  if (!draft.questionText.trim()) return "Question text is required.";
  if (draft.options.some((option) => !option.optionText.trim())) {
    return "Answer options cannot be empty.";
  }
  if (draft.options.length < 2) return "Add at least two answer options.";
  if (draft.options.filter((option) => option.isCorrect).length !== 1) {
    return "Mark exactly one answer as correct.";
  }
  return null;
}

function ModuleStatus({ summary }: { summary: AdminExamModuleSummary }) {
  const ready = summary.validActiveQuestionCount >= 10;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <span className={ready ? "cb-badge cb-badge-completed" : "cb-badge cb-badge-locked"}>
        {summary.validActiveQuestionCount}/10 valid active
      </span>
      <span className="cb-badge cb-badge-available">
        {summary.activeQuestionCount} active
      </span>
      <span className="cb-badge cb-badge-locked">
        {summary.totalQuestionCount} total
      </span>
    </div>
  );
}

export function AdminExamManager({ data }: { data: AdminExamManagementData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedModuleId, setSelectedModuleId] = useState(
    data.modules[0]?.module.id ?? 0
  );
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<DraftQuestion | null>(
    data.modules[0] ? createDraft(data.modules[0].module.id) : null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedModuleId && data.modules[0]) {
      setSelectedModuleId(data.modules[0].module.id);
      setDraft(createDraft(data.modules[0].module.id));
    }
  }, [data.modules, selectedModuleId]);

  const selectedModule = data.modules.find(
    (summary) => summary.module.id === selectedModuleId
  );
  const moduleQuestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.questions
      .filter((question) => question.module_id === selectedModuleId)
      .filter((question) =>
        query ? question.question_text.toLowerCase().includes(query) : true
      );
  }, [data.questions, search, selectedModuleId]);

  function chooseModule(moduleId: number) {
    setSelectedModuleId(moduleId);
    setDraft(createDraft(moduleId));
    setError(null);
    setMessage(null);
  }

  function editQuestion(question: AdminExamQuestion) {
    setDraft(draftFromQuestion(question));
    setError(null);
    setMessage(null);
  }

  function updateOption(key: string, patch: Partial<DraftOption>) {
    if (!draft) return;
    setDraft({
      ...draft,
      options: draft.options.map((option) =>
        option.key === key ? { ...option, ...patch } : option
      ),
    });
  }

  function markCorrect(key: string) {
    if (!draft) return;
    setDraft({
      ...draft,
      options: draft.options.map((option) => ({
        ...option,
        isCorrect: option.key === key,
      })),
    });
  }

  function removeOption(key: string) {
    if (!draft || draft.options.length <= 2) return;
    const nextOptions = draft.options.filter((option) => option.key !== key);
    if (!nextOptions.some((option) => option.isCorrect)) {
      nextOptions[0] = { ...nextOptions[0], isCorrect: true };
    }
    setDraft({ ...draft, options: nextOptions });
  }

  function saveDraft() {
    if (!draft) return;
    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await adminSaveExamQuestion({
        id: draft.id,
        moduleId: draft.moduleId,
        questionText: draft.questionText,
        explanation: draft.explanation,
        isActive: draft.isActive,
        options: draft.options.map((option) => ({
          id: option.id,
          optionText: option.optionText,
          isCorrect: option.isCorrect,
        })),
      });

      if (!res.success) {
        setError(res.error ?? "Could not save question.");
        return;
      }

      setMessage(draft.id ? "Question saved." : "Question added.");
      setDraft(createDraft(draft.moduleId));
      router.refresh();
    });
  }

  function setQuestionActive(question: AdminExamQuestion, isActive: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await adminSetExamQuestionActive(question.id, isActive);
      if (!res.success) {
        setError(res.error ?? "Could not update question.");
        return;
      }
      setMessage(isActive ? "Question activated." : "Question deactivated.");
      router.refresh();
    });
  }

  function setDraftQuestionActive(isActive: boolean) {
    if (!draft?.id) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await adminSetExamQuestionActive(draft.id, isActive);
      if (!res.success) {
        setError(res.error ?? "Could not update question.");
        return;
      }
      setDraft({ ...draft, isActive });
      setMessage(isActive ? "Question activated." : "Question deactivated.");
      router.refresh();
    });
  }

  function archiveQuestion(question: AdminExamQuestion) {
    const confirmed = window.confirm(
      "Archive this question? Historical attempts stay intact, but students will no longer receive it."
    );
    if (!confirmed) return;

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await adminArchiveExamQuestion(question.id);
      if (!res.success) {
        setError(res.error ?? "Could not archive question.");
        return;
      }
      setMessage("Question archived.");
      if (draft?.id === question.id) setDraft(createDraft(question.module_id));
      router.refresh();
    });
  }

  if (!selectedModule || !draft) {
    return (
      <div className="cb-panel p-6">
        <p className="cb-caption">No modules found.</p>
      </div>
    );
  }

  const validWarning = selectedModule.validActiveQuestionCount < 10;

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <div className="cb-panel p-5">
          <label className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Module
            </span>
            <select
              value={selectedModuleId}
              onChange={(event) => chooseModule(Number(event.currentTarget.value))}
              className={fieldClass()}
            >
              {data.modules.map((summary) => (
                <option key={summary.module.id} value={summary.module.id}>
                  {summary.module.order_index}. {summary.module.title}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-5 border-t border-[var(--border)] pt-5">
            <div className="cb-eyebrow">Question bank</div>
            <h2 className="mt-2 text-xl font-extrabold text-[var(--foreground)]">
              {selectedModule.module.title}
            </h2>
            <ModuleStatus summary={selectedModule} />
            {validWarning && (
              <p className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                Add {10 - selectedModule.validActiveQuestionCount} more valid active{" "}
                {10 - selectedModule.validActiveQuestionCount === 1 ? "question" : "questions"} before students can start.
              </p>
            )}
          </div>
        </div>

        <div className="cb-panel p-5">
          <div className="flex items-center gap-2">
            <Icon name="search" className="h-4 w-4 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search questions"
              className="w-full bg-transparent text-sm font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
            />
          </div>
        </div>

        <div className="space-y-3">
          {moduleQuestions.length === 0 ? (
            <div className="cb-panel p-5">
              <p className="cb-caption">No questions for this module yet.</p>
            </div>
          ) : (
            moduleQuestions.map((question) => {
              const correctCount = question.options.filter((option) => option.is_correct).length;
              const invalid = question.options.length < 2 || correctCount !== 1;
              return (
                <article key={question.id} className="cb-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => editQuestion(question)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="line-clamp-2 text-sm font-bold leading-6 text-[var(--foreground)]">
                        {question.question_text}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={question.is_active ? "cb-badge cb-badge-completed" : "cb-badge cb-badge-locked"}>
                          {question.is_active ? "Active" : "Inactive"}
                        </span>
                        {invalid && <span className="cb-badge cb-badge-locked">Invalid</span>}
                        {question.attemptCount > 0 && (
                          <span className="cb-badge cb-badge-available">
                            {question.attemptCount} attempts
                          </span>
                        )}
                      </div>
                    </button>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className={iconButtonClass()}
                        onClick={() => setQuestionActive(question, !question.is_active)}
                        aria-label={question.is_active ? "Deactivate question" : "Activate question"}
                      >
                        <Icon name="check" />
                      </button>
                      <button
                        type="button"
                        className={iconButtonClass()}
                        onClick={() => editQuestion(question)}
                        aria-label="Edit question"
                      >
                        <Icon name="edit" />
                      </button>
                      <button
                        type="button"
                        className={iconButtonClass("danger")}
                        onClick={() => archiveQuestion(question)}
                        aria-label="Archive question"
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </aside>

      <section className="cb-panel overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="cb-eyebrow">{draft.id ? "Edit question" : "New question"}</div>
              <h2 className="mt-1 text-xl font-extrabold text-[var(--foreground)]">
                Exam question editor
              </h2>
            </div>
            <button
              type="button"
              className="cb-btn cb-btn-secondary"
              onClick={() => setDraft(createDraft(selectedModuleId))}
              disabled={isPending}
            >
              <Icon name="plus" />
              New question
            </button>
          </div>
        </div>

        <div className="grid gap-5 p-5">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Question
            </span>
            <textarea
              value={draft.questionText}
              onChange={(event) =>
                setDraft({ ...draft, questionText: event.currentTarget.value })
              }
              rows={4}
              className={fieldClass()}
            />
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              Explanation
            </span>
            <textarea
              value={draft.explanation}
              onChange={(event) =>
                setDraft({ ...draft, explanation: event.currentTarget.value })
              }
              rows={3}
              className={fieldClass()}
            />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2.5">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) =>
                setDraft({ ...draft, isActive: event.currentTarget.checked })
              }
              className="h-4 w-4"
            />
            <span className="text-sm font-semibold text-[var(--foreground)]">
              Active question
            </span>
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                Answer options
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-bold text-[var(--foreground)] hover:bg-[color-mix(in_oklab,var(--card)_70%,var(--foreground)_6%)]"
                onClick={() =>
                  setDraft({
                    ...draft,
                    options: [
                      ...draft.options,
                      {
                        key: crypto.randomUUID(),
                        optionText: "",
                        isCorrect: false,
                      },
                    ],
                  })
                }
              >
                <Icon name="plus" />
                Add option
              </button>
            </div>

            {draft.options.map((option, index) => (
              <div
                key={option.key}
                className="grid gap-3 rounded-lg border border-[var(--border)] p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <button
                  type="button"
                  onClick={() => markCorrect(option.key)}
                  className={[
                    "inline-flex h-10 w-10 items-center justify-center rounded-lg border",
                    option.isCorrect
                      ? "border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_15%,var(--card))] text-[var(--foreground)]"
                      : "border-[var(--border)] text-[var(--muted)]",
                  ].join(" ")}
                  aria-label={`Mark option ${index + 1} correct`}
                >
                  {option.isCorrect && <Icon name="check" />}
                </button>
                <input
                  value={option.optionText}
                  onChange={(event) =>
                    updateOption(option.key, {
                      optionText: event.currentTarget.value,
                    })
                  }
                  placeholder={`Option ${index + 1}`}
                  className={fieldClass()}
                />
                <button
                  type="button"
                  className={iconButtonClass("danger")}
                  onClick={() => removeOption(option.key)}
                  disabled={draft.options.length <= 2}
                  aria-label={`Remove option ${index + 1}`}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>

          {draft.id && (
            <div className="flex flex-wrap gap-3 border-t border-[var(--border)] pt-5">
              <button
                type="button"
                className="cb-btn cb-btn-secondary"
                disabled={isPending}
                onClick={() => setDraftQuestionActive(!draft.isActive)}
              >
                {draft.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-800 dark:text-red-200">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              {message}
            </p>
          )}

          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="cb-btn cb-btn-secondary"
              disabled={isPending}
              onClick={() => setDraft(createDraft(selectedModuleId))}
            >
              Cancel
            </button>
            <button
              type="button"
              className="cb-btn cb-btn-primary"
              disabled={isPending}
              onClick={saveDraft}
            >
              {isPending ? "Saving..." : "Save question"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
