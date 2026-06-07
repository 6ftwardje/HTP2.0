import fs from "node:fs";

const LIVE_PROJECT_REF = "trogwrgxxhsvixzglzpn";

function loadLocalEnv() {
  if (!fs.existsSync(".env.local")) return {};

  return Object.fromEntries(
    fs
      .readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}

const env = { ...loadLocalEnv(), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."
  );
}

const projectRef = new URL(url).hostname.split(".")[0];
const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
};

async function getRows(table, query = "select=*") {
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, { headers });
  if (!response.ok) {
    throw new Error(`${table}: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function getApiSchema() {
  const response = await fetch(`${url}/rest/v1/`, { headers });
  if (!response.ok) {
    throw new Error(`schema: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function getCount(table) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
    headers: { ...headers, Prefer: "count=exact", Range: "0-0" },
  });
  if (response.status === 404) return "missing";
  if (!response.ok) {
    throw new Error(`${table}: ${response.status} ${await response.text()}`);
  }
  return response.headers.get("content-range")?.split("/")[1] ?? "?";
}

function findDuplicateKeys(rows, keyForRow) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyForRow(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1);
}

console.log(`Supabase project-ref: ${projectRef}`);
console.log(
  projectRef === LIVE_PROJECT_REF
    ? "Target status: LIVE LEGACY PROJECT - do not run clone migrations here."
    : "Target status: non-live target."
);

const schema = await getApiSchema();
const definitions = schema.definitions ?? {};
const hasColumn = (table, column) => Boolean(definitions[table]?.properties?.[column]);
const moduleOrderColumn = hasColumn("modules", "order")
  ? "order"
  : hasColumn("modules", "order_index")
    ? "order_index"
    : null;
const lessonOrderColumn = hasColumn("lessons", "order")
  ? "order"
  : hasColumn("lessons", "order_index")
    ? "order_index"
    : null;
const bridgeCompatible =
  moduleOrderColumn === "order" &&
  lessonOrderColumn === "order" &&
  Boolean(definitions.practical_lessons);

console.log(
  bridgeCompatible
    ? "Bridge status: compatible legacy schema."
    : "Bridge status: NOT a legacy clone - do not run the legacy bridge."
);

for (const table of [
  "students",
  "modules",
  "lessons",
  "practical_lessons",
  "exams",
  "exam_questions",
  "exam_results",
  "progress",
]) {
  console.log(`${table}: ${await getCount(table)}`);
}

const [modules, lessons, exams, progress] = await Promise.all([
  getRows("modules", `select=id,${moduleOrderColumn}`),
  getRows("lessons", `select=id,module_id,${lessonOrderColumn}`),
  getRows("exams", "select=id,module_id"),
  getRows("progress", "select=id,student_id,lesson_id"),
]);

const checks = [
  [
    "duplicate module order",
    findDuplicateKeys(modules, (row) => String(row[moduleOrderColumn])),
  ],
  [
    "duplicate lesson module/order",
    findDuplicateKeys(
      lessons,
      (row) => `${row.module_id}:${row[lessonOrderColumn]}`
    ),
  ],
  [
    "duplicate exam module",
    findDuplicateKeys(exams, (row) => String(row.module_id)),
  ],
  [
    "duplicate progress student/lesson",
    findDuplicateKeys(progress, (row) => `${row.student_id}:${row.lesson_id}`),
  ],
];

let failed = false;
for (const [label, duplicates] of checks) {
  if (duplicates.length === 0) {
    console.log(`${label}: none`);
    continue;
  }

  failed = true;
  console.log(`${label}: ${JSON.stringify(duplicates)}`);
}

if (failed) {
  throw new Error("Pre-flight integrity checks failed.");
}
