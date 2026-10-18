/** Synthetic local browser acceptance. Requires HTP_PRODUCT_BOARD_FIXTURES (private JSON).
 * The fixture file contains users [{role,studentId,cookies}]. Never use production sessions.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const base = process.env.HTP_PRODUCT_BOARD_BASE_URL ?? "http://127.0.0.1:3126";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Local acceptance only");
assert.ok(process.env.HTP_PRODUCT_BOARD_FIXTURES, "Provide a private synthetic fixture file");
const fixtures = JSON.parse(readFileSync(process.env.HTP_PRODUCT_BOARD_FIXTURES, "utf8"));
const admin = fixtures.users.find(u => u.role === "admin");
assert.ok(admin);
const out = ".impeccable/review/product-board";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const checks = [], errors = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  context.setDefaultTimeout(15000);
  await context.addCookies(admin.cookies);
  const page = await context.newPage(); page.on("pageerror", e => errors.push(e.message));
  let response = await page.goto(base + "/admin/product-board", { waitUntil: "networkidle" });
  check("admin opens development board", response.status() === 200);
  check("development cards loaded", await page.locator("article").count() >= 67);
  await page.getByLabel("Fase").selectOption("F5a");
  check("phase filters development", await page.locator("article").count() < 67 && await page.locator("article").count() > 0);
  await page.getByRole("button", { name: "Filters wissen" }).click();
  await page.getByRole("searchbox").fill("zz-no-such-synthetic-item");
  check("search empty state", await page.getByRole("heading", { name: "Geen taken met deze filters" }).isVisible());
  await page.getByRole("button", { name: "Filters wissen" }).click();

  await page.getByRole("link", { name: /Teamtaken/ }).click();
  await page.getByRole("button", { name: "Taak toevoegen" }).click();
  const title = `Synthetische teamtest ${Date.now()}`;
  await page.getByLabel("Titel", { exact: true }).fill(title);
  await page.getByLabel("Omschrijving", { exact: true }).fill("Synthetische acceptatie: samen feedback verzamelen voor een eventconcept.");
  await page.getByLabel("Wanneer is dit geslaagd?").fill("Drie teamleden hebben het concept getest en hun feedback is verwerkt.");
  await page.locator('select[name="owner_id"]').selectOption(admin.studentId);
  await page.getByLabel("Deadline", { exact: true }).fill("2026-10-30");
  await page.getByRole("button", { name: "Taak opslaan", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Taak opgeslagen" }).waitFor();
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  check("create shared task", true);
  await page.reload({ waitUntil: "networkidle" });
  check("task survives reload", await page.getByRole("heading", { name: title }).count() === 1);
  await page.getByRole("button", { name: `Taak aanpassen: ${title}`, exact: true }).click();
  await page.locator('select[name="status"]').selectOption("blocked");
  await page.getByRole("button", { name: "Taak opslaan", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "wat blokkeert" }).waitFor();
  check("blocked needs next action without losing title", await page.getByLabel("Titel", { exact: true }).inputValue() === title);
  await page.getByLabel("Blokkade & volgende actie").fill("Admin vraagt de locatiebeheerder morgen om bevestiging.");
  await page.getByRole("button", { name: "Taak opslaan", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Taak opgeslagen" }).waitFor();
  await page.locator('[data-status="blocked"]').getByRole("heading", { name: title }).waitFor();
  check("move to blocked", true);
  await page.getByRole("button", { name: `Taak aanpassen: ${title}`, exact: true }).click();
  await page.locator('select[name="status"]').selectOption("done");
  await page.getByRole("button", { name: "Taak opslaan", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "bewijs" }).waitFor();
  await page.getByLabel("Bewijs of feedback", { exact: true }).fill("Synthetisch: drie tests afgerond en verbeterpunten vastgelegd in het verslag.");
  await page.getByRole("button", { name: "Taak opslaan", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Taak opgeslagen" }).waitFor();
  await page.locator('[data-status="done"]').getByRole("heading", { name: title }).waitFor();
  check("done needs outcome and evidence", true);
  await page.getByRole("button", { name: /Werkperiode instellen|Doel en feedback aanpassen/ }).click();
  await page.getByLabel("Wat willen we bereiken?").fill("Synthetische proef: het team toetst een eventconcept met drie deelnemers.");
  await page.getByLabel("Startdatum", { exact: true }).fill("2026-10-19");
  await page.getByLabel("Einddatum", { exact: true }).fill("2026-10-30");
  await page.locator('textarea[name="feedback"]').fill("Synthetische feedback: uitnodiging verduidelijken voor de volgende test.");
  await page.getByRole("button", { name: "Werkperiode opslaan", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "werkperiode en feedback opgeslagen" }).waitFor();
  await page.reload({ waitUntil: "networkidle" });
  check("shared work period and feedback persist", (await page.locator("main").innerText()).includes("het team toetst een eventconcept"));
  const second = await browser.newContext(); second.setDefaultTimeout(15000); await second.addCookies((fixtures.users.find(u => u.role === "admin2") ?? admin).cookies);
  const other = await second.newPage(); await other.goto(base + "/admin/product-board?board=team", { waitUntil: "networkidle" });
  check("task shared across browser sessions", await other.getByRole("heading", { name: title }).count() === 1);
  // Open both drafts before either admin saves. A page refresh must not rebase an old draft.
  await page.getByRole("button", { name: `Taak aanpassen: ${title}`, exact: true }).click();
  await other.getByRole("button", { name: `Taak aanpassen: ${title}`, exact: true }).click();
  const concurrentTitle = title + " bijgewerkt door tweede sessie";
  await other.getByLabel("Titel", { exact: true }).fill(concurrentTitle);
  await other.getByRole("button", { name: "Taak opslaan", exact: true }).click();
  await other.getByRole("status").filter({ hasText: "Taak opgeslagen" }).waitFor();
  await page.getByRole("button", { name: "Vernieuwen", exact: true }).click();
  await page.getByRole("heading", { name: concurrentTitle, exact: true }).waitFor();
  check("refresh retains task draft", await page.getByLabel("Titel", { exact: true }).inputValue() === title);
  await page.getByRole("button", { name: "Taak opslaan", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "intussen" }).waitFor();
  check("stale task cannot overwrite concurrent save", await page.getByRole("link", { name: "Nieuwste bord laden", exact: true }).isVisible());
  await page.screenshot({ path: `${out}/task-conflict.png` });
  await page.getByRole("link", { name: "Nieuwste bord laden", exact: true }).click();
  await page.getByRole("heading", { name: concurrentTitle, exact: true }).waitFor();
  check("task conflict recovery loads latest and closes draft", await page.locator('input[name="title"]').count() === 0);

  await other.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Doel en feedback aanpassen", exact: true }).click();
  await other.getByRole("button", { name: "Doel en feedback aanpassen", exact: true }).click();
  const latestGoal = "Synthetische proef: nieuwe gezamenlijke doelafspraak door tweede admin.";
  await other.getByLabel("Wat willen we bereiken?").fill(latestGoal);
  await other.getByRole("button", { name: "Werkperiode opslaan", exact: true }).click();
  await other.getByRole("status").filter({ hasText: "werkperiode en feedback opgeslagen" }).waitFor();
  await Promise.all([
    page.waitForResponse(r => r.url().includes("/admin/product-board") && r.request().method() === "GET", { timeout: 15000 }),
    page.getByRole("button", { name: "Vernieuwen", exact: true }).click(),
  ]);
  check("refresh retains cycle draft", (await page.getByLabel("Wat willen we bereiken?").inputValue()).includes("eventconcept"));
  await page.getByRole("button", { name: "Werkperiode opslaan", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "intussen" }).waitFor();
  check("cycle keeps loaded revision after refresh", await page.getByRole("link", { name: "Nieuwste bord laden", exact: true }).isVisible());
  await page.screenshot({ path: `${out}/cycle-conflict.png` });
  await page.getByRole("link", { name: "Nieuwste bord laden", exact: true }).click();
  await page.getByText(latestGoal, { exact: true }).waitFor();
  check("cycle conflict recovery preserves concurrent goal", await page.locator('textarea[name="goal"]').count() === 0);
  await second.close();

  for (const [size, width, theme, board] of [["desktop",1440,"dark","development"],["mobile",390,"dark","development"],["desktop-light",1440,"light","team"],["mobile-light",390,"light","team"]]) {
    await page.setViewportSize({ width, height: 1050 });
    await page.addInitScript(t => localStorage.setItem("htp-theme", t), theme);
    await page.goto(base + "/admin/product-board" + (board === "team" ? "?board=team" : ""), { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal { display:none !important; }" });
    check(`${size} no page overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${out}/${size}.png`, fullPage: true });
  }
  check("no browser errors", errors.length === 0);
  for (const role of ["student", "free"]) {
    const user = fixtures.users.find(u => u.role === role); if (!user) continue;
    const ctx = await browser.newContext(); await ctx.addCookies(user.cookies);
    const p = await ctx.newPage(); response = await p.goto(base + "/admin/product-board", { waitUntil: "networkidle" });
    check(`${role} denied direct board route`, response.status() === 404);
    check(`${role} sees no board contents`, !(await p.content()).includes(title)); await ctx.close();
  }
  const anon = await browser.newContext(); const p = await anon.newPage(); await p.goto(base + "/admin/product-board", { waitUntil: "networkidle" });
  check("anonymous login redirect", new URL(p.url()).pathname === "/login"); await anon.close();
  writeFileSync(`${out}/acceptance.json`, JSON.stringify({ checks, errors }, null, 2));
  console.log(`${checks.length} local browser checks passed; screenshots: ${out}`);
} finally { await browser.close(); }
