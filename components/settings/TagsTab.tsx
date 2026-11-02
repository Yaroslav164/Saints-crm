"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ConfirmDeleteDialog,
  DictionaryCard,
  Field,
  PluralBundles,
  RecordDialog,
  RowActions,
} from "@/components/settings/shared";
import { useDeleteReference, useSaveReference, useTags } from "@/hooks/useReferences";
import { fieldErrors, tagSchema } from "@/lib/validations";
import { cn } from "@/lib/utils";
import type { TagRecord } from "@/types";

/** Handpicked so the palette stays readable in both themes; the hex field is free. */
const SWATCHES = ["#ef4444", "#f97316", "#eab308", "#10b981", "#3b82f6", "#6366f1", "#a855f7", "#64748b"];

type Draft = { name: string; color: string };

const EMPTY: Draft = { name: "", color: SWATCHES[5] };

/**
 * Tags. The colour is a data value rather than a token because it identifies the tag
 * wherever it is printed (table cell, filter chip, badge), the same reasoning as the
 * status palette in `lib/status.ts`.
 */
export function TagsTab({ canManage }: { canManage: boolean }) {
  const tags = useTags();
  const [editing, setEditing] = useState<TagRecord | "new" | null>(null);
  const [removing, setRemoving] = useState<TagRecord | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useSaveReference<TagRecord>("tags", "Tag", () => setEditing(null));
  const remove = useDeleteReference("tags", "Tag");

  const openForm = (target: TagRecord | "new") => {
    setDraft(target === "new" ? EMPTY : { name: target.name, color: target.color });
    setErrors({});
    setEditing(target);
  };

  const submit = () => {
    if (!editing) return;
    const parsed = tagSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    save.mutate({ id: editing === "new" ? undefined : editing.id, body: parsed.data });
  };

  const rows = tags.data ?? [];

  return (
    <>
      <DictionaryCard
        title="Tags"
        description="Free labels for a bundle — heat, approach, risk. Deleting a tag only unlinks it."
        canManage={canManage}
        addLabel="New tag"
        onAdd={() => openForm("new")}
        isPending={tags.isPending}
        error={tags.isError ? tags.error.message : undefined}
        count={rows.length}
      >
        <ul className="divide-y divide-border">
          {rows.map((tag) => (
            <li key={tag.id} className="flex items-center gap-3 py-2.5">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: tag.color }} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm">{tag.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{tag.color}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{PluralBundles(tag.bundleCount)}</span>
              <RowActions canManage={canManage} onEdit={() => openForm(tag)} onDelete={() => setRemoving(tag)} />
            </li>
          ))}
        </ul>
      </DictionaryCard>

      <RecordDialog
        open={editing !== null}
        onOpenChange={() => setEditing(null)}
        title={editing === "new" ? "New tag" : "Edit tag"}
        description="Names are unique; the colour is what shows up on the badge."
        pending={save.isPending}
        submitLabel={editing === "new" ? "Create tag" : "Save changes"}
        onSubmit={submit}
      >
        <Field id="tagName" label="Name" error={errors.name}>
          <Input id="tagName" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="new approach" />
        </Field>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Colour</Label>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Use ${color}`}
                onClick={() => setDraft({ ...draft, color })}
                className={cn(
                  "size-6 rounded-full border transition-transform hover:scale-110",
                  draft.color.toLowerCase() === color ? "border-foreground ring-2 ring-ring" : "border-border",
                )}
                style={{ background: color }}
              />
            ))}
          </div>
          <Input
            id="tagColor"
            value={draft.color}
            onChange={(event) => setDraft({ ...draft, color: event.target.value })}
            className="font-mono"
            aria-describedby="tagColorError"
          />
          {errors.color && (
            <p id="tagColorError" className="text-xs text-destructive">
              {errors.color}
            </p>
          )}
        </div>
      </RecordDialog>

      <ConfirmDeleteDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? null : setRemoving(null))}
        name={removing?.name ?? ""}
        detail={
          removing && removing.bundleCount > 0
            ? `The tag disappears from ${PluralBundles(removing.bundleCount)}. Nothing else about those bundles changes.`
            : "No bundle uses this tag."
        }
        pending={remove.isPending}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
    </>
  );
}
