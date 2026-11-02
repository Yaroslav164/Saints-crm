import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { requirePageUser } from "@/lib/dal";

/**
 * Screen shell. Nothing is read here but the session: every number on the page comes
 * from `/api/analytics/*` through React Query, so the period lives in the client and
 * the server never awaits it — the same contract the bundle list set in stage 3.
 */
export default async function AnalyticsPage() {
  await requirePageUser();

  return <AnalyticsView />;
}
