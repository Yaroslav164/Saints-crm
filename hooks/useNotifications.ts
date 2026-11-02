"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { fetchApi } from "@/lib/api-client";
import type { NotificationsResponse } from "@/types";

/**
 * The bell's data. Polled rather than pushed: there is no websocket in this app, and a
 * minute is the right order of magnitude for a rule that fires when a bundle crosses the
 * ROI line — the alert is a reminder, not a page at someone.
 */
export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

const POLL_MS = 60_000;

export function useNotifications() {
  return useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => fetchApi<NotificationsResponse>("/api/notifications"),
    refetchInterval: POLL_MS,
    // Coming back to the tab is when somebody asks "did anything blow up while I was away".
    refetchOnWindowFocus: true,
  });
}

/** `ids` empty means everything unread; the server owns that decision, not the client. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids?: string[]) =>
      fetchApi<{ marked: number }>("/api/notifications/read", {
        method: "POST",
        body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => fetchApi<{ id: string }>(`/api/notifications/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY }),
    onError: (error: Error) => toast.error(error.message),
  });
}
