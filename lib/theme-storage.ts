/** Shared between the pre-paint script (server) and the client store. */
export const THEME_STORAGE_KEY = "saints-crm:theme";

/**
 * Runs before the first paint so the initial frame already has the right class
 * on <html> and nothing flashes. Mirrors lib/theme.ts; the fallback is dark, the
 * product's default theme.
 */
export const themeInitScript = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var v=localStorage.getItem(k);var m=window.matchMedia("(prefers-color-scheme: dark)");var d=v==="dark"||((!v||v==="system")&&m.matches);var e=document.documentElement;e.classList.toggle("dark",d);e.style.colorScheme=d?"dark":"light";}catch(err){document.documentElement.classList.add("dark");}})();`;
