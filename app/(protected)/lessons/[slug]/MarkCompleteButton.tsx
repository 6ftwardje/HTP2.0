"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { markLessonComplete } from "@/app/actions/progress";

export function MarkCompleteButton({ lessonId }: { lessonId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    const result = await markLessonComplete(lessonId);
    if (result.success) {
      router.refresh();
    } else {
      setError(result.error ?? "Er ging iets mis.");
    }
    setLoading(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="cb-btn cb-btn-primary inline-flex disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? "Opslaan..." : "Markeer les als afgerond"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
