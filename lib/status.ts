import type { BundleStatus } from "@/lib/generated/prisma/enums";

/**
 * Presentation metadata for bundle statuses. The hue encodes meaning (idea grey →
 * testing blue → profit green → loss yellow → drained red → scale purple), so it
 * is kept explicit rather than folded into the surface tokens — but each status
 * declares both a light and a dark text color, and `chartColor` carries both too,
 * because Recharts needs a literal value per theme.
 */
export const STATUS_META: Record<
  BundleStatus,
  {
    label: string;
    emoji: string;
    badgeClass: string;
    dotClass: string;
    chartColor: { light: string; dark: string };
  }
> = {
  IDEA: {
    label: "Idea",
    emoji: "💡",
    badgeClass:
      "border-slate-400/50 bg-slate-500/10 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-300",
    dotClass: "bg-slate-500 dark:bg-slate-400",
    chartColor: { light: "#64748b", dark: "#94a3b8" },
  },
  TESTING: {
    label: "Testing",
    emoji: "🧪",
    badgeClass:
      "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    dotClass: "bg-blue-500 dark:bg-blue-400",
    chartColor: { light: "#2563eb", dark: "#60a5fa" },
  },
  PROFIT: {
    label: "In profit",
    emoji: "✅",
    badgeClass:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500 dark:bg-emerald-400",
    chartColor: { light: "#0a7d4d", dark: "#10b981" },
  },
  LOSS: {
    label: "In loss",
    emoji: "⚠️",
    badgeClass:
      "border-yellow-500/40 bg-yellow-500/10 text-yellow-800 dark:text-yellow-300",
    dotClass: "bg-yellow-500 dark:bg-yellow-400",
    chartColor: { light: "#b45309", dark: "#eab308" },
  },
  DRAINED: {
    label: "Drained",
    emoji: "🗑",
    badgeClass: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
    dotClass: "bg-red-500 dark:bg-red-400",
    chartColor: { light: "#dc2626", dark: "#ef4444" },
  },
  SCALE: {
    label: "Scaling",
    emoji: "🚀",
    badgeClass:
      "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
    dotClass: "bg-purple-500 dark:bg-purple-400",
    chartColor: { light: "#9333ea", dark: "#a855f7" },
  },
};

export const STATUS_ORDER: BundleStatus[] = [
  "IDEA",
  "TESTING",
  "PROFIT",
  "LOSS",
  "DRAINED",
  "SCALE",
];

export function statusLabel(status: BundleStatus): string {
  return `${STATUS_META[status].emoji} ${STATUS_META[status].label}`;
}
