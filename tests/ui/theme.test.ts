import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import { resolveTheme, THEME_INIT_SCRIPT } from "../../lib/theme";

test("a saved light choice wins, while absent or invalid preferences default to dark", () => {
  assert.equal(resolveTheme("light"), "light");
  for (const value of [null, "", "system", "dark", "invalid"]) {
    assert.equal(resolveTheme(value), "dark");
  }
});

test("the pre-paint initializer applies the saved choice even with an opposite system preference", () => {
  for (const stored of ["light", "dark", null]) {
    const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string>, classList: { toggle: (_: string, __: boolean) => {} } };
    let darkClass = false;
    root.classList.toggle = (name, enabled) => { assert.equal(name, "dark"); darkClass = enabled; };
    runInNewContext(THEME_INIT_SCRIPT, {
      document: { documentElement: root },
      window: { localStorage: { getItem: () => stored }, matchMedia: () => { throw new Error("System must not override the default"); } },
    });
    assert.equal(root.dataset.theme, stored === "light" ? "light" : "dark");
    assert.equal(root.style.colorScheme, root.dataset.theme);
    assert.equal(darkClass, root.dataset.theme === "dark");
  }
});

test("denied localStorage still initializes the dark dataset, class and native browser controls", () => {
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string>, classList: { toggle: (_: string, enabled: boolean) => assert.equal(enabled, true) } };
  runInNewContext(THEME_INIT_SCRIPT, {
    document: { documentElement: root },
    window: { get localStorage() { throw new Error("SecurityError"); } },
  });
  assert.equal(root.dataset.theme, "dark");
  assert.equal(root.style.colorScheme, "dark");
});
