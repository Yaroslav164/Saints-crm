import { notFound } from "next/navigation";
import { getBundleFacets, readBundleDetail } from "@/lib/bundles";
import { isAdmin, requirePageUser } from "@/lib/dal";
import { bundleIdSchema } from "@/lib/validations";
import { BundleDetailView } from "@/components/bundles/BundleDetailView";

/**
 * The detail page reads its own row rather than receiving it from the list: a link
 * to `/bundles/<id>` must work on its own (shared URL, refresh, back button), and a
 * per-bundle read is cheap enough that caching it would only delay showing an edit.
 *
 * A malformed or deleted id is a 404, not a crash — `safeParse` because a throw from
 * `parse` here would surface as an error boundary instead of the missing-bundle page.
 */
export default async function BundleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const parsed = bundleIdSchema.safeParse(await params);
  if (!parsed.success) notFound();

  const [bundle, facets] = await Promise.all([readBundleDetail(user, parsed.data.id), getBundleFacets()]);
  if (!bundle) notFound();

  return (
    <BundleDetailView
      bundle={bundle}
      facets={facets}
      isAdmin={isAdmin(user)}
      currentUserId={user.id}
    />
  );
}
