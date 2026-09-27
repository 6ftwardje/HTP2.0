type PublicStudent = { name: string | null; email: string };

function usableName(name: string | null | undefined) {
  const value = name?.trim();
  return value && value.toLocaleLowerCase("nl-BE") !== "onbekend" ? value : null;
}

export function publicAuthorName(student: PublicStudent): string {
  const emailName = student.email.split("@")[0]?.trim();
  return (usableName(student.name) || emailName || "HTP-team").slice(0, 120);
}

export function marketUpdateAuthorName(update: {
  content_format: "video" | "chart" | "text";
  published_by_display_name?: string | null;
  mentor: { name: string | null } | null;
}): string {
  if (update.content_format === "video") {
    return usableName(update.mentor?.name) || "HTP Mentor";
  }
  return usableName(update.published_by_display_name) || "HTP-team";
}
