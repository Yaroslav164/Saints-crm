"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchApi } from "@/lib/api-client";
import type { AppSettings, GeoRecord, OfferRecord, RemovedRecord, TagRecord, UserRecord } from "@/types";

/**
 * Dictionary reads and writes (stage 6).
 *
 * No `router.refresh()` after a successful mutation: the server-side caches these
 * writes touch (`facets` and `dashboard`) are expired by the route handler itself with
 * `{ expire: 0 }`, so the next render of `/bundles` or the dashboard already reads the
 * new name. What is stale here is only this client's copy, and that is what the query
 * invalidation below covers.
 */
export type ReferenceResource = "offers" | "geos" | "tags" | "users";

export function useReferenceList<T>(resource: ReferenceResource) {
  return useQuery({
    queryKey: ["references", resource],
    queryFn: () => fetchApi<T[]>(`/api/${resource}`),
  });
}

/** `id` decides the verb, so one hook serves the create and the edit dialog. */
export function useSaveReference<T>(resource: ReferenceResource, label: string, onDone?: (row: T) => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: unknown }) =>
      fetchApi<T>(id ? `/api/${resource}/${id}` : `/api/${resource}`, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (row, variables) => {
      toast.success(`${label} ${variables.id ? "updated" : "created"}`);
      queryClient.invalidateQueries({ queryKey: ["references", resource] });
      onDone?.(row);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteReference(resource: ReferenceResource, label: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => fetchApi<RemovedRecord>(`/api/${resource}/${id}`, { method: "DELETE" }),
    onSuccess: (result) => {
      // GEO and TAG rows report how many bundles they were unlinked from; the number is
      // the difference between "deleted" and "silently edited 40 bundles".
      const unlinked =
        result.unlinked && result.unlinked > 0
          ? ` · dropped from ${result.unlinked} bundle${result.unlinked === 1 ? "" : "s"}`
          : "";
      toast.success(`${label} “${result.label}” removed${unlinked}`);
      queryClient.invalidateQueries({ queryKey: ["references", resource] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useOffers() {
  return useReferenceList<OfferRecord>("offers");
}

export function useGeos() {
  return useReferenceList<GeoRecord>("geos");
}

export function useTags() {
  return useReferenceList<TagRecord>("tags");
}

export function useBuyers() {
  return useReferenceList<UserRecord>("users");
}

export function useAppSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchApi<AppSettings>("/api/settings"),
  });
}

export function useSaveSettings(onDone?: () => void) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AppSettings) => fetchApi<AppSettings>("/api/settings", { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Alert threshold saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      onDone?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
