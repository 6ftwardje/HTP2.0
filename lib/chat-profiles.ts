/** Minimal projection returned by the role-checked chat RPCs. Never include contact or billing data. */
export type ChatProfile = {
  studentId: string;
  displayName: string;
  role: "student" | "mentor" | "admin";
  avatarPath: string | null;
};

export type ChatMentor = ChatProfile & {
  threadId: string | null;
  unreadCount: number;
};

export function chatInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join("").toLocaleUpperCase("nl-BE") || "?";
}

export function chatProfileRole(role: ChatProfile["role"]) {
  return role === "admin" ? "Admin" : role === "mentor" ? "Mentor" : "Student";
}
