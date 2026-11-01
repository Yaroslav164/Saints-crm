"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { fetchApi, toQuery } from "@/lib/api-client";
import type { BulkResult, BundlesResponse } from "@/types";
import type { BulkBundleForm } from "@/lib/validations";

/**
 * The list state is deliberately the raw query string: every filter, sort and
 * page is shareable and refresh-safe, and the server schema stays the single
 * source of truth for what a value means.
 */
export type QueryState = Record<string, string>;

export const DEFAULT_SORT = "createdAt";
export const DEFAULT_ORDER = "desc";

export function readPage(state: QueryState): number {
  return Number.parseInt(state.page ?? "1", 10) || 1;
}

export function readSort(state: QueryState): { sort: string; order: "asc" | "desc" } {
  return { sort: state.sort ?? DEFAULT_SORT, order: state.order === "asc" ? "asc" : "desc" };
}

/** Setting a filter narrows the result set, so the page resets to the first one. */
export function withParams(state: QueryState, patch: QueryState, options?: { keepPage?: boolean }): QueryState {
  const next: QueryState = { ...state, ...patch };
  for (const [key, value] of Object.entries(next)) {
    if (value === "" || value === undefined) delete next[key];
  }
  if (!options?.keepPage && !("page" in patch)) delete next.page;
  return next;
}

export function useBundlesQuery(state: QueryState) {
  return useQuery({
    queryKey: ["bundles", state],
    queryFn: () => fetchApi<BundlesResponse>(`/api/bundles${toQuery(state)}`),
    // Keep the previous page on screen while the next one loads; an empty
    // skeleton between pages reads as a broken table.
    placeholderData: (previous) => previous,
  });
}

export function useBulkBundles(onDone?: () => void) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: BulkBundleForm) =>
      fetchApi<BulkResult>("/api/bundles/bulk", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (result, payload) => {
      const verb = payload.action === "delete" ? "deleted" : payload.action === "status" ? "updated" : "changed";
      const skipped = result.skipped > 0 ? ` · ${result.skipped} skipped (not yours)` : "";
      toast.success(`${result.affected} bundle${result.affected === 1 ? "" : "s"} ${verb}${skipped}`);
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      // The dashboard aggregates are server-rendered, so they need a re-fetch too.
      router.refresh();
      onDone?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
