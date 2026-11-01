"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { CHART_THEMES } from "@/lib/chart-theme";
import { useResolvedTheme } from "@/lib/theme";

/**
 * Client boundary for the whole app: React Query caches API reads/mutations, and
 * the toast host follows the active theme. Toast styling is a JS style object
 * rather than a class, so it has to be handed the palette explicitly.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const palette = CHART_THEMES[useResolvedTheme()];

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: palette.tooltip.background,
            color: palette.tooltip.text,
            border: `1px solid ${palette.tooltip.border}`,
            borderRadius: "0.75rem",
            fontSize: "0.875rem",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
          },
          success: { iconTheme: { primary: palette.positive, secondary: palette.canvas } },
          error: { iconTheme: { primary: palette.negative, secondary: palette.canvas } },
        }}
      />
    </QueryClientProvider>
  );
}
