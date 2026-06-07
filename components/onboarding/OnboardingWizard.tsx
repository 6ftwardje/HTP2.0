"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveOnboarding } from "@/app/actions/onboarding";
import type { StudentOnboardingResponse } from "@/lib/types";

type IntakeValues = {
  experience_level: string;
  primary_market: string;
  main_challenge: string;
  goal_90_days: string;
  weekly_time_commitment: string;
  mentorship_interest: string;
  confidence_score: string;
};

type Option = {
  value: string;
  label: string;
  description?: string;
};

type Step = {
  id: keyof IntakeValues;
  eyebrow: string;
  question: string;
  reason: string;
  type: "options" | "textarea" | "scale";
  placeholder?: string;
  options?: Option[];
};

const steps: Step[] = [
  {
    id: "experience_level",
    eyebrow: "Ervaring",
    question: "Waar sta je vandaag als trader?",
    reason:
      "Je mentor gebruikt dit om feedback op het juiste niveau te geven en geen stappen over te slaan.",
    type: "options",
    options: [
      {
        value: "beginner",
        label: "Beginner",
        description: "Ik ben nog structuur en basisbegrippen aan het opbouwen.",
      },
      {
        value: "some_experience",
        label: "Ik heb al wat ervaring",
        description: "Ik trade of analyseer al, maar mis nog consistentie.",
      },
      {
        value: "intermediate",
        label: "Intermediate",
        description: "Ik heb een proces, maar wil scherper worden in uitvoering.",
      },
      {
        value: "advanced",
        label: "Advanced",
        description: "Ik wil vooral finetunen, reviewen en optimaliseren.",
      },
    ],
  },
  {
    id: "primary_market",
    eyebrow: "Markt",
    question: "Op welke markt focus je vooral?",
    reason:
      "Marktcontext helpt mentors en toekomstige AI-begeleiding om voorbeelden en feedback relevanter te maken.",
    type: "options",
    options: [
      { value: "crypto", label: "Crypto" },
      { value: "forex", label: "Forex" },
      { value: "indices", label: "Indices" },
      { value: "stocks", label: "Aandelen" },
      { value: "not_sure", label: "Nog niet zeker" },
    ],
  },
  {
    id: "main_challenge",
    eyebrow: "Huidige uitdaging",
    question: "Waar loop je op dit moment het meest op vast?",
    reason:
      "Dit laat je mentor sneller zien waar begeleiding nu het meeste verschil maakt.",
    type: "textarea",
    placeholder:
      "Bijvoorbeeld: geen structuur, te snel instappen, risk management, FOMO, entries herkennen...",
  },
  {
    id: "goal_90_days",
    eyebrow: "Doel",
    question: "Wat wil je binnen 90 dagen concreet verbeteren?",
    reason:
      "Een concreet doel maakt je traject meetbaar en helpt ons gerichter opvolgen.",
    type: "textarea",
    placeholder:
      "Bijvoorbeeld: mijn trades beter plannen, Fibonacci correct toepassen, minder impulsieve trades nemen...",
  },
  {
    id: "weekly_time_commitment",
    eyebrow: "Tijd",
    question: "Hoeveel tijd kun je realistisch per week besteden?",
    reason:
      "Dan kunnen we begeleiding en verwachtingen afstemmen op je echte beschikbare tijd.",
    type: "options",
    options: [
      { value: "0_2", label: "0-2 uur" },
      { value: "3_5", label: "3-5 uur" },
      { value: "6_10", label: "6-10 uur" },
      { value: "10_plus", label: "10+ uur" },
    ],
  },
  {
    id: "mentorship_interest",
    eyebrow: "Begeleiding",
    question: "Welke begeleiding helpt jou het meest?",
    reason:
      "Zo krijgen mentors context over de manier waarop jij het beste vooruitgang boekt.",
    type: "options",
    options: [
      {
        value: "self_paced",
        label: "Zelfstandig leren",
        description: "Ik wil vooral rustig door de modules werken.",
      },
      {
        value: "group_calls",
        label: "Groepscalls / Q&A",
        description: "Ik leer goed door vragen en voorbeelden van anderen.",
      },
      {
        value: "personal_feedback",
        label: "Persoonlijke feedback",
        description: "Ik wil feedback op charts, keuzes en uitvoering.",
      },
      {
        value: "mentorship",
        label: "Mentorship traject",
        description: "Ik wil intensiever opgevolgd worden.",
      },
    ],
  },
  {
    id: "confidence_score",
    eyebrow: "Zelfinschatting",
    question: "Hoe zeker voel je je momenteel over je tradingproces?",
    reason:
      "Dit helpt ons later beter inschatten of je vooral kennis, structuur of vertrouwen nodig hebt.",
    type: "scale",
    options: [
      { value: "1", label: "1", description: "Heel onzeker" },
      { value: "2", label: "2" },
      { value: "3", label: "3" },
      { value: "4", label: "4" },
      { value: "5", label: "5", description: "Zeer zeker" },
    ],
  },
];

function initialValues(response: StudentOnboardingResponse | null): IntakeValues {
  return {
    experience_level: response?.experience_level ?? "",
    primary_market: response?.primary_market ?? "",
    main_challenge: response?.main_challenge ?? "",
    goal_90_days: response?.goal_90_days ?? "",
    weekly_time_commitment: response?.weekly_time_commitment ?? "",
    mentorship_interest: response?.mentorship_interest ?? "",
    confidence_score: response?.confidence_score
      ? String(response.confidence_score)
      : "",
  };
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="cb-btn cb-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Intake opslaan..." : "Intake afronden"}
    </button>
  );
}

export function OnboardingWizard({
  response,
  error,
}: {
  response: StudentOnboardingResponse | null;
  error?: "incomplete" | "save_failed";
}) {
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<IntakeValues>(() =>
    initialValues(response)
  );
  const current = steps[index];
  const progress = ((index + 1) / steps.length) * 100;
  const currentValue = values[current.id];
  const canContinue = currentValue.trim().length > 0;
  const isLast = index === steps.length - 1;
  const completedCount = useMemo(
    () => steps.filter((step) => values[step.id].trim()).length,
    [values]
  );

  function setValue(id: keyof IntakeValues, value: string) {
    setValues((prev) => ({ ...prev, [id]: value }));
  }

  return (
    <form action={saveOnboarding} className="h-full min-h-0">
      {Object.entries(values).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}

      <div className="flex h-full min-h-0 w-full flex-col justify-center">
        <div className="mb-6">
          <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.13em] text-[var(--muted)]">
            <span>
              Vraag {index + 1} van {steps.length}
            </span>
            <span>{completedCount}/{steps.length} ingevuld</span>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-sm bg-white/[0.08]">
            <div
              className="h-full rounded-sm bg-[var(--accent)] transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <section className="rounded-xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--card)_88%,var(--background)_12%)] p-5 sm:p-7">
          <p className="cb-eyebrow text-[var(--accent)]">{current.eyebrow}</p>
          <h1 className="mt-4 text-2xl font-extrabold leading-tight text-[var(--foreground)] sm:text-[1.95rem]">
            {current.question}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {current.reason}
          </p>

          {error && (
            <p className="mt-5 rounded-lg border border-[color-mix(in_oklab,#fca5a5_38%,var(--border))] bg-red-500/[0.08] px-4 py-3 text-sm font-semibold text-red-100">
              {error === "save_failed"
                ? "Je intake kon niet worden opgeslagen. Probeer het opnieuw of contacteer support als dit blijft gebeuren."
                : "Vul alle intakevragen in voordat je de videocourse opent."}
            </p>
          )}

          <div className="mt-6">
            {current.type === "textarea" ? (
              <textarea
                value={currentValue}
                onChange={(event) => setValue(current.id, event.target.value)}
                rows={4}
                placeholder={current.placeholder}
                className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-base leading-7 text-[var(--foreground)] outline-none transition placeholder:text-[color-mix(in_oklab,var(--muted)_68%,transparent)] focus:border-[color-mix(in_oklab,var(--accent)_58%,var(--border))]"
              />
            ) : current.type === "scale" ? (
              <div className="grid grid-cols-5 gap-2 sm:gap-3">
                {current.options?.map((option) => {
                  const selected = currentValue === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setValue(current.id, option.value)}
                      className={[
                        "flex min-h-20 flex-col items-center justify-center rounded-lg border px-2 py-3 text-center transition-colors",
                        selected
                          ? "border-[color-mix(in_oklab,var(--accent)_70%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_13%,var(--card))] text-[var(--foreground)]"
                          : "border-[var(--border)] bg-white/[0.02] text-[var(--muted)] hover:border-[color-mix(in_oklab,var(--foreground)_22%,var(--border))] hover:text-[var(--foreground)]",
                      ].join(" ")}
                    >
                      <span className="text-xl font-extrabold">{option.label}</span>
                      {option.description && (
                        <span className="mt-2 text-[0.7rem] leading-4">
                          {option.description}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                {current.options?.map((option) => {
                  const selected = currentValue === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setValue(current.id, option.value)}
                      className={[
                        "flex w-full items-start justify-between gap-5 rounded-lg border px-4 py-3 text-left transition-colors",
                        selected
                          ? "border-[color-mix(in_oklab,var(--accent)_70%,var(--border))] bg-[color-mix(in_oklab,var(--accent)_11%,var(--card))]"
                          : "border-[var(--border)] bg-white/[0.018] hover:border-[color-mix(in_oklab,var(--foreground)_22%,var(--border))]",
                      ].join(" ")}
                    >
                      <span>
                        <span className="block text-sm font-semibold text-[var(--foreground)]">
                          {option.label}
                        </span>
                        {option.description && (
                          <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">
                            {option.description}
                          </span>
                        )}
                      </span>
                      <span
                        className={[
                          "mt-0.5 h-4 w-4 shrink-0 rounded-full border",
                          selected
                            ? "border-[var(--accent)] bg-[var(--accent)]"
                            : "border-[var(--border)]",
                        ].join(" ")}
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
            disabled={index === 0}
            className="cb-btn cb-btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Vorige
          </button>

          {isLast ? (
            <SubmitButton disabled={!canContinue} />
          ) : (
            <button
              type="button"
              onClick={() =>
                canContinue &&
                setIndex((prev) => Math.min(steps.length - 1, prev + 1))
              }
              disabled={!canContinue}
              className="cb-btn cb-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Verder
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
