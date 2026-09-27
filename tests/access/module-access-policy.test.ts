import assert from "node:assert/strict";
import test from "node:test";
import {
  buildModuleEntitlementMap,
  canOpenLessonWithIntake,
  chooseNextAvailableModule,
} from "../../lib/module-access-policy.ts";

const modules = [
  { id: 40, order_index: 4 },
  { id: 20, order_index: 2 },
  { id: 10, order_index: 1 },
  { id: 30, order_index: 3 },
];

test("a new free account gets only the first module preview", () => {
  const access = buildModuleEntitlementMap(modules, false, 1);
  assert.deepEqual([...access.entries()], [
    [10, true], [20, false], [30, false], [40, false],
  ]);
  assert.equal(canOpenLessonWithIntake({ accessLevel: 1, intakeComplete: false, isFirstModule: true, isFirstLesson: true }), true);
  assert.equal(canOpenLessonWithIntake({ accessLevel: 1, intakeComplete: false, isFirstModule: true, isFirstLesson: false }), false);
  assert.equal(canOpenLessonWithIntake({ accessLevel: 1, intakeComplete: false, isFirstModule: false, isFirstLesson: true }), false);
});

test("intake opens three free modules, never the paid fourth module", () => {
  const access = buildModuleEntitlementMap(modules, true, 1);
  assert.deepEqual([...access.values()], [true, true, true, false]);
  assert.equal(canOpenLessonWithIntake({ accessLevel: 1, intakeComplete: true, isFirstModule: false, isFirstLesson: false }), true);
});

test("a one-time legacy grant preserves only the named paid module", () => {
  const legacyAccessModuleIds = new Set([40]);
  const access = buildModuleEntitlementMap(modules, false, 1, legacyAccessModuleIds);
  assert.deepEqual([...access.values()], [true, false, false, true]);
  assert.equal(canOpenLessonWithIntake({
    accessLevel: 1,
    intakeComplete: false,
    isFirstModule: false,
    isFirstLesson: false,
    hasLegacyModuleAccess: true,
  }), true);
  assert.equal(buildModuleEntitlementMap(modules, true, 1).get(40), false);
});

test("full-course and admin accounts retain access without intake", () => {
  for (const accessLevel of [2, 3]) {
    const access = buildModuleEntitlementMap(modules, false, accessLevel);
    assert.deepEqual([...access.values()], [true, true, true, true]);
    assert.equal(canOpenLessonWithIntake({ accessLevel, intakeComplete: false, isFirstModule: false, isFirstLesson: false }), true);
  }
});

test("dashboard resumes a grandfathered module before an untouched preview", () => {
  const summaries = [
    { module: { id: 10 }, state: "available", completedLessons: 0 },
    { module: { id: 40 }, state: "available", completedLessons: 1 },
  ];
  assert.equal(chooseNextAvailableModule(summaries, true, new Set([40]))?.module.id, 40);
  assert.equal(chooseNextAvailableModule(summaries, false, new Set())?.module.id, 40);
  assert.equal(chooseNextAvailableModule(summaries.map((summary) => ({ ...summary, completedLessons: 0 })), false, new Set())?.module.id, 10);
});
