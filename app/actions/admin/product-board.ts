"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/access";
import { logAdminAction } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";
import { parseCycle, parseTask, validUuid } from "@/lib/product-board";

export type BoardActionResult = { success: boolean; error?: string; conflict?: boolean };
const conflict = "Iemand heeft dit intussen aangepast. Je invoer is niet opgeslagen. Laad de nieuwste versie voordat je verdergaat.";
const unavailable = "Opslaan lukt niet. Probeer opnieuw of laat de bordmigratie controleren.";

export async function saveTeamTask(id: string | null, version: number, data: FormData): Promise<BoardActionResult> {
  const { actorStudent } = await requireAdmin();
  if ((id !== null && !validUuid(id)) || !Number.isSafeInteger(version) || version < 0) return { success: false, error: "Ongeldige taak." };
  const parsed = parseTask(data);
  if (!parsed.value) return { success: false, error: parsed.error };
  const db = await createClient();
  if (parsed.value.owner_id) {
    const owner = await db.from("students").select("id").eq("id", parsed.value.owner_id).eq("access_level", 3).maybeSingle();
    if (owner.error || !owner.data) return { success: false, error: "Deze eigenaar is geen actieve admin. Kies een andere eigenaar." };
  }
  const query = id
    ? db.from("product_board_tasks").update({ ...parsed.value, version: version + 1 }).eq("id", id).eq("version", version)
    : db.from("product_board_tasks").insert({ ...parsed.value, created_by: actorStudent.id });
  const saved = await query.select("id").maybeSingle();
  if (saved.error) return { success: false, error: unavailable };
  if (!saved.data) return { success: false, error: conflict, conflict: true };
  await logAdminAction(id ? "product_board.task_updated" : "product_board.task_created", { actorStudentId: actorStudent.id, metadata: { taskId: saved.data.id, status: parsed.value.status } });
  revalidatePath("/admin/product-board");
  return { success: true };
}

export async function saveBoardCycle(version: number, data: FormData): Promise<BoardActionResult> {
  const { actorStudent } = await requireAdmin();
  if (!Number.isSafeInteger(version) || version < 0) return { success: false, error: "Ongeldige werkperiode." };
  const parsed = parseCycle(data);
  if (!parsed.value) return { success: false, error: parsed.error };
  const db = await createClient();
  const saved = await db.from("product_board_cycles").update({ ...parsed.value, version: version + 1 }).eq("board", parsed.value.board).eq("version", version).select("board").maybeSingle();
  if (saved.error) return { success: false, error: unavailable };
  if (!saved.data) return { success: false, error: conflict, conflict: true };
  await logAdminAction("product_board.cycle_updated", { actorStudentId: actorStudent.id, metadata: { board: parsed.value.board } });
  revalidatePath("/admin/product-board");
  return { success: true };
}
