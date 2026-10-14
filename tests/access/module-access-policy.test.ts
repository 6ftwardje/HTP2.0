import assert from "node:assert/strict";
import test from "node:test";
import {
  buildModuleEntitlementMap,
  canOpenLessonWithIntake,
  chooseNextAvailableModule,
} from "../../lib/module-access-policy.ts";

const modules = [
  { id: 70, order_index: 7, is_free: false },
  { id: 40, order_index: 4, is_free: true },
  { id: 20, order_index: 2, is_free: true },
  { id: 60, order_index: 6, is_free: true },
  { id: 10, order_index: 1, is_free: true },
  { id: 50, order_index: 5, is_free: true },
  { id: 30, order_index: 3, is_free: true },
];

function canOpenLesson(overrides: Partial<Parameters<typeof canOpenLessonWithIntake>[0]> = {}) {
  return canOpenLessonWithIntake({
    accessLevel: 1,
    intakeComplete: false,
    isFirstModule: false,
    isFirstLesson: false,
    isFreeModule: false,
    ...overrides,
  });
}

test("a new free account gets only the first module preview", () => {
  const access = buildModuleEntitlementMap(modules, false, 1);
  assert.deepEqual([...access.entries()], [
    [10, true], [20, false], [30, false], [40, false],
    [50, false], [60, false], [70, false],
  ]);
  assert.equal(canOpenLesson({ isFirstModule: true, isFirstLesson: true, isFreeModule: true }), true);
  assert.equal(canOpenLesson({ isFirstModule: true, isFreeModule: true }), false);
  assert.equal(canOpenLesson({ isFirstLesson: true, isFreeModule: true }), false);
  assert.equal(canOpenLesson({ isFreeModule: true }), false);
});

test("intake opens the six selected free modules, never the paid seventh module", () => {
  const access = buildModuleEntitlementMap(modules, true, 1);
  assert.deepEqual([...access.values()], [true, true, true, true, true, true, false]);
  assert.equal(access.get(60), true);
  assert.equal(access.get(70), false);
  assert.equal(canOpenLesson({ intakeComplete: true, isFreeModule: true }), true);
  assert.equal(canOpenLesson({ intakeComplete: true }), false);
});

test("free selection may be nonconsecutive and follows module identity when reordered", () => {
  const selectedModules = modules.map((module) => ({
    ...module,
    is_free: module.id === 20 || module.id === 70,
  }));
  const access = buildModuleEntitlementMap(selectedModules, true, 1);
  assert.deepEqual([...access.entries()], [
    [10, true], [20, true], [30, false], [40, false],
    [50, false], [60, false], [70, true],
  ]);

  const newOrder = [40, 70, 10, 60, 20, 50, 30];
  const reorderedModules = selectedModules.map((module) => ({
    ...module,
    order_index: newOrder.indexOf(module.id) + 1,
  }));
  const reorderedAccess = buildModuleEntitlementMap(reorderedModules, true, 1);
  assert.deepEqual([...reorderedAccess.entries()], [
    [40, true], [70, true], [10, false], [60, false],
    [20, true], [50, false], [30, false],
  ]);
  assert.equal(reorderedAccess.get(20), true);
  assert.equal(reorderedAccess.get(70), true);
});

test("without a free selection only the first lesson preview remains after intake", () => {
  const paidModules = modules.map((module) => ({ ...module, is_free: false }));
  const access = buildModuleEntitlementMap(paidModules, true, 1);
  assert.deepEqual([...access.values()], [true, false, false, false, false, false, false]);
  assert.equal(canOpenLesson({ intakeComplete: true, isFirstModule: true, isFirstLesson: true }), true);
  assert.equal(canOpenLesson({ intakeComplete: true, isFirstModule: true }), false);
  assert.equal(canOpenLesson({ intakeComplete: true, isFirstLesson: true }), false);
});

test("deselecting the first module retains its preview while other selected modules open", () => {
  const selectedModules = modules.map((module) => ({
    ...module,
    is_free: module.id === 60,
  }));
  const access = buildModuleEntitlementMap(selectedModules, true, 1);
  assert.deepEqual([...access.values()], [true, false, false, false, false, true, false]);
  assert.equal(canOpenLesson({ intakeComplete: true, isFirstModule: true, isFirstLesson: true }), true);
  assert.equal(canOpenLesson({ intakeComplete: true, isFirstModule: true }), false);
  assert.equal(canOpenLesson({ intakeComplete: true, isFreeModule: true }), true);
});

test("module order ties use the same id ordering for the first preview", () => {
  const tiedModules = [
    { id: 20, order_index: 1, is_free: false },
    { id: 10, order_index: 1, is_free: false },
  ];
  assert.deepEqual([...buildModuleEntitlementMap(tiedModules, false, 1).entries()], [
    [10, true], [20, false],
  ]);
  assert.deepEqual(buildModuleEntitlementMap([], true, 1), new Map());
});

test("a one-time legacy grant preserves only the named paid module", () => {
  const legacyAccessModuleIds = new Set([70]);
  const paidModules = modules.map((module) => ({ ...module, is_free: false }));
  for (const intakeComplete of [false, true]) {
    const access = buildModuleEntitlementMap(paidModules, intakeComplete, 1, legacyAccessModuleIds);
    assert.deepEqual([...access.values()], [true, false, false, false, false, false, true]);
  }
  assert.equal(canOpenLesson({
    hasLegacyModuleAccess: true,
  }), true);
  assert.equal(canOpenLesson({ intakeComplete: true, hasLegacyModuleAccess: true }), true);
  assert.equal(canOpenLesson({ intakeComplete: true, hasLegacyModuleAccess: false }), false);
  assert.equal(buildModuleEntitlementMap(modules, true, 1).get(70), false);
});

test("full-course and admin accounts retain access without intake", () => {
  for (const accessLevel of [2, 3]) {
    const access = buildModuleEntitlementMap(modules, false, accessLevel);
    assert.deepEqual([...access.values()], [true, true, true, true, true, true, true]);
    assert.equal(canOpenLesson({ accessLevel }), true);
    assert.equal(canOpenLesson({ accessLevel, intakeComplete: true }), true);
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

test("dashboard skips a completed preview and continues with a selected free module", () => {
  const summaries = [
    { module: { id: 10 }, state: "available", completedLessons: 1 },
    { module: { id: 60 }, state: "available", completedLessons: 0 },
  ];
  assert.equal(
    chooseNextAvailableModule(summaries, false, new Set(), new Set([10]))?.module.id,
    60
  );
});

test("dashboard offers an untouched preview before a later selected free module", () => {
  const summaries = [
    { module: { id: 10 }, state: "available", completedLessons: 0 },
    { module: { id: 60 }, state: "available", completedLessons: 0 },
  ];
  assert.equal(
    chooseNextAvailableModule(summaries, false, new Set(), new Set([10]))?.module.id,
    10
  );
});

test("dashboard has no next module after a completed preview when later modules are locked", () => {
  const summaries = [
    { module: { id: 10 }, state: "available", completedLessons: 1 },
    { module: { id: 60 }, state: "locked", completedLessons: 0 },
  ];
  for (const incompleteFreeIntake of [false, true]) {
    assert.equal(
      chooseNextAvailableModule(summaries, incompleteFreeIntake, new Set(), new Set([10])),
      null
    );
  }
});
