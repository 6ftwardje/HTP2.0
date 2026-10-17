/** Browser acceptance against actual local-only Supabase fixture accounts.
 * LOCAL_CHAT_FEATURE_FIXTURE_FILE=/tmp/htp-chat-feature-fixtures.json \
 * CHAT_FEATURE_TEST_BASE_URL=http://127.0.0.1:3114 node scripts/verify-chat-features-browser.mjs
 * First run verify-chat-features-local.ts --keep. Uses installed Chrome, no mocked app data.
 */
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { chromium } from "playwright";
import sharp from "sharp";

const base = process.env.CHAT_FEATURE_TEST_BASE_URL ?? "http://127.0.0.1:3114";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname), "Browser acceptance refuses remote apps.");
const fixtureFile = process.env.LOCAL_CHAT_FEATURE_FIXTURE_FILE ?? "/tmp/htp-chat-feature-fixtures.json";
const state = JSON.parse(readFileSync(fixtureFile, "utf8"));
assert.equal(state.users.length, 5, "Run local chat-feature verification --keep first.");
const [student, otherStudent, defaultMentor, secondMentor] = state.users;
const browser = await chromium.launch({ channel: "chrome", headless: true });
const contexts = [];
const runtimeErrors = [];
mkdirSync("output/playwright", { recursive: true });
async function session(user, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({ viewport }); contexts.push(context);
  await context.addCookies(user.cookie.split("; ").filter(Boolean).map((item) => {
    const separator = item.indexOf("="); return { name: item.slice(0, separator), value: item.slice(separator + 1), domain: new URL(base).hostname, path: "/", httpOnly: false, secure: false, sameSite: "Lax" };
  }));
  const page = await context.newPage(); page.on("pageerror", (error) => runtimeErrors.push(error.message));
  return { context, page };
}
async function hasText(page, text) { await page.getByText(text, { exact: true }).first().waitFor({ state: "visible", timeout: 25000 }); }
async function select(page, mentor) {
  const link = page.getByRole("navigation", { name: "Kies je mentor" }).getByRole("link", { name: new RegExp(mentor.name) });
  await link.click(); await page.waitForURL(`**/mentor?mentor=${mentor.studentId}`);
  await page.getByRole("region", { name: `Privégesprek met ${mentor.name}` }).waitFor();
  await page.waitForFunction((id) => document.querySelector(`nav[aria-label="Kies je mentor"] a[aria-current="page"]`)?.getAttribute("href")?.endsWith(id), mentor.studentId);
}
async function profile(page, name, expectedRole) {
  const button = page.getByRole("button", { name: `Profiel van ${name} bekijken`, exact: true }).first();
  await page.bringToFront();
  await page.waitForFunction((name) => {
    const button = [...document.querySelectorAll("button")].find((element) => element.getAttribute("aria-label") === `Profiel van ${name} bekijken`);
    return button && Object.keys(button).some((key) => key.startsWith("__reactProps$") && typeof button[key]?.onClick === "function");
  }, name);
  await button.click(); const dialog = page.getByRole("dialog", { name: "Gebruikersprofiel" });
  await dialog.getByRole("heading", { name, exact: true }).waitFor();
  await dialog.getByText(expectedRole, { exact: true }).waitFor();
  assert.equal(await dialog.getByText(/@example.invalid/).count(), 0, "profile excludes private email");
  await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
  assert.ok(await button.evaluate((element) => element === document.activeElement), "Escape restores the originating profile button focus");
}
try {
  const studentSession = await session(student), page = studentSession.page;
  await page.goto(`${base}/mentor`, { waitUntil: "domcontentloaded" });
  await page.getByRole("navigation", { name: "Kies je mentor" }).waitFor({ timeout: 60000 });
  await hasText(page, "Vraag voor Rousso"); await hasText(page, "Antwoord van Rousso");
  assert.equal(await page.getByRole("log", { name: "Berichten" }).getByText("Vraag voor Elena", { exact: true }).count(), 0);
  const photos = page.getByRole("log", { name: "Berichten" }).locator('img[src^="/api/avatars/"]');
  assert.equal(await photos.count(), 2, "both incoming and outgoing messages use real account avatars");
  await photos.first().waitFor(); await page.waitForFunction(() => [...document.querySelectorAll('[role="log"] img')].every((image) => image.complete && image.naturalWidth > 0));
  await profile(page, defaultMentor.name, "Mentor");
  await page.locator("#mentor-message").fill("Concept voor Rousso");
  await select(page, secondMentor); await hasText(page, "Vraag voor Elena");
  assert.equal(await page.locator("#mentor-message").inputValue(), "", "first mentor draft never appears for second mentor");
  assert.equal(await page.getByRole("log").getByText("Vraag voor Rousso", { exact: true }).count(), 0);
  assert.equal(await page.getByRole("log").getByText("Interne notitie Elena", { exact: true }).count(), 0);
  await page.locator("#mentor-message").fill("Concept voor Elena");
  await select(page, defaultMentor); assert.equal(await page.locator("#mentor-message").inputValue(), "Concept voor Rousso");
  await select(page, secondMentor); assert.equal(await page.locator("#mentor-message").inputValue(), "Concept voor Elena");
  await page.reload({ waitUntil: "domcontentloaded" }); await page.locator("#mentor-message").waitFor();
  await page.waitForFunction(() => document.querySelector("#mentor-message")?.value === "Concept voor Elena");
  console.log("PASS: real student opens mentor profile with Escape/focus, both account photos load, mentor histories/internal notes remain separate and per-mentor drafts survive switching/reload.");

  const mentorSession = await session(secondMentor), mentorPage = mentorSession.page;
  await mentorPage.goto(`${base}/mentor-inbox?thread=${state.threadIds[1]}`, { waitUntil: "domcontentloaded" });
  await mentorPage.locator("#mentor-reply").waitFor({ timeout: 60000 });
  await profile(mentorPage, student.name, "Student");
  const response = `Live browserantwoord ${Date.now()}`;
  await mentorPage.locator("#mentor-reply").fill(response); await mentorPage.getByRole("button", { name: "Verzenden", exact: true }).click();
  await hasText(mentorPage, response); await hasText(page, response);
  assert.equal(await page.getByRole("log").getByText("Interne notitie Elena", { exact: true }).count(), 0);
  await page.bringToFront(); await page.getByRole("navigation", { name: "Kies je mentor" }).getByRole("link", { name: new RegExp(secondMentor.name) }).getByRole("img", { name: "Online", exact: true }).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: `Profiel van ${secondMentor.name} bekijken`, exact: true }).first().click();
  await page.getByRole("dialog").getByText("Online", { exact: true }).waitFor({ timeout: 20000 }); await page.keyboard.press("Escape");
  console.log("PASS: mentor opens actual student profile, sends a real reply visible in the student's separate browser session, and dynamic online status appears in mentor menu/profile.");

  for (const width of [1440, 768, 390]) {
    const responsive = await session(student, { width, height: width === 390 ? 844 : 1000 });
    await responsive.page.goto(`${base}/mentor?mentor=${secondMentor.studentId}`, { waitUntil: "networkidle" });
    await responsive.page.locator("#mentor-message").waitFor();
    await responsive.page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const layout = await responsive.page.evaluate(() => {
      const button = [...document.querySelectorAll('button[type="submit"]')].find((node) => node.textContent.includes("Verzenden"));
      const box = button?.getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth, box: box?.toJSON(), hit: box ? button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)) : false };
    });
    assert.ok(layout.scroll <= layout.width, `no horizontal page overflow at ${width}px`);
    assert.ok(layout.box && layout.box.top >= 0 && layout.box.bottom <= layout.height && layout.hit, `full send control visible and actual hit target at ${width}px`);
    await responsive.page.screenshot({ path: `output/playwright/chat-features-student-${width}.png`, fullPage: false });
    if (width === 390) {
      await profile(responsive.page, secondMentor.name, "Mentor");
      await responsive.page.getByRole("button", { name: "Dark mode inschakelen" }).click();
      await responsive.page.getByRole("button", { name: `Profiel van ${secondMentor.name} bekijken`, exact: true }).first().click();
      await responsive.page.getByRole("dialog").getByRole("heading", { name: secondMentor.name }).waitFor();
      await responsive.page.screenshot({ path: "output/playwright/chat-features-profile-mobile-dark.png", fullPage: false });
    }
    await responsive.context.close();
  }
  await mentorPage.screenshot({ path: "output/playwright/chat-features-mentor-1440.png", fullPage: true });
  console.log("PASS: 1440, 768 and 390px keep composer visible without horizontal overflow; desktop/mobile screenshots saved.");

  const empty = await session(otherStudent); await empty.page.goto(`${base}/mentor?mentor=${secondMentor.studentId}`, { waitUntil: "domcontentloaded" });
  await hasText(empty.page, "Waar kan ik je mee helpen?");
  await empty.page.waitForFunction(() => {
    const input = document.querySelector('input[type="file"]');
    return input && Object.keys(input).some((key) => key.startsWith("__reactProps$") && typeof input[key]?.onChange === "function");
  });
  const chart = await sharp({ create: { width: 800, height: 450, channels: 3, background: "#426b99" } }).png().toBuffer();
  await empty.page.locator('input[type="file"]').setInputFiles({ name: "Lokale testchart.png", mimeType: "image/png", buffer: chart });
  await empty.page.getByRole("list", { name: "Toegevoegde screenshots" }).getByText("Lokale testchart.webp", { exact: true }).waitFor();
  await empty.page.locator("#mentor-message").fill("Eerste vraag in nieuwe mentorconversatie");
  await empty.page.getByRole("button", { name: "Verzenden", exact: true }).click();
  await hasText(empty.page, "Eerste vraag in nieuwe mentorconversatie");
  await empty.page.getByRole("link", { name: "Screenshot openen: Lokale testchart.webp" }).waitFor();
  // Select immediately on the committed first message; let queued refreshes settle only after navigation.
  await select(empty.page, defaultMentor); await hasText(empty.page, "Waar kan ik je mee helpen?");
  await empty.page.waitForLoadState("networkidle");
  assert.equal(new URL(empty.page.url()).searchParams.get("mentor"), defaultMentor.studentId, "late send refreshes cannot override a newer mentor selection");
  assert.equal(await empty.page.getByRole("log").getByText("Eerste vraag in nieuwe mentorconversatie", { exact: true }).count(), 0);
  await select(empty.page, secondMentor); await hasText(empty.page, "Eerste vraag in nieuwe mentorconversatie");
  console.log("PASS: first message with a screenshot creates a real pair conversation; an immediate mentor switch persists after queued refreshes and history is restored on return.");

  await mentorSession.context.close();
  await page.bringToFront();
  await page.getByRole("navigation", { name: "Kies je mentor" }).getByRole("link", { name: new RegExp(secondMentor.name) }).getByRole("img", { name: "Online", exact: true }).waitFor({ state: "hidden", timeout: 85000 });
  console.log("PASS: closing the mentor browser session removes the online indicator after clean leave/server lease expiry.");
  assert.deepEqual(runtimeErrors, [], "no browser runtime errors");
  console.log("PASS: full extended chat browser flow completed using real local authenticated users, database records and private Storage images.");
} catch (error) {
  for (const [index, context] of contexts.entries()) {
    const page = context.pages()[0]; if (!page) continue;
    console.error(`Browser failure context ${index}: ${page.url()}; dialogs=${await page.locator("dialog").allTextContents()}`);
    await page.screenshot({ path: `output/playwright/chat-features-failure-${index}.png`, fullPage: true }).catch(() => {});
  }
  throw error;
} finally { await Promise.all(contexts.map((context) => context.close())); await browser.close(); }
