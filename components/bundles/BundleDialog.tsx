"use client";

import { BundleForm, type BundleFormValues } from "@/components/bundles/BundleForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bundleSchema } from "@/lib/validations";
import { useCreateBundle, useUpdateBundle } from "@/hooks/useBundles";
import type { BundleFacets, BundleListItem } from "@/types";
import type { BundleUpdateForm } from "@/lib/validations";

/**
 * Create/edit modal. Editing sends only the fields that actually changed, which
 * is what lets the server write one BundleChange per modified field instead of a
 * full snapshot on every save.
 */
export function BundleDialog({
  facets,
  isAdmin,
  bundle,
  open,
  onOpenChange,
}: {
  facets: BundleFacets;
  isAdmin: boolean;
  bundle: BundleListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const close = () => onOpenChange(false);
  const create = useCreateBundle(close);
  const update = useUpdateBundle(close);
  const pending = create.isPending || update.isPending;

  const submit = (values: BundleFormValues) => {
    const parsed = bundleSchema.parse(values);

    if (!bundle) {
      create.mutate(parsed);
      return;
    }

    const patch: BundleUpdateForm = {};
    if (parsed.name !== bundle.name) patch.name = parsed.name;
    if (parsed.offerId !== bundle.offer.id) patch.offerId = parsed.offerId;
    if (parsed.angle !== bundle.angle) patch.angle = parsed.angle;
    if ((parsed.creative ?? "") !== (bundle.creative ?? "")) patch.creative = parsed.creative ?? "";
    if (parsed.status !== bundle.status) patch.status = parsed.status;
    if (parsed.userId && parsed.userId !== bundle.buyer.id) patch.userId = parsed.userId;
    if (parsed.budgetPlanned !== bundle.budgetPlanned) patch.budgetPlanned = parsed.budgetPlanned;
    if (parsed.budgetSpent !== bundle.budgetSpent) patch.budgetSpent = parsed.budgetSpent;
    if (parsed.revenue !== bundle.revenue) patch.revenue = parsed.revenue;
    if (parsed.clicks !== bundle.clicks) patch.clicks = parsed.clicks;
    if (parsed.conversions !== bundle.conversions) patch.conversions = parsed.conversions;
    if ((parsed.notes ?? "") !== (bundle.notes ?? "")) patch.notes = parsed.notes ?? "";
    if (sameIds(parsed.geoIds, bundle.geos.map((geo) => geo.id)) === false) patch.geoIds = parsed.geoIds;
    if (sameIds(parsed.tagIds, bundle.tags.map((tag) => tag.id)) === false) patch.tagIds = parsed.tagIds;

    if (Object.keys(patch).length === 0) {
      close();
      return;
    }

    update.mutate({ id: bundle.id, patch });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{bundle ? "Edit bundle" : "New bundle"}</DialogTitle>
          <DialogDescription>
            {bundle
              ? "Only the fields you changed are recorded in the bundle history."
              : "A buyer always owns the bundle they create; an admin can assign it to someone else."}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed by id so switching between bundles remounts the form with fresh defaults. */}
        <BundleForm
          key={bundle?.id ?? "create"}
          facets={facets}
          isAdmin={isAdmin}
          bundle={bundle}
          pending={pending}
          onSubmit={submit}
          onCancel={close}
        />
      </DialogContent>
    </Dialog>
  );
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = [...b].sort();
  return [...a].sort().every((value, index) => value === sorted[index]);
}
