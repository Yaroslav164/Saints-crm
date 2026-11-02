"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { fetchApi } from "@/lib/api-client";
import { STATUS_META } from "@/lib/status";
import type { CreatedComment } from "@/types";
import type { BundleStatus } from "@/lib/generated/prisma/enums";

/**
 * Mutations for the detail page. The page itself is server-rendered (its data is a
 * per-bundle read, so caching it would delay showing an edit), which means every
 * success has two jobs: refresh the URL-keyed list queries the user may go back to,
 * and `router.refresh()` to re-render this segment from the database.
 */
function useBundleRefresh() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["bundles"] });
    router.refresh();
  };
}

export function useSetStatus() {
  const refresh = useBundleRefresh();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: BundleStatus }) =>
      fetchApi<{ id: string; status: BundleStatus }>(`/api/bundles/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_result, variables) => {
      const meta = STATUS_META[variables.status];
      toast.success(`Status set to ${meta.emoji} ${meta.label}`);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useArchiveBundle() {
  const refresh = useBundleRefresh();

  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      fetchApi<{ affected: number }>("/api/bundles/bulk", {
        method: "POST",
        body: JSON.stringify({ action: archived ? "unarchive" : "archive", ids: [id] }),
      }),
    onSuccess: (result, variables) => {
      if (result.affected === 0) {
        toast.error("This bundle is not yours to change");
        return;
      }
      toast.success(variables.archived ? "Moved back to the working list" : "Archived — it stays out of the working list");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteBundle() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => fetchApi<{ id: string; name: string }>(`/api/bundles/${id}`, { method: "DELETE" }),
    onSuccess: (result) => {
      toast.success(`Bundle "${result.name}" deleted`);
      queryClient.invalidateQueries({ queryKey: ["bundles"] });
      // The page is gone, so this navigates instead of refreshing in place.
      router.push("/bundles");
      router.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

/**
 * Posts a comment and re-renders the feed from the server. Optimistically appending
 * it here would put the row at the wrong time and show a different author name than
 * the one the server resolved, and the feed is ordered by the database anyway.
 */
export function useAddComment(onPosted: () => void) {
  const refresh = useBundleRefresh();

  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      fetchApi<CreatedComment>(`/api/bundles/${id}/comments`, { method: "POST", body: JSON.stringify({ text }) }),
    onSuccess: () => {
      onPosted();
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
