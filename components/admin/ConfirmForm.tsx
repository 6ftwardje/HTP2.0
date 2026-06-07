"use client";

import type { ReactNode } from "react";

/**
 * Wraps a server action in a form that asks for confirmation before submit.
 */
export function ConfirmForm({
  action,
  confirmMessage,
  children,
  className,
}: {
  /** Server actions may return a result object; we ignore it here. */
  action: (formData: FormData) => void | Promise<unknown>;
  confirmMessage: string;
  children: ReactNode;
  className?: string;
}) {
  const run: (formData: FormData) => void | Promise<void> = async (fd) => {
    await action(fd);
  };

  return (
    <form
      action={run}
      className={className}
      onSubmit={(e) => {
        if (typeof window !== "undefined" && !window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}
