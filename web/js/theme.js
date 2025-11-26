// js/theme.js
(function (global) {
  const App = global.App || (global.App = {});
  const THEME_KEY = "one_wallet_theme";

  function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    root.dataset.theme = theme;

    const icon = document.getElementById("theme-toggle-icon");
    const label = document.getElementById("theme-toggle-label");
    if (icon && label) {
      if (theme === "dark") {
        icon.textContent = "🌙";
        label.textContent = "حالت تیره";
      } else {
        icon.textContent = "☀️";
        label.textContent = "حالت روشن";
      }
    }
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    ).matches;

    const theme = saved || (prefersDark ? "dark" : "light");
    applyTheme(theme);

    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", () => {
        const current =
          document.documentElement.classList.contains("dark")
            ? "dark"
            : "light";
        const next = current === "dark" ? "light" : "dark";
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
      });
    }
  }

  App.initTheme = initTheme;
})(window);
