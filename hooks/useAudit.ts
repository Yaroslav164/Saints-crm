"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi, toQuery } from "@/lib/api-client";
import type { AuditResponse } from "@/types";

/** Same raw-query-string state as the bundle list: every filter is a shareable URL. */
export type AuditState = Record<string, string>;

export function useAuditQuery(state: AuditState) {
  return useQuery({
    queryKey: ["audit", state],
    queryFn: () => fetchApi<AuditResponse>(`/api/audit${toQuery(state)}`),
    placeholderData: (previous) => previous,
  });
}
