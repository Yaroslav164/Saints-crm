"use client";

import { useState } from "react";
import { ArchiveIcon, Loader2Icon, Trash2Icon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { useBulkBundles } from "@/hooks/useBundles";
import type { BundleStatus } from "@/lib/generated/prisma/enums";

/**
 * Appears once rows are checked. The server answers with how many rows it
 * actually touched, so a buyer selecting someone else's bundle sees "skipped"
 * instead of a silent partial success.
 */
export function BulkActionsBar({
  selectedIds,
  isAdmin,
  onClear,
}: {
  selectedIds: string[];
  isAdmin: boolean;
  onClear: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bulk = useBulkBundles(onClear);
  const pending = bulk.isPending;

  if (selectedIds.length === 0) return null;

  const run = (payload: Parameters<typeof bulk.mutate>[0]) => bulk.mutate(payload);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-2">
      <span className="text-sm font-medium">
        {selectedIds.length} selected
      </span>

      <Select
        value=""
        disabled={pending}
        // Select hands back a plain string; the option list below is exactly the
        // BundleStatus union, so this cast is the boundary check.
        onValueChange={(value) => run({ action: "status", ids: selectedIds, status: value as BundleStatus })}
      >
        <SelectTrigger size="sm" className="h-8 w-40" aria-label="Set status for selected">
          <SelectValue placeholder="Set status…" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ORDER.map((status) => (
            <SelectItem key={status} value={status}>
              {STATUS_META[status].emoji} {STATUS_META[status].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run({ action: "archive", ids: selectedIds })}>
        <ArchiveIcon />
        Archive
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run({ action: "unarchive", ids: selectedIds })}>
        <Undo2Icon />
        Unarchive
      </Button>
      {isAdmin && (
        <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => setConfirmDelete(true)}>
          <Trash2Icon />
          Delete
        </Button>
      )}

      <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onClear} className="ml-auto">
        Clear
      </Button>
      {pending && <Loader2Icon className="size-4 animate-spin text-muted-foreground" />}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.length} bundle{selectedIds.length === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              Their change history and comments are removed with them. This cannot be undone — archive instead if you
              only want them out of the working list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false);
                run({ action: "delete", ids: selectedIds });
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
