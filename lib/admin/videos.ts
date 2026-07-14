import { requireAdmin } from "@/lib/admin/access";
import { createClient } from "@/lib/supabase/server";
import type { Lesson, LessonType, Module } from "@/lib/types";

export type AdminLessonVideoRow = Lesson & {
  module: Pick<Module, "id" | "title" | "slug" | "order_index"> | null;
};

type LessonUpdate = Partial<
  Pick<
    Lesson,
    | "video_provider"
    | "video_url"
    | "video_duration_seconds"
    | "thumbnail_url"
    | "mux_asset_id"
    | "mux_playback_id"
    | "mux_playback_policy"
    | "mux_status"
    | "mux_upload_id"
    | "mux_error_message"
  >
>;

export type AdminModuleVideoBlock = {
  module: Module;
  lessons: AdminLessonVideoRow[];
};

export type ModuleContentInput = {
  title: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  order_index: number;
  is_published: boolean;
};

export type LessonContentInput = {
  module_id: number;
  type: LessonType;
  title: string;
  slug: string;
  description: string | null;
  takeaway: string | null;
  action_items: string[];
  thumbnail_url: string | null;
  order_index: number;
  is_published: boolean;
};

export async function listLessonsForVideoAdmin(): Promise<AdminLessonVideoRow[]> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return [];
  }

  const db = await createClient();
  const { data, error } = await db
    .from("lessons")
    .select(
      `
        *,
        module:modules (
          id,
          title,
          slug,
          order_index
        )
      `
    )
    .order("module_id", { ascending: true })
    .order("order_index", { ascending: true });

  if (error) {
    console.error("listLessonsForVideoAdmin", error.message);
    return [];
  }

  return ((data ?? []) as AdminLessonVideoRow[]).sort((a, b) => {
    const moduleOrder =
      (a.module?.order_index ?? a.module_id) - (b.module?.order_index ?? b.module_id);
    if (moduleOrder !== 0) return moduleOrder;
    return a.order_index - b.order_index;
  });
}

export async function listModulesForVideoAdmin(): Promise<Module[]> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return [];
  }

  const db = await createClient();
  const { data, error } = await db
    .from("modules")
    .select("*")
    .order("order_index", { ascending: true });

  if (error) {
    console.error("listModulesForVideoAdmin", error.message);
    return [];
  }

  return (data ?? []) as Module[];
}

export async function listModuleVideoBlocksAdmin(): Promise<AdminModuleVideoBlock[]> {
  const [modules, lessons] = await Promise.all([
    listModulesForVideoAdmin(),
    listLessonsForVideoAdmin(),
  ]);

  return modules.map((module) => ({
    module,
    lessons: lessons.filter((lesson) => lesson.module_id === module.id),
  }));
}

export async function getLessonForVideoAdmin(
  lessonId: number
): Promise<Lesson | null> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return null;
  }

  const db = await createClient();
  const { data, error } = await db
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Lesson;
}

export async function updateLessonVideoAdmin(
  lessonId: number,
  update: LessonUpdate
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { data, error } = await db
    .from("lessons")
    .update(update)
    .eq("id", lessonId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return {
      error:
        "No lesson was updated. Check that the admin content migration has been applied.",
    };
  }
  return { error: null };
}

export async function createModuleAdmin(
  input: ModuleContentInput
): Promise<{ module: Module | null; error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { module: null, error: null };
  }

  const db = await createClient();
  const { data, error } = await db
    .from("modules")
    .insert(input)
    .select("*")
    .single();

  if (error) return { module: null, error: error.message };
  return { module: data as Module, error: null };
}

export async function updateModuleAdmin(
  moduleId: number,
  input: ModuleContentInput
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { data, error } = await db
    .from("modules")
    .update(input)
    .eq("id", moduleId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return {
      error:
        "No module was updated. Check that the admin content migration has been applied.",
    };
  }
  return { error: null };
}

export async function createLessonAdmin(
  input: LessonContentInput & Partial<LessonUpdate>
): Promise<{ lesson: Lesson | null; error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { lesson: null, error: null };
  }

  const db = await createClient();
  const { data, error } = await db
    .from("lessons")
    .insert(input)
    .select("*")
    .single();

  if (error) return { lesson: null, error: error.message };
  return { lesson: data as Lesson, error: null };
}

export async function updateLessonContentAdmin(
  lessonId: number,
  input: LessonContentInput
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { data, error } = await db
    .from("lessons")
    .update(input)
    .eq("id", lessonId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return {
      error:
        "No lesson was updated. Check that the admin content migration has been applied.",
    };
  }
  return { error: null };
}

export async function reorderModulesAdmin(
  moduleIds: number[]
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { error } = await db.rpc("reorder_modules_admin", {
    module_ids: moduleIds,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function reorderLessonsAdmin(
  moduleId: number,
  lessonIds: number[]
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { error } = await db.rpc("reorder_lessons_admin", {
    target_module_id: moduleId,
    lesson_ids: lessonIds,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function normalizeModulesAdmin(): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { error } = await db.rpc("normalize_modules_admin");

  if (error) return { error: error.message };
  return { error: null };
}

export async function normalizeLessonsAdmin(
  moduleId: number
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { error } = await db.rpc("normalize_lessons_admin", {
    target_module_id: moduleId,
  });

  if (error) return { error: error.message };
  return { error: null };
}

export async function deleteLessonAdmin(
  lessonId: number
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { data, error } = await db
    .from("lessons")
    .delete()
    .eq("id", lessonId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return {
      error:
        "No lesson was deleted. Check that the admin content migration has been applied.",
    };
  }
  return { error: null };
}

export async function deleteEmptyModuleAdmin(
  moduleId: number
): Promise<{ error: string | null }> {
  await requireAdmin();

  if (process.env.NODE_ENV === "test") {
    return { error: null };
  }

  const db = await createClient();
  const { count, error: countError } = await db
    .from("lessons")
    .select("*", { count: "exact", head: true })
    .eq("module_id", moduleId);

  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) {
    return {
      error:
        "This module still has lessons. Delete or move those lessons before deleting the module.",
    };
  }

  const { data, error } = await db
    .from("modules")
    .delete()
    .eq("id", moduleId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return {
      error:
        "No module was deleted. Check that the admin content migration has been applied.",
    };
  }
  return { error: null };
}
