import Link from "next/link";
import { ArrowLeftIcon, PackageSearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Rendered for `notFound()` inside this segment: a wrong id or a deleted bundle. */
export default function BundleNotFound() {
  return (
    <div className="space-y-4">
      <Link
        href="/bundles"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" />
        All bundles
      </Link>

      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 px-4 py-12 text-center">
          <PackageSearchIcon className="size-8 text-muted-foreground" />
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Bundle not found</h1>
            <p className="max-w-md text-sm text-muted-foreground">
              This link points at a bundle that no longer exists — it was deleted, or the id came from an older
              bookmark. The list shows what the team has now.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/bundles">Back to bundles</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
