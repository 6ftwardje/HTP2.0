import type { Lesson } from "@/lib/types";
import type { LessonStatus } from "@/lib/types";
import { getProgressByLessonIds } from "@/lib/progress";

/**
 * Compute lesson statuses for a list of lessons (same module, sorted by order_index).
 * Rules: first is available; lesson N+1 is available only when lesson N is completed.
 */
export async function getLessonStatuses(
  studentId: string,
  lessons: Lesson[]
): Promise<Map<number, LessonStatus>> {
  const map = new Map<number, LessonStatus>();
  if (lessons.length === 0) return map;

  const lessonIds = lessons.map((l) => l.id);
  const progress = await getProgressByLessonIds(studentId, lessonIds);

  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    const prog = progress.get(lesson.id);
    const completed = prog?.watched === true;

    if (i === 0) {
      map.set(lesson.id, completed ? "completed" : "available");
    } else {
      const prevCompleted = progress.get(lessons[i - 1].id)?.watched === true;
      if (completed) {
        map.set(lesson.id, "completed");
      } else if (prevCompleted) {
        map.set(lesson.id, "available");
      } else {
        map.set(lesson.id, "locked");
      }
    }
  }
  return map;
}

/**
 * Given lessons and their statuses, return lessons with status attached.
 */
export function lessonsWithStatus(
  lessons: Lesson[],
  statusMap: Map<number, LessonStatus>
): Array<Lesson & { status: LessonStatus }> {
  return lessons.map((l) => ({
    ...l,
    status: statusMap.get(l.id) ?? "locked",
  }));
}
