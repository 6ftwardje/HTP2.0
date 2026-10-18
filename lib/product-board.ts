export const BOARD_STATUSES = ["todo", "doing", "review", "done", "blocked"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];
export type BoardKind = "development" | "team";
export const STATUS_LABELS: Record<BoardStatus, string> = {
  todo: "Te doen", doing: "Bezig", review: "Te controleren", done: "Klaar", blocked: "Geblokkeerd",
};
export type BoardItem = {
  id: string; title: string; description: string; result: string; proof: string;
  status: BoardStatus; sourceStatus: string; priority: string; phase: string;
  owner: string; ownerId: string | null; dueDate: string | null;
  url: string | null; blocker: string; version: number;
};
export type BoardCycle = {
  board: BoardKind; goal: string; starts_on: string | null; ends_on: string | null;
  feedback: string; version: number;
};
export type AdminOption = { id: string; name: string };
export type DevelopmentSnapshot = { syncedAt: string; projectUrl: string; items: BoardItem[] };
export const PROJECT_URL = "https://github.com/users/6ftwardje/projects/3";

export function projectStatus(value: string): BoardStatus {
  switch (value.toLowerCase()) {
    case "backlog": case "ready": case "todo": return "todo";
    case "in uitvoering": case "in progress": return "doing";
    case "te controleren": case "in review": return "review";
    case "done": return "done";
    // An unknown status must never silently count as work that is ready or done.
    default: return "blocked";
  }
}

export type ProjectEntry = {
  id: string; title?: string; status?: string; prioriteit?: string; "hTP-fase"?: string;
  assignees?: string[]; content?: { title?: string; body?: string; url?: string; repository?: string };
};
export function normalizeProjectEntry(entry: ProjectEntry): BoardItem {
  const body = entry.content?.body ?? "";
  const result = body.match(/\*\*Resultaat:\*\*\s*([^\n]+)/)?.[1]
    ?? body.match(/## Resultaat\s*\n([^#]+)/)?.[1]?.trim() ?? "";
  const title = entry.title ?? entry.content?.title ?? "Zonder titel";
  const sourceStatus = entry.status ?? "Onbekende status";
  // Expose the product outcome, not internal execution prompts or local paths.
  return {
    id: entry.id, title, description: result, result, proof: "",
    status: projectStatus(sourceStatus), sourceStatus, priority: entry.prioriteit ?? "",
    phase: entry["hTP-fase"] ?? "Overig", owner: entry.assignees?.join(", ") ?? "",
    ownerId: null, dueDate: null,
    url: /^https:\/\/github\.com\/6ftwardje\/HTP2\.0\/issues\/\d+$/.test(entry.content?.url ?? "") ? entry.content!.url! : null,
    blocker: projectStatus(sourceStatus) === "blocked" ? "Bekijk de blokkade en volgende actie in het GitHub-project." : "",
    version: 0,
  };
}

export function isBoardKind(value: unknown): value is BoardKind { return value === "development" || value === "team"; }
export function isStatus(value: unknown): value is BoardStatus { return BOARD_STATUSES.includes(value as BoardStatus); }
export function validUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
const field = (data: FormData, key: string) => typeof data.get(key) === "string" ? String(data.get(key)).trim() : "";

export function parseTask(data: FormData) {
  const title = field(data, "title"), description = field(data, "description"), result = field(data, "result"), proof = field(data, "proof");
  const status = field(data, "status"), priority = field(data, "priority"), blocker = field(data, "blocker");
  const ownerId = field(data, "owner_id"), dueDate = field(data, "due_date");
  if (title.length < 3 || title.length > 160) return { error: "Geef de taak een titel van 3 tot 160 tekens." };
  if ([description, result, proof, blocker].some(v => v.length > 3000)) return { error: "Gebruik maximaal 3.000 tekens per tekstveld." };
  if (!isStatus(status) || !["P1", "P2", "P3"].includes(priority)) return { error: "Kies een geldige status en prioriteit." };
  if (ownerId && !validUuid(ownerId)) return { error: "Kies een geldige eigenaar." };
  if (dueDate && !validDate(dueDate)) return { error: "Kies een geldige deadline." };
  if (status === "blocked" && blocker.length < 5) return { error: "Noteer wat blokkeert en wat de volgende actie is." };
  if (status === "done" && (result.length < 5 || proof.length < 5)) return { error: "Vul het verwachte resultaat en het bewijs of de feedback in voordat je de taak afrondt." };
  return { value: { title, description, result, proof, status, priority, blocker: status === "blocked" ? blocker : "", owner_id: ownerId || null, due_date: dueDate || null } };
}

export function parseCycle(data: FormData) {
  const board = field(data, "board"), goal = field(data, "goal"), starts_on = field(data, "starts_on"), ends_on = field(data, "ends_on"), feedback = field(data, "feedback");
  if (!isBoardKind(board)) return { error: "Onbekend bord." };
  if (goal.length < 5 || goal.length > 1000 || feedback.length > 3000) return { error: "Beschrijf het doel in 5 tot 1.000 tekens en gebruik maximaal 3.000 tekens voor feedback." };
  if (!validDate(starts_on) || !validDate(ends_on) || ends_on < starts_on) return { error: "Kies een geldige werkperiode met een einddatum op of na de startdatum." };
  return { value: { board, goal, starts_on, ends_on, feedback } };
}
