import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_BUCKET = "profile-avatars";
export const avatarPathIsValid = (path: string) => /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp$/.test(path);

export class AvatarPersistenceError extends Error {
  constructor(readonly operation: "register" | "upload" | "commit", cause: unknown) {
    super(operation === "commit"
      ? "Opslaan is niet bevestigd. Vernieuw je profiel en probeer opnieuw."
      : "Je foto kon niet worden opgeslagen. Probeer opnieuw.", { cause });
    this.name = "AvatarPersistenceError";
  }
}

/** Garbage paths cannot be committed again. A lost response never deletes active files. */
export async function cleanupAvatars(db: SupabaseClient) {
  const { data, error } = await db.rpc("claim_avatar_garbage");
  if (error) throw new Error("Avataropruiming niet beschikbaar.");
  const paths = (data ?? []).map((row: { object_path: string }) => row.object_path).filter(avatarPathIsValid);
  if (!paths.length) return;
  const removed = await db.storage.from(AVATAR_BUCKET).remove(paths);
  if (removed.error) throw new Error("Avataropruiming wordt later opnieuw geprobeerd.");
  const deleted = await db.from("avatar_objects").delete().in("object_path", paths).eq("state", "garbage");
  if (deleted.error) throw new Error("Avataropruiming wordt later opnieuw geprobeerd.");
}

export async function storeAvatar(db: SupabaseClient, identity: { userId: string; studentId: string }, bytes: Buffer, path: string) {
  if (!avatarPathIsValid(path) || !path.startsWith(`${identity.userId}/`)) throw new Error("Ongeldig opslagpad.");
  const registered = await db.from("avatar_objects").insert({ object_path: path, student_id: identity.studentId });
  if (registered.error) throw new AvatarPersistenceError("register", registered.error);
  let operation: "upload" | "commit" = "upload";
  try {
    const stored = await db.storage.from(AVATAR_BUCKET).upload(path, bytes, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
    if (stored.error) throw stored.error;
    operation = "commit";
    const committed = await db.rpc("commit_student_avatar", { p_auth_uid: identity.userId, p_path: path });
    if (committed.error) throw committed.error;
  } catch (cause) {
    // Safe even if commit succeeded but the network response was lost. Never
    // remove here: pending records expire; active records are never garbage.
    await db.from("avatar_objects").update({ state: "garbage" }).eq("object_path", path).eq("state", "pending");
    throw new AvatarPersistenceError(operation, cause);
  } finally {
    await cleanupAvatars(db).catch((error) => console.error("avatar cleanup", error.message));
  }
  return path;
}
