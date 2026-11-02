"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  ConfirmDeleteDialog,
  DictionaryCard,
  Field,
  PluralBundles,
  RecordDialog,
  RowActions,
} from "@/components/settings/shared";
import { useDeleteReference, useGeos, useSaveReference } from "@/hooks/useReferences";
import { fieldErrors, geoSchema } from "@/lib/validations";
import type { GeoRecord } from "@/types";

type Draft = { code: string; name: string };

const EMPTY: Draft = { code: "", name: "" };

/**
 * GEOs. Deleting one is allowed even while bundles link it — the join table cascades, so
 * the links drop and the bundles stay. The dialog says that out loud, because "removed
 * from 12 bundles" is a bigger deal than "removed a row".
 */
export function GeosTab({ canManage }: { canManage: boolean }) {
  const geos = useGeos();
  const [editing, setEditing] = useState<GeoRecord | "new" | null>(null);
  const [removing, setRemoving] = useState<GeoRecord | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useSaveReference<GeoRecord>("geos", "GEO", () => setEditing(null));
  const remove = useDeleteReference("geos", "GEO");

  const openForm = (target: GeoRecord | "new") => {
    setDraft(target === "new" ? EMPTY : { code: target.code, name: target.name });
    setErrors({});
    setEditing(target);
  };

  const submit = () => {
    if (!editing) return;
    const parsed = geoSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    save.mutate({ id: editing === "new" ? undefined : editing.id, body: parsed.data });
  };

  const rows = geos.data ?? [];

  return (
    <>
      <DictionaryCard
        title="GEOs"
        description="Two or three letters, the way traffic sources name a country. A bundle can carry several."
        canManage={canManage}
        addLabel="New GEO"
        onAdd={() => openForm("new")}
        isPending={geos.isPending}
        error={geos.isError ? geos.error.message : undefined}
        count={rows.length}
      >
        <ul className="divide-y divide-border">
          {rows.map((geo) => (
            <li key={geo.id} className="flex items-center gap-3 py-2.5">
              <span className="w-12 shrink-0 font-mono text-sm">{geo.code}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{geo.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{PluralBundles(geo.bundleCount)}</span>
              <RowActions canManage={canManage} onEdit={() => openForm(geo)} onDelete={() => setRemoving(geo)} />
            </li>
          ))}
        </ul>
      </DictionaryCard>

      <RecordDialog
        open={editing !== null}
        onOpenChange={() => setEditing(null)}
        title={editing === "new" ? "New GEO" : "Edit GEO"}
        description="The code is unique and is upper-cased for you."
        pending={save.isPending}
        submitLabel={editing === "new" ? "Create GEO" : "Save changes"}
        onSubmit={submit}
      >
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field id="geoCode" label="Code" error={errors.code}>
            <Input id="geoCode" value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })} placeholder="US" maxLength={3} />
          </Field>
          <Field id="geoName" label="Name" error={errors.name}>
            <Input id="geoName" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="United States" />
          </Field>
        </div>
      </RecordDialog>

      <ConfirmDeleteDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? null : setRemoving(null))}
        name={removing?.code ?? ""}
        detail={
          removing && removing.bundleCount > 0
            ? `${removing.bundleCount} bundle${removing.bundleCount === 1 ? "" : "s"} will lose this GEO. The bundles themselves stay — but the next save of each will ask for a GEO again.`
            : "No bundle uses this GEO."
        }
        pending={remove.isPending}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
    </>
  );
}
