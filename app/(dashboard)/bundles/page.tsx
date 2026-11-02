import { getBundleFacets } from "@/lib/bundles";
import { getImportVocabulary } from "@/lib/import";
import { isAdmin, requirePageUser } from "@/lib/dal";
import { BundlesView } from "@/components/bundles/BundlesView";

/**
 * This page deliberately does not read `searchParams`. The list's filters, sort
 * and page live in the URL and the client owns them, so awaiting the params here
 * made every navigation block on a request-time value — Next reports exactly that
 * as "uncached data during a navigation". The client reads the same query string
 * (including during SSR), so nothing is lost.
 *
 * The import dialog's dictionary hint is cached under the same `facets` tag as the
 * filter options, so both are expired by the same settings write and the dialog can
 * not offer a name the importer would reject.
 */
export default async function BundlesPage() {
  const user = await requirePageUser();
  const [facets, vocabulary] = await Promise.all([getBundleFacets(), getImportVocabulary()]);

  return (
    <BundlesView facets={facets} vocabulary={vocabulary} isAdmin={isAdmin(user)} currentUserId={user.id} />
  );
}
