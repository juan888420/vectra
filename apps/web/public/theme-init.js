// Blocking, runs before any stylesheet/React paints, so the correct theme
// applies on the very first frame (no flash of the wrong theme). A file, not
// an inline <script>, so the server's CSP (script-src 'self') allows it.
// Keep the storage key in sync with THEME_STORAGE_KEY in
// packages/ui/src/theme/ThemeProvider.tsx.
(function () {
  var stored = localStorage.getItem("vectra-theme");
  var isDark =
    stored === "dark" ||
    (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (isDark) {
    document.documentElement.classList.add("dark");
  }
})();
