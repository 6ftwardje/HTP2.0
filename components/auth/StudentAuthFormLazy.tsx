"use client";

import { StudentAuthFormCore } from "@/components/auth/StudentAuthFormCore";

export default function StudentAuthFormLazy() {
  return (
    <StudentAuthFormCore
      getSupabaseClient={async () => {
        const { createClient } = await import("@/lib/supabase/client");
        return createClient();
      }}
    />
  );
}
