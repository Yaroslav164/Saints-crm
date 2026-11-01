export { cn } from "cn";

import { format } from "date-fns";

/**
 * Derived metrics. Every guard on a zero denominator returns the neutral value
 * instead of NaN/Infinity because these results feed table cells and charts.
 */

export function calculateCR(conversions: number, clicks: number): number {
  if (clicks === 0) return 0;
  return (conversions / clicks) * 100;
}

export function calculateROI(revenue: number, spent: number): number {
  if (spent === 0) return 0;
  return ((revenue - spent) / spent) * 100;
}

export function calculateROAS(revenue: number, spent: number): number {
  if (spent === 0) return 0;
  return revenue / spent;
}

export function calculateProfit(revenue: number, spent: number): number {
  return revenue - spent;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

/** Signed percentage, matching the "+12.34%" style used across the tables. */
export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

/**
 * Timestamps are shown in the viewer's local time, so date-fns formats them
 * directly. Day keys of `@db.Date` columns are handled by formatDayLabel below.
 */
export function formatDate(value: Date | string): string {
  return format(typeof value === "string" ? new Date(value) : value, "dd.MM.yyyy");
}

export function formatDateTime(value: Date | string): string {
  return format(typeof value === "string" ? new Date(value) : value, "dd.MM.yyyy HH:mm");
}

function utcParts(value: Date): [string, string] {
  return [String(value.getUTCDate()).padStart(2, "0"), String(value.getUTCMonth() + 1).padStart(2, "0")];
}

/**
 * Day label for a `@db.Date` column. Those values arrive as UTC midnight while
 * the app runs in a local timezone (UTC+4 on this machine), so reading UTC
 * fields keeps a day row from being displayed as its neighbour — a locale
 * formatter would also pick the separator for us.
 */
export function formatDayLabel(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const [day, month] = utcParts(date);
  return `${day}.${month}`;
}

export function formatDayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function roundTo(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export type RoiTone = "positive" | "negative" | "neutral";

export function roiTone(value: number): RoiTone {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}
