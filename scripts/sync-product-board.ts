/** Read-only GitHub refresh. Never creates issues or changes project statuses. */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { normalizeProjectEntry, PROJECT_URL, type ProjectEntry } from "../lib/product-board";

const raw = JSON.parse(execFileSync("gh", ["project", "item-list", "3", "--owner", "6ftwardje", "--format", "json", "--limit", "2000"], { encoding: "utf8" }));
if (!Array.isArray(raw.items) || raw.items.length < raw.totalCount) throw new Error("Onvolledige GitHub-export; bestaande snapshot blijft behouden.");
const items = (raw.items as ProjectEntry[]).filter(item => !item.content?.repository || item.content.repository === "6ftwardje/HTP2.0").map(normalizeProjectEntry);
mkdirSync("lib/data", { recursive: true });
writeFileSync("lib/data/development-board.json", JSON.stringify({ syncedAt: new Date().toISOString(), projectUrl: PROJECT_URL, items }, null, 2) + "\n");
console.log(`${items.length} projectkaarten gelezen en lokale momentopname vernieuwd. Geen GitHub-writes.`);
