"use client";

import { useEffect, useState } from "react";

export function ConfirmEmailButton({ label }: { label: string }) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="cb-btn cb-btn-primary w-full disabled:opacity-60"
      onClick={(event) => {
        // Submit natively before disabling; the flow also works without JS.
        const form = event.currentTarget.form;
        if (form && !pending) {
          event.preventDefault();
          setPending(true);
          form.submit();
        }
      }}>
      {pending ? "Bevestigen..." : label}
    </button>
  );
}
