"use client";

import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Shared frame for the dictionary tabs. The list screens differ in their columns, not
 * in their shape, so the card, the empty/loading states and the two action buttons are
 * declared once — and the delete confirmation is a plain dialog rather than a browser
 * `confirm()`, which would ignore the app's theme.
 */

export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DictionaryCard({
  title,
  description,
  canManage,
  addLabel,
  onAdd,
  isPending,
  error,
  count,
  children,
}: {
  title: string;
  description: React.ReactNode;
  canManage: boolean;
  /** Omitted for a dictionary that has no create path — accounts come from registration. */
  addLabel?: string;
  onAdd?: () => void;
  isPending: boolean;
  error?: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="px-4 pt-4 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-sm">
              {title}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">{count}</span>
            </CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
          {canManage && (
            <Button type="button" size="sm" onClick={onAdd}>
              <PlusIcon />
              {addLabel}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isPending ? (
          <div className="space-y-2">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : count === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nothing here yet.</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/** The row's edit/delete buttons. Buyers keep them for themselves — a USER reads the list, never writes it. */
export function RowActions({
  canManage,
  onEdit,
  onDelete,
  hideDelete = false,
}: {
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  hideDelete?: boolean;
}) {
  if (!canManage) return null;

  return (
    <div className="flex shrink-0 gap-1">
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Edit" onClick={onEdit}>
        <PencilIcon />
      </Button>
      {!hideDelete && (
        <Button type="button" size="icon-sm" variant="ghost" aria-label="Delete" onClick={onDelete}>
          <Trash2Icon className="text-destructive" />
        </Button>
      )}
    </div>
  );
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  name,
  detail,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  detail: React.ReactNode;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove “{name}”?</DialogTitle>
          <DialogDescription>{detail}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Dialog that wraps a dictionary form: title, description and the two buttons are the same everywhere. */
export function RecordDialog({
  open,
  onOpenChange,
  title,
  description,
  pending,
  submitLabel,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: () => void;
  title: string;
  description: React.ReactNode;
  pending: boolean;
  submitLabel: string;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? null : onOpenChange())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* Native submit is kept off: these forms are short enough that a button (and
            Enter through the last input) is the only path we need to validate. */}
        <div className="space-y-4">{children}</div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onOpenChange} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PluralBundles(count: number): string {
  return `${count} bundle${count === 1 ? "" : "s"}`;
}
