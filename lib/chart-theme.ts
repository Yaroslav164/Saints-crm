import type { ResolvedTheme } from "@/lib/theme";

/**
 * Chart colors have to be JavaScript values, not CSS variables: Recharts writes
 * them into SVG presentation attributes (`fill`, `stroke`), where `var(--token)`
 * does not resolve. Each theme therefore gets its own readable set.
 */
export type ChartTheme = {
  axis: string;
  grid: string;
  baseline: string;
  line: string;
  positive: string;
  negative: string;
  muted: string;
  canvas: string;
  tooltip: { background: string; border: string; text: string; muted: string };
};

export const CHART_THEMES: Record<ResolvedTheme, ChartTheme> = {
  light: {
    axis: "#6e6e73",
    grid: "#e8e8ed",
    baseline: "#c7c7cc",
    line: "#4f46e5",
    positive: "#0a7d4d",
    negative: "#b3261e",
    muted: "#86868b",
    canvas: "#ffffff",
    tooltip: { background: "#ffffff", border: "#d2d2d7", text: "#1d1d1f", muted: "#6e6e73" },
  },
  dark: {
    axis: "#94a3b8",
    grid: "#1e293b",
    baseline: "#475569",
    line: "#818cf8",
    positive: "#34d399",
    negative: "#f87171",
    muted: "#64748b",
    canvas: "#0f172a",
    tooltip: { background: "#0f172a", border: "#334155", text: "#e2e8f0", muted: "#94a3b8" },
  },
};
