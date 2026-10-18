import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProjectEntry, parseCycle, parseTask, projectStatus, validDate } from "../../lib/product-board";

function form(patch: Record<string, string> = {}) {
  const result = new FormData();
  Object.entries({ title: "Feedbacksessie voorbereiden", description: "", result: "", proof: "", status: "todo", priority: "P2", ...patch }).forEach(([k,v]) => result.set(k,v));
  return result;
}
test("project statuses preserve review and blocked; unknown states never imply completion", () => {
  assert.equal(projectStatus("Backlog"), "todo"); assert.equal(projectStatus("Ready"), "todo");
  assert.equal(projectStatus("In uitvoering"), "doing"); assert.equal(projectStatus("Te controleren"), "review");
  assert.equal(projectStatus("Done"), "done"); assert.equal(projectStatus("Geblokkeerd"), "blocked");
  assert.equal(projectStatus("New workflow state"), "blocked");
});
test("GitHub cards expose outcomes and safe repository links without internal execution prompts", () => {
  const card = normalizeProjectEntry({ id: "x", status: "Te controleren", content: { title: "PDF openen", body: "Internal prompt /private/file\n- **Resultaat:** Een lid kan de PDF openen.\nSecret-ish private implementation detail", url: "https://github.com/6ftwardje/HTP2.0/issues/80" } });
  assert.equal(card.description, "Een lid kan de PDF openen."); assert.equal(card.status, "review");
  assert.ok(card.url); assert.doesNotMatch(JSON.stringify(card), /private|Secret-ish/);
  assert.equal(normalizeProjectEntry({ id: "draft", content: { url: "javascript:alert(1)" } }).url, null);
});
test("tasks need evidence before done and an actionable explanation when blocked", () => {
  assert.ok(parseTask(form()).value);
  assert.ok(parseTask(form({ status: "done", result: "Een getest resultaat" })).error);
  assert.ok(parseTask(form({ status: "done", result: "Een getest resultaat", proof: "Besproken en goedgekeurd in de sessie" })).value);
  assert.ok(parseTask(form({ status: "blocked" })).error);
  assert.ok(parseTask(form({ status: "blocked", blocker: "Ward beslist morgen over de locatie." })).value);
  assert.ok(parseTask(form({ status: "admin" })).error);
  assert.ok(parseTask(form({ owner_id: "not-a-person" })).error);
  assert.ok(parseTask(form({ due_date: "2026-02-30" })).error);
  assert.ok(parseTask(form({ description: "a".repeat(3001) })).error);
  assert.equal(parseTask(form({ blocker: "An old blocker", status: "doing" })).value?.blocker, "");
});
test("work periods validate board, real dates, ordering and bounded feedback", () => {
  const data = form({ board: "team", goal: "Het team kan de flow testen.", starts_on: "2026-10-19", ends_on: "2026-10-30" });
  assert.ok(parseCycle(data).value);
  data.set("ends_on", "2026-10-18"); assert.ok(parseCycle(data).error);
  data.set("ends_on", "2026-10-30"); data.set("board", "public"); assert.ok(parseCycle(data).error);
  assert.equal(validDate("2026-02-29"), false); assert.equal(validDate("2028-02-29"), true);
});
