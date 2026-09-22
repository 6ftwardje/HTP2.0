import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const backlogDir = join(root, ".github", "backlog");
const mode = process.argv[2] ?? "--check";

if (!['--check', '--apply'].includes(mode)) {
  throw new Error("Gebruik --check of --apply.");
}

function parseIssue(path) {
  const source = readFileSync(path, "utf8");
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]+)$/);
  if (!match) throw new Error(`${path}: frontmatter ontbreekt.`);
  const meta = Object.fromEntries(match[1].split("\n").filter(Boolean).map((line) => {
    const index = line.indexOf(":");
    if (index < 1) throw new Error(`${path}: ongeldige frontmatterregel.`);
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
  const dependencies = meta.depends_on === "none" ? [] : (meta.depends_on ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  return { ...meta, dependencies, body: match[2].trim() + "\n", path };
}

const issues = readdirSync(backlogDir)
  .filter((name) => /^[A-Z]\d+\.\d+\.md$/.test(name))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((name) => parseIssue(join(backlogDir, name)));

const errors = [];
const byCode = new Map();
for (const issue of issues) {
  if (!/^[A-Z]\d+\.\d+$/.test(issue.code ?? "")) errors.push(`${issue.path}: ongeldige code.`);
  if (basename(issue.path, ".md") !== issue.code) errors.push(`${issue.path}: bestandsnaam en code verschillen.`);
  if (!issue.title) errors.push(`${issue.path}: titel ontbreekt.`);
  if (!['XS', 'S', 'M'].includes(issue.estimate)) errors.push(`${issue.path}: inschatting moet XS, S of M zijn.`);
  if (byCode.has(issue.code)) errors.push(`Dubbele lokale taakcode ${issue.code}.`);
  byCode.set(issue.code, issue);
  for (const heading of ["## Resultaat en zakelijke reden", "## Afbakening", "## Acceptatiecriteria", "## Afhankelijkheden en blokkades", "## Inschatting", "## Risico’s, aannames en menselijke beslissingen", "## Zelfstandige uitvoerprompt"]) {
    if (!issue.body.includes(heading)) errors.push(`${issue.code}: sectie '${heading}' ontbreekt.`);
  }
}
for (const issue of issues) {
  for (const dependency of issue.dependencies) {
    if (!byCode.has(dependency)) errors.push(`${issue.code}: onbekende afhankelijkheid ${dependency}.`);
    if (dependency === issue.code) errors.push(`${issue.code}: taak hangt van zichzelf af.`);
  }
}

const visiting = new Set();
const visited = new Set();
function visit(code) {
  if (visiting.has(code)) return errors.push(`Cyclische afhankelijkheid bij ${code}.`);
  if (visited.has(code) || !byCode.has(code)) return;
  visiting.add(code);
  for (const dependency of byCode.get(code).dependencies) visit(dependency);
  visiting.delete(code);
  visited.add(code);
}
for (const code of byCode.keys()) visit(code);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`Lokale backlog geldig: ${issues.length} unieke, uitvoerbare slices.`);

if (mode === "--check") process.exit(0);
if (process.env.ALLOW_GITHUB_WRITES !== "1") {
  throw new Error("Remote writes geblokkeerd. Zet ALLOW_GITHUB_WRITES=1 na expliciete toestemming.");
}

function gh(args, options = {}) {
  return execFileSync("gh", args, { cwd: root, encoding: "utf8", stdio: options.capture ? "pipe" : "inherit" });
}

gh(["auth", "status"]);
for (const [name, color, description] of [
  ["backlog", "1D76DB", "Geordende uitvoerslice"],
  ["status:todo", "D4C5F9", "Klaar om op te nemen"],
  ["status:in-progress", "FBCA04", "Er is een sluitende PR geopend"],
  ["status:done", "0E8A16", "Afgerond en gesloten"],
]) gh(["label", "create", name, "--color", color, "--description", description, "--force"]);

const remote = JSON.parse(gh(["issue", "list", "--state", "all", "--limit", "500", "--json", "number,title"], { capture: true }));
const remoteByCode = new Map();
for (const issue of remote) {
  const match = issue.title.match(/^\[([A-Z]\d+\.\d+)\]/);
  if (!match) continue;
  const list = remoteByCode.get(match[1]) ?? [];
  list.push(issue);
  remoteByCode.set(match[1], list);
}
for (const [code, matches] of remoteByCode) {
  if (matches.length > 1) throw new Error(`Remote synchronisatie gestopt: dubbele taakcode ${code} in issues ${matches.map((item) => `#${item.number}`).join(", ")}.`);
}

for (const issue of issues) {
  const title = `[${issue.code}] ${issue.title}`;
  const existing = remoteByCode.get(issue.code)?.[0];
  if (existing) {
    gh(["issue", "edit", String(existing.number), "--title", title, "--body", issue.body, "--add-label", "backlog"]);
    console.log(`Bijgewerkt: #${existing.number} ${title}`);
  } else {
    gh(["issue", "create", "--title", title, "--body", issue.body, "--label", "backlog,status:todo"]);
    console.log(`Aangemaakt: ${title}`);
  }
}
