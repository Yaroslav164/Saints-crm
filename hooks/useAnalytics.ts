"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApi, toQuery } from "@/lib/api-client";
import type { AnalyticsSummary, BuyerSlice, OfferSlice, TopBundleRow } from "@/types";

/**
 * Reads for the analytics screen.
 *
 * The period is plain URL state, exactly like the bundle list's filters: a chosen
 * window stays shareable and survives a refresh, and the server never awaits it, so
 * navigating here cannot block on a request-time value. Each card owns its query,
 * which lets a slow section show its own skeleton instead of blanking the page, and
 * `placeholderData` keeps the previous window's chart on screen while the new one
 * loads — a chart that flickers to empty reads as a broken filter.
 */

export type WindowState = Record<string, string>;

function useWindowedQuery<T>(name: string, state: WindowState) {
  return useQuery({
    queryKey: ["analytics", name, state],
    queryFn: () => fetchApi<T>(`/api/analytics/${name}${toQuery(state)}`),
    placeholderData: (previous) => previous,
  });
}

export function useAnalyticsSummary(state: WindowState) {
  return useWindowedQuery<AnalyticsSummary>("dashboard", state);
}

export function useAnalyticsByBuyer(state: WindowState) {
  return useWindowedQuery<{ window: AnalyticsSummary["window"]; rows: BuyerSlice[] }>("by-buyer", state);
}

export function useAnalyticsByOffer(state: WindowState) {
  return useWindowedQuery<{ window: AnalyticsSummary["window"]; rows: OfferSlice[] }>("by-offer", state);
}

export function useTopBundles(state: WindowState) {
  return useWindowedQuery<{ window: AnalyticsSummary["window"]; rows: TopBundleRow[] }>("top-bundles", state);
}
