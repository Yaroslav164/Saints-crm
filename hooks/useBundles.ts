"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { fetchApi, toQuery } from "@/lib/api-client";
import { calculateCR, calculateProfit, calculateROI, roundTo } from "@/lib/utils";
import type { BulkResult, BundleListItem, BundlesResponse } from "@/types";
import type { BundleForm, BundleUpdateForm, BulkBundleForm } from "@/lib/validations";

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

/**
 * Applies an edit to a cached row without waiting for the server.
 *
 * Only the fields the row already renders as plain values are touched: the patch
 * carries relation ids (offer, buyer, GEO, tags) while the row holds their labels,
 * and mapping ids back to labels here would need a second copy of the dictionaries.
 * Those columns refresh from the server right after, which is why this is paired
 * with an invalidation rather than used on its own.
 */
function applyPatch(row: BundleListItem, patch: BundleUpdateForm): BundleListItem {
  const next: BundleListItem = {
    ...row,
    ...Object.fromEntries(Object.entries(patch).filter(([key]) => key in row && !key.endsWith("Id") && !key.endsWith("Ids"))),
  };

  next.cr = roundTo(calculateCR(next.conversions, next.clicks), 2);
  next.roi = roundTo(calculateROI(next.revenue, next.budgetSpent), 2);
  next.profit = roundTo(calculateProfit(next.revenue, next.budgetSpent));
  return next;
}

export function useCreateBundle(onDone?: (item: BundleListItem) => void) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (values: BundleForm) =>
      fetchApi<BundleListItem>("/api/bundles", { method: "POST", body: JSON.stringify(values) }),
    onSuccess: (item) => {
      toast.success(`Bundle "${item.name}" created`);
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      // The dashboard aggregates are server-rendered and cached per tag.
      router.refresh();
      onDone?.(item);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateBundle(onDone?: () => void) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: BundleUpdateForm }) =>
      fetchApi<BundleListItem>(`/api/bundles/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ["bundles"] });
      const previous = queryClient.getQueriesData<BundlesResponse>({ queryKey: ["bundles"] });
      queryClient.setQueriesData<BundlesResponse>({ queryKey: ["bundles"] }, (current) =>
        current
          ? { ...current, items: current.items.map((row) => (row.id === id ? applyPatch(row, patch) : row)) }
          : current,
      );
      return { previous };
    },
    onError: (error: Error, _variables, context) => {
      // Roll the optimistic rows back; the server did not accept the change.
      for (const [key, data] of context?.previous ?? []) {
        if (data) queryClient.setQueryData(key, data);
      }
      toast.error(error.message);
    },
    onSuccess: (item) => {
      toast.success(`Bundle "${item.name}" updated`);
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      router.refresh();
      onDone?.();
    },
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
