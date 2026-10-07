import { ADMIN_ACCESS_LEVEL } from "./constants";

export function isPlatformAdmin(
  student: { access_level: number } | null | undefined
) {
  return student?.access_level === ADMIN_ACCESS_LEVEL;
}
