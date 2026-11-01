import type { BundleStatus } from "@/lib/generated/prisma/enums";

/**
 * Presentation metadata for bundle statuses: label, emoji and the Tailwind
 * classes behind the spec's colour coding
 * (idea grey → testing blue → profit green → loss yellow → drained red → scale purple).
 */
export const STATUS_META: Record<
  BundleStatus,
  { label: string; emoji: string; badgeClass: string; dotClass: string; chartColor: string }
> = {
  IDEA: {
    label: "Idea",
    emoji: "💡",
    badgeClass: "border-slate-500/30 bg-slate-500/15 text-slate-300",
    dotClass: "bg-slate-400",
    chartColor: "#94a3b8",
  },
  TESTING: {
    label: "Testing",
    emoji: "🧪",
    badgeClass: "border-blue-500/30 bg-blue-500/15 text-blue-300",
    dotClass: "bg-blue-400",
    chartColor: "#60a5fa",
  },
  PROFIT: {
    label: "In profit",
    emoji: "✅",
    badgeClass: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    dotClass: "bg-emerald-400",
    chartColor: "#10b981",
  },
  LOSS: {
    label: "In loss",
    emoji: "⚠️",
    badgeClass: "border-yellow-500/30 bg-yellow-500/15 text-yellow-300",
    dotClass: "bg-yellow-400",
    chartColor: "#eab308",
  },
  DRAINED: {
    label: "Drained",
    emoji: "🗑",
    badgeClass: "border-red-500/30 bg-red-500/15 text-red-300",
    dotClass: "bg-red-400",
    chartColor: "#ef4444",
  },
  SCALE: {
    label: "Scaling",
    emoji: "🚀",
    badgeClass: "border-purple-500/30 bg-purple-500/15 text-purple-300",
    dotClass: "bg-purple-400",
    chartColor: "#a855f7",
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
