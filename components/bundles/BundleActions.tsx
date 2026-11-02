"use client";

import { useState } from "react";
import {
  ArchiveIcon,
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BundleDialog } from "@/components/bundles/BundleDialog";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { useArchiveBundle, useDeleteBundle, useSetStatus } from "@/hooks/useBundleDetail";
import type { BundleDetail, BundleFacets } from "@/types";

/**
 * The page's action row. Which buttons appear is decided by the `permissions` the
 * server attached to the bundle, but every handler still goes through an endpoint
 * that re-checks the same rules — hiding a button is politeness, not protection.
 */
export function BundleActions({
  bundle,
  facets,
  isAdmin,
}: {
  bundle: BundleDetail;
  facets: BundleFacets;
  isAdmin: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const setStatus = useSetStatus();
  const archive = useArchiveBundle();
  const remove = useDeleteBundle();
  const pending = setStatus.isPending || archive.isPending || remove.isPending;
  const { canManage, canDelete } = bundle.permissions;
  const historyCount = bundle.activity.filter((entry) => entry.kind === "change").length;
  const commentCount = bundle.activity.length - historyCount;

  if (!canManage && !canDelete) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canManage && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" variant="outline" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Change status
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Move this bundle to</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_ORDER.map((status) => (
              <DropdownMenuItem
                key={status}
                disabled={status === bundle.status}
                onSelect={() => setStatus.mutate({ id: bundle.id, status })}
              >
                <span aria-hidden>{STATUS_META[status].emoji}</span>
                {STATUS_META[status].label}
                {status === bundle.status && <CheckIcon className="ml-auto text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {canManage && (
        <Button type="button" size="sm" disabled={pending} onClick={() => setEditOpen(true)}>
          <PencilIcon />
          Edit
        </Button>
      )}

      {(canManage || canDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="icon-sm" variant="ghost" disabled={pending} aria-label="More actions">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {canManage && (
              <DropdownMenuItem
                disabled={pending}
                onSelect={() => archive.mutate({ id: bundle.id, archived: bundle.isArchived })}
              >
                {bundle.isArchived ? <Undo2Icon /> : <ArchiveIcon />}
                {bundle.isArchived ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onSelect={() => setConfirmDelete(true)}
                >
                  <Trash2Icon />
                  Delete permanently
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <BundleDialog facets={facets} isAdmin={isAdmin} bundle={bundle} open={editOpen} onOpenChange={setEditOpen} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{bundle.name}”?</DialogTitle>
            <DialogDescription>
              Its {historyCount} history entries and {commentCount} comments go with it. This cannot be undone —
              archive instead if the numbers are still worth keeping.
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
                remove.mutate(bundle.id);
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
