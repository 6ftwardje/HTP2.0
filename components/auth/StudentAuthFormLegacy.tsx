"use client";

import { StudentAuthFormCore } from "@/components/auth/StudentAuthFormCore";
import { createClient } from "@/lib/supabase/client";

export default function StudentAuthFormLegacy() {
  return (
    <StudentAuthFormCore
      getSupabaseClient={async () => createClient()}
    />
  );
}
