import Link from "next/link";
import { getAuditFacets } from "@/lib/audit";
import { AuditView } from "@/components/audit/AuditView";
import { Button } from "@/components/ui/button";
import { isAdmin, requirePageUser } from "@/lib/dal";

/**
 * The audit log is admin-only, and the guard is here rather than only in the navigation:
 * the link can be hidden and the URL cannot. A buyer who types `/audit` gets an
 * explanation, not the team's history and not a 500.
 *
 * Like the bundle detail page, this one reads uncached data on purpose — a log that could
 * be a minute stale is a log nobody can act on — so the segment's `loading.tsx` is the
 * stream boundary and the page is not cached under any tag.
 */
export default async function AuditPage() {
  const user = await requirePageUser();

  if (!isAdmin(user)) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Audit log</h1>
          <p className="text-sm text-muted-foreground">Admin only.</p>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            The log shows every change and comment across the whole team, so it is read by whoever is
            responsible for them. Your own bundles still show their full history on their pages.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/bundles">Back to my bundles</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <AuditView facets={await getAuditFacets()} />;
}
