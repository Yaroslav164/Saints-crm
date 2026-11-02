"use client";

import { useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  ConfirmDeleteDialog,
  DictionaryCard,
  Field,
  PluralBundles,
  RecordDialog,
  RowActions,
} from "@/components/settings/shared";
import { useDeleteReference, useOffers, useSaveReference } from "@/hooks/useReferences";
import { fieldErrors, offerSchema } from "@/lib/validations";
import { cn, formatCurrency } from "@/lib/utils";
import type { OfferRecord } from "@/types";

type Draft = { name: string; url: string; payoutUSD: string; network: string; isActive: boolean };

const EMPTY: Draft = { name: "", url: "", payoutUSD: "0", network: "", isActive: true };

const toDraft = (offer: OfferRecord): Draft => ({
  name: offer.name,
  url: offer.url ?? "",
  payoutUSD: String(offer.payoutUSD),
  network: offer.network ?? "",
  isActive: offer.isActive,
});

/**
 * Offers. An offer that a bundle still points at cannot be deleted (the foreign key is
 * RESTRICT), so the row explains the alternative: deactivating hides it from the form and
 * the filters while every past bundle keeps its name.
 */
export function OffersTab({ canManage }: { canManage: boolean }) {
  const offers = useOffers();
  const [editing, setEditing] = useState<OfferRecord | "new" | null>(null);
  const [removing, setRemoving] = useState<OfferRecord | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useSaveReference<OfferRecord>("offers", "Offer", () => setEditing(null));
  const remove = useDeleteReference("offers", "Offer");

  const openForm = (target: OfferRecord | "new") => {
    setDraft(target === "new" ? EMPTY : toDraft(target));
    setErrors({});
    setEditing(target);
  };

  const submit = () => {
    if (!editing) return;
    const parsed = offerSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    save.mutate({ id: editing === "new" ? undefined : editing.id, body: parsed.data });
  };

  const rows = offers.data ?? [];

  return (
    <>
      <DictionaryCard
        title="Offers"
        description="Payout and network as recorded in the affiliate account; the payout is what a bundle's revenue is checked against."
        canManage={canManage}
        addLabel="New offer"
        onAdd={() => openForm("new")}
        isPending={offers.isPending}
        error={offers.isError ? offers.error.message : undefined}
        count={rows.length}
      >
        <ul className="divide-y divide-border">
          {rows.map((offer) => (
            <li key={offer.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium", !offer.isActive && "text-muted-foreground")}>
                  {offer.name}
                  {!offer.isActive && (
                    <Badge variant="outline" className="ml-2">
                      Inactive
                    </Badge>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {offer.network ?? "No network"} · payout {formatCurrency(offer.payoutUSD)} · used by{" "}
                  {PluralBundles(offer.bundleCount)}
                </p>
              </div>
              {offer.url && (
                <a
                  href={offer.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Open ${offer.name}`}
                >
                  <ExternalLinkIcon className="size-4" />
                </a>
              )}
              <RowActions canManage={canManage} onEdit={() => openForm(offer)} onDelete={() => setRemoving(offer)} />
            </li>
          ))}
        </ul>
      </DictionaryCard>

      <RecordDialog
        open={editing !== null}
        onOpenChange={() => setEditing(null)}
        title={editing === "new" ? "New offer" : "Edit offer"}
        description="The name is unique — bundles reference an offer by it in the history feed."
        pending={save.isPending}
        submitLabel={editing === "new" ? "Create offer" : "Save changes"}
        onSubmit={submit}
      >
        <Field id="offerName" label="Name" error={errors.name}>
          <Input id="offerName" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Dating Smartlink US" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="offerPayout" label="Payout, $" error={errors.payoutUSD}>
            <Input id="offerPayout" type="number" min="0" step="0.01" value={draft.payoutUSD} onChange={(e) => setDraft({ ...draft, payoutUSD: e.target.value })} />
          </Field>
          <Field id="offerNetwork" label="Network" error={errors.network} hint="Affiliate network or direct">
            <Input id="offerNetwork" value={draft.network} onChange={(e) => setDraft({ ...draft, network: e.target.value })} placeholder="Crakac" />
          </Field>
        </div>
        <Field id="offerUrl" label="Offer URL" error={errors.url} hint="Left blank if the link is internal">
          <Input id="offerUrl" inputMode="url" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://…" />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={draft.isActive} onCheckedChange={(next) => setDraft({ ...draft, isActive: next === true })} />
          Active — shown in the bundle form and the filters
        </label>
      </RecordDialog>

      <ConfirmDeleteDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? null : setRemoving(null))}
        name={removing?.name ?? ""}
        detail={
          removing && removing.bundleCount > 0
            ? `${removing.name} is used by ${PluralBundles(removing.bundleCount)} — deleting it will be refused. Deactivate it instead: the dictionary shrinks, the history stays.`
            : "Nothing references this offer, so removing it is safe."
        }
        pending={remove.isPending}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
    </>
  );
}
