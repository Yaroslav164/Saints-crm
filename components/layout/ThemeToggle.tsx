"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof MonitorIcon }[] = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

/** Segmented control: the three-way theme choice, one tap to switch. */
export function ThemeToggle() {
  const { preference, select } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex items-center gap-0.5 rounded-full border border-border bg-muted/60 p-0.5"
    >
      {OPTIONS.map((option) => {
        const selected = preference === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => select(option.value)}
            className={cn(
              "flex size-7 items-center justify-center rounded-full transition-colors",
              selected
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
