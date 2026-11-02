"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { fetchApi } from "@/lib/api-client";
import type { ImportResult } from "@/types";

export type ImportRequest = { text: string; dryRun: boolean; skipInvalid: boolean };

/**
 * CSV import. Two mutations over the same endpoint rather than one with a flag inside,
 * because the two answers deserve different reactions: a preview (`dryRun`) only fills the
 * dialog and must not clear the list's cache or throw a success toast, while the real import
 * wrote rows that every screen is showing stale copies of.
 */
export function useImportPreview() {
  return useMutation({
    mutationFn: (payload: Omit<ImportRequest, "dryRun">) =>
      fetchApi<ImportResult>("/api/bundles/import", {
        method: "POST",
        body: JSON.stringify({ ...payload, dryRun: true }),
      }),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useImportBundles(onDone?: (result: ImportResult) => void) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (payload: ImportRequest) =>
      fetchApi<ImportResult>("/api/bundles/import", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (result) => {
      const skipped = result.skipped > 0 ? ` · ${result.skipped} skipped` : "";
      if (result.created > 0) toast.success(`${result.created} bundle${result.created === 1 ? "" : "s"} imported${skipped}`);
      else toast.error(result.aborted ? "Nothing imported — the file has errors" : "Nothing imported");

      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      // Imported rows move the dashboard and the filter dictionaries, both server-cached.
      router.refresh();
      onDone?.(result);
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
