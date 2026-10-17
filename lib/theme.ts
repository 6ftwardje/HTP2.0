export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "htp-theme";

/** A saved choice wins; system preference never overrides the platform default. */
export function resolveTheme(stored: string | null): Theme {
  return stored === "light" ? "light" : "dark";
}

// Apply before paint, including when storage is unavailable. Kept beside the
// toggle's contract so a blocked localStorage cannot leave the page in limbo.
export const THEME_INIT_SCRIPT = `
(function () {
  var theme = "dark";
  try {
    theme = window.localStorage.getItem("${THEME_STORAGE_KEY}") === "light" ? "light" : "dark";
  } catch (_) {}
  var root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
})();
`;
