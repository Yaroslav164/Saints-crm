"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";

/**
 * Client boundary for the whole app: React Query caches API reads/mutations and
 * react-hot-toast renders the action feedback the spec asks for.
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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#0f172a",
            color: "#f1f5f9",
            border: "1px solid #1e293b",
            borderRadius: "0.75rem",
            fontSize: "0.875rem",
          },
          success: { iconTheme: { primary: "#10b981", secondary: "#0f172a" } },
          error: { iconTheme: { primary: "#ef4444", secondary: "#0f172a" } },
        }}
      />
    </QueryClientProvider>
  );
}
