"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-storage";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = THEME_STORAGE_KEY;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function readPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/**
 * Applies the class that Tailwind's `dark` variant and every CSS token key off.
 * The same logic runs from an inline script before paint (see app/layout.tsx), so
 * the first frame is already correct and nothing flashes.
 */
export function applyTheme(preference: ThemePreference): void {
  const dark = preference === "dark" || (preference === "system" && prefersDark());
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Follow the OS only while the user has not picked an explicit theme.
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (readPreference() === "system") {
      applyTheme("system");
      listener();
    }
  };
  media.addEventListener("change", onChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onChange);
  };
}

export function setTheme(preference: ThemePreference): void {
  window.localStorage.setItem(STORAGE_KEY, preference);
  applyTheme(preference);
  emit();
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => "system" as const);
}

/**
 * Which palette is on screen right now. Charts need this as a JavaScript value:
 * Recharts writes series and axis colors into SVG presentation attributes, where
 * `var(--token)` does not resolve, so a CSS-only theme switch would leave them in
 * one theme's colors.
 */
export function useResolvedTheme(): ResolvedTheme {
  const preference = useThemePreference();
  const systemDark = useSyncExternalStore(
    subscribe,
    () => (prefersDark() ? "dark" : "light"),
    () => "dark" as const,
  );

  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemDark;
}

export function useTheme() {
  const preference = useThemePreference();
  const resolved = useResolvedTheme();
  const select = useCallback((next: ThemePreference) => setTheme(next), []);
  return { preference, resolved, select };
}
