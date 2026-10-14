import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type ModuleInput = Record<string, unknown> & { is_free: boolean };
type ActionResult = { success: boolean; moduleId?: number; error?: string };
type Actions = {
  adminCreateModule(formData: FormData): Promise<ActionResult>;
  adminUpdateModule(moduleId: number, formData: FormData): Promise<ActionResult>;
};

// Execute the real actions with synthetic auth, persistence and cache boundaries.
// No Supabase or Mux calls are made by these tests.
function moduleActions(options: { authError?: Error; updateError?: string } = {}) {
  const saved: { moduleId?: number; input: ModuleInput }[] = [];
  const audit: {
    action: string;
    actorStudentId: string;
    metadata: Record<string, unknown>;
  }[] = [];
  const invalidated: string[] = [];
  const dependencies: Record<string, unknown> = {
    "next/cache": { revalidatePath: (path: string) => invalidated.push(path) },
    "@/lib/admin/access": {
      requireAdmin: async () => {
        if (options.authError) throw options.authError;
        return { actorStudent: { id: "synthetic-admin" } };
      },
    },
    "@/lib/admin/audit": {
      logAdminAction: async (action: string, details: Omit<typeof audit[number], "action">) => {
        audit.push({ action, ...details });
      },
    },
    "@/lib/admin/videos": {
      createModuleAdmin: async (input: ModuleInput) => {
        saved.push({ input });
        return { module: { id: 70 }, error: null };
      },
      updateModuleAdmin: async (moduleId: number, input: ModuleInput) => {
        saved.push({ moduleId, input });
        return { error: options.updateError ?? null };
      },
    },
    "@/lib/supabase/server": {},
    "@/lib/mux": {},
  };
  const compiled = ts.transpileModule(
    readFileSync(resolve("app/actions/admin/videos.ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
  );
  const loadedModule = { exports: {} as Actions };
  runInNewContext(compiled.outputText, {
    exports: loadedModule.exports,
    module: loadedModule,
    require(name: string) {
      assert.ok(name in dependencies, `Missing mock for ${name}`);
      return dependencies[name];
    },
  });
  return { actions: loadedModule.exports, saved, audit, invalidated };
}

function moduleForm(free = false) {
  const form = new FormData();
  form.set("title", "Synthetische module");
  form.set("slug", "synthetic-module");
  form.set("order_index", "7");
  form.set("is_published", "on");
  if (free) form.set("is_free", "on");
  return form;
}

function assertLearningViewsInvalidated(paths: string[]) {
  const routes = new Set(paths.map((path) => path.replace(/\/\([^/]+\)/g, "")));
  for (const route of [
    "/admin/videos",
    "/dashboard",
    "/modules",
    "/modules/[slug]",
    "/modules/[slug]/exam",
    "/lessons/[slug]",
  ]) {
    assert.ok(routes.has(route), `${route} must reflect the changed module access`);
  }
}

test("admin creates a free module and records the selection", async () => {
  const { actions, saved, audit, invalidated } = moduleActions();
  const result = await actions.adminCreateModule(moduleForm(true));
  assert.equal(result.success, true);
  assert.equal(result.moduleId, 70);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].input.is_free, true);
  assert.equal(saved[0].input.is_published, true);
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "content.module_created");
  assert.equal(audit[0].actorStudentId, "synthetic-admin");
  assert.equal(audit[0].metadata.moduleId, 70);
  assert.equal(audit[0].metadata.is_free, true);
  assertLearningViewsInvalidated(invalidated);
});

test("admin can enable free access and revoke it by clearing the checkbox", async () => {
  const { actions, saved, audit, invalidated } = moduleActions();
  const form = moduleForm(true);
  assert.equal((await actions.adminUpdateModule(70, form)).success, true);
  form.delete("is_free");
  assert.equal((await actions.adminUpdateModule(70, form)).success, true);
  assert.deepEqual(saved.map((entry) => entry.input.is_free), [true, false]);
  assert.ok(saved.every((entry) => entry.moduleId === 70));
  assert.deepEqual(audit.map((entry) => entry.metadata.is_free), [true, false]);
  assert.ok(audit.every((entry) => entry.action === "content.module_updated"));
  assert.ok(audit.every((entry) => entry.metadata.moduleId === 70));
  assertLearningViewsInvalidated(invalidated);
  assert.ok(invalidated.includes("/modules/synthetic-module"));
});

test("new modules default to paid access when free access is not selected", async () => {
  const { actions, saved, audit } = moduleActions();
  assert.equal((await actions.adminCreateModule(moduleForm())).success, true);
  assert.equal(saved[0].input.is_free, false);
  assert.equal(audit[0].metadata.is_free, false);
});

test("non-admin requests cannot mutate or audit module access", async () => {
  const denied = new Error("Admin access required");
  const { actions, saved, audit, invalidated } = moduleActions({ authError: denied });
  await assert.rejects(actions.adminCreateModule(moduleForm(true)), /Admin access required/);
  await assert.rejects(actions.adminUpdateModule(70, moduleForm(true)), /Admin access required/);
  assert.equal(saved.length, 0);
  assert.equal(audit.length, 0);
  assert.equal(invalidated.length, 0);
});

test("failed module updates report the error without auditing or invalidating views", async () => {
  const { actions, saved, audit, invalidated } = moduleActions({ updateError: "Synthetic save failure" });
  const result = await actions.adminUpdateModule(70, moduleForm(true));
  assert.equal(result.success, false);
  assert.equal(result.error, "Synthetic save failure");
  assert.equal(saved.length, 1);
  assert.equal(audit.length, 0);
  assert.equal(invalidated.length, 0);
});
