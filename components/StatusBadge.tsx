import type { LessonStatus } from "@/lib/types";

export type ModuleState = "locked" | "available" | "completed";

export function ModuleStateBadge({ state }: { state: ModuleState }) {
  const label =
    state === "completed"
      ? "Afgerond"
      : state === "available"
        ? "Beschikbaar"
        : "Vergrendeld";
  const cls =
    state === "completed"
      ? "cb-badge cb-badge-completed"
      : state === "available"
        ? "cb-badge cb-badge-available"
        : "cb-badge cb-badge-locked";
  return <span className={cls}>{label}</span>;
}

export function LessonStatusBadge({ status }: { status: LessonStatus }) {
  switch (status) {
    case "completed":
      return <span className="cb-badge cb-badge-completed">Afgerond</span>;
    case "available":
      return <span className="cb-badge cb-badge-available">Beschikbaar</span>;
    case "locked":
      return <span className="cb-badge cb-badge-locked">Vergrendeld</span>;
    default:
      return <span className="cb-badge cb-badge-locked">Vergrendeld</span>;
  }
}
