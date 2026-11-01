import { getBundleFacets } from "@/lib/bundles";
import { isAdmin, requirePageUser } from "@/lib/dal";
import { BundlesView } from "@/components/bundles/BundlesView";

/**
 * This page deliberately does not read `searchParams`. The list's filters, sort
 * and page live in the URL and the client owns them, so awaiting the params here
 * made every navigation block on a request-time value — Next reports exactly that
 * as "uncached data during a navigation". The client reads the same query string
 * (including during SSR), so nothing is lost.
 */
export default async function BundlesPage() {
  const user = await requirePageUser();

  return <BundlesView facets={await getBundleFacets()} isAdmin={isAdmin(user)} currentUserId={user.id} />;
}
