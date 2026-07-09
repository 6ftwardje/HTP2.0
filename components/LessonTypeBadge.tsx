import type { LessonType } from "@/lib/types";

type LessonTypeMeta = {
  label: string;
  sectionTitle: string;
  description: string;
  className: string;
};

export const LESSON_TYPE_META: Record<LessonType, LessonTypeMeta> = {
  theorie: {
    label: "Theorie",
    sectionTitle: "Theorie",
    description: "Concepten en uitleg",
    className:
      "border-sky-400/40 bg-sky-500/10 text-sky-800 dark:border-sky-300/30 dark:bg-sky-300/10 dark:text-sky-200",
  },
  praktijk: {
    label: "Praktijk",
    sectionTitle: "Praktijk",
    description: "Toepassing en voorbeelden",
    className:
      "border-emerald-400/40 bg-emerald-500/10 text-emerald-800 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-200",
  },
};

export function normalizeLessonType(value: unknown): LessonType {
  return value === "praktijk" ? "praktijk" : "theorie";
}

function LessonTypeIcon({
  type,
  className = "h-3.5 w-3.5",
}: {
  type: LessonType;
  className?: string;
}) {
  if (type === "praktijk") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path
          d="M4 19h16M7 16l3.2-4.1 3 2.5L18 7"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15 7h3v3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M5 5.5A2.5 2.5 0 0 1 7.5 3H20v16H7.5A2.5 2.5 0 0 0 5 21.5v-16Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 7h8M8 10.5h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function LessonTypeBadge({
  type,
  className = "",
}: {
  type: LessonType;
  className?: string;
}) {
  const normalizedType = normalizeLessonType(type);
  const meta = LESSON_TYPE_META[normalizedType];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[0.68rem] font-bold uppercase tracking-[0.12em] ${meta.className} ${className}`}
    >
      <LessonTypeIcon type={normalizedType} />
      {meta.label}
    </span>
  );
}

export function LessonTypeSectionIcon({
  type,
  className = "h-5 w-5",
}: {
  type: LessonType;
  className?: string;
}) {
  return <LessonTypeIcon type={normalizeLessonType(type)} className={className} />;
}
