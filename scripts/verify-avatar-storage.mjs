import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

// Read-only deployment check. Never uploads files or changes profile data.
nextEnv.loadEnvConfig(process.cwd());

async function verify() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  for (const [table, columns] of [["avatar_objects", "object_path,student_id,state,created_at"], ["student_avatars", "student_id,object_path,updated_at"]]) {
    // GET rather than HEAD: a missing PostgREST table can otherwise look successful.
    const { error } = await db.from(table).select(columns).limit(0);
    if (error) throw new Error(`${table}: ${error.code} ${error.message}. Apply the avatar migrations.`);
  }

  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw new Error(`Supabase schema check failed (${response.status}).`);
  const schema = await response.json();
  for (const rpc of ["commit_student_avatar", "claim_avatar_garbage"]) {
    if (!schema.paths?.[`/rpc/${rpc}`]) throw new Error(`Missing ${rpc}. Apply the avatar migrations.`);
  }

  const { data: bucket, error } = await db.storage.getBucket("profile-avatars");
  if (error) throw new Error(`profile-avatars: ${error.message}. Apply the avatar migrations.`);
  if (!bucket || bucket.public || bucket.file_size_limit !== 1024 * 1024 || bucket.allowed_mime_types?.length !== 1 || bucket.allowed_mime_types[0] !== "image/webp") {
    throw new Error("profile-avatars must be private, allow only image/webp and limit files to 1 MB.");
  }
  console.log(`Avatar storage verified on ${new URL(url).host}: tables, RPCs and private WebP bucket are ready.`);
}

verify().catch((error) => {
  console.error(error instanceof Error ? error.message : "Avatar storage verification failed.");
  process.exitCode = 1;
});
