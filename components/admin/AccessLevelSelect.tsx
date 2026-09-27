"use client";

import { useEffect, useState, useTransition } from "react";
import { adminUpdateStudentAccessLevel } from "@/app/actions/admin/students";
import {
  ALLOWED_ACCESS_LEVELS,
  ADMIN_ACCESS_LEVEL,
} from "@/lib/admin/constants";
export function AccessLevelSelect({
  studentId,
  value,
  actorStudentId,
  variant = "default",
}: {
  studentId: string;
  value: number;
  actorStudentId: string;
  variant?: "default" | "inline";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(value);

  const isSelf = studentId === actorStudentId;

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const onChange = (next: string) => {
    const n = Number(next);
    setLocal(n);
    setError(null);

    if (n !== value && n < ADMIN_ACCESS_LEVEL && !isSelf) {
      const ok = window.confirm(
        "Toegang verlagen? Deze student verliest rechten die bij een hoger niveau horen."
      );
      if (!ok) {
        setLocal(value);
        return;
      }
    }

    startTransition(async () => {
      const res = await adminUpdateStudentAccessLevel(studentId, n);
      if (!res.success) {
        setError(res.error ?? "Toegang wijzigen mislukt.");
        setLocal(value);
        return;
      }
    });
  };

  const base =
    variant === "inline"
      ? "rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm font-semibold text-[var(--foreground)]"
      : "w-full max-w-xs rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm font-semibold text-[var(--foreground)]";

  return (
    <div className="space-y-1">
      <label className="sr-only" htmlFor={`access-${studentId}`}>
        Toegangsniveau
      </label>
      <select
        id={`access-${studentId}`}
        className={base}
        disabled={pending}
        value={local}
        onChange={(e) => onChange(e.target.value)}
      >
        {ALLOWED_ACCESS_LEVELS.map((lvl) => (
          <option
            key={lvl}
            value={lvl}
            disabled={
              isSelf &&
              value === ADMIN_ACCESS_LEVEL &&
              lvl < ADMIN_ACCESS_LEVEL
            }
          >
            {lvl === 1 ? "Basis (niveau 1)" : lvl === 2 ? "Volledige cursus (niveau 2)" : "Admin (niveau 3)"}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      {isSelf && value === ADMIN_ACCESS_LEVEL && (
        <p className="cb-caption text-xs">
          Een andere admin moet jouw adminrechten wijzigen.
        </p>
      )}
    </div>
  );
}

export function AccessLevelBadge({ level }: { level: number }) {
  const isAdmin = level === ADMIN_ACCESS_LEVEL;
  return (
    <span
      className={
        isAdmin
          ? "cb-badge border border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-100"
          : "cb-badge cb-badge-locked"
      }
    >
      {isAdmin ? "Admin" : level === 2 ? "Volledige cursus" : "Basis"}
    </span>
  );
}
