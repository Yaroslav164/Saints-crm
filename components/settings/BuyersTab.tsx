"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ConfirmDeleteDialog,
  DictionaryCard,
  Field,
  PluralBundles,
  RecordDialog,
  RowActions,
} from "@/components/settings/shared";
import { useBuyers, useDeleteReference, useSaveReference } from "@/hooks/useReferences";
import { fieldErrors, userUpdateSchema } from "@/lib/validations";
import { cn, formatDate, initials } from "@/lib/utils";
import type { Role } from "@/lib/generated/prisma/enums";
import type { UserRecord } from "@/types";

type Draft = { name: string; email: string; role: Role; isActive: boolean };

/**
 * Buyers. Admin-only screen (the API refuses the read for everyone else, because this
 * list carries emails and roles). Two rules the UI mirrors and the server enforces: you
 * cannot strip your own access, and the last admin cannot be demoted — with `authorize()`
 * refusing a disabled account, that is how a team locks itself out of its own CRM.
 */
export function BuyersTab({ canManage }: { canManage: boolean }) {
  const buyers = useBuyers();
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [removing, setRemoving] = useState<UserRecord | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useSaveReference<UserRecord>("users", "Account", () => setEditing(null));
  const remove = useDeleteReference("users", "Account");

  const openForm = (target: UserRecord) => {
    setDraft({ name: target.name, email: target.email, role: target.role, isActive: target.isActive });
    setErrors({});
    setEditing(target);
  };

  const submit = () => {
    if (!editing || !draft) return;
    const parsed = userUpdateSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    // Only what changed goes back: `email` is unique and rewriting the same value is
    // harmless, but a payload with the fields the admin did not touch is a surprise.
    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined && parsed.data.name !== editing.name) patch.name = parsed.data.name;
    if (parsed.data.email !== undefined && parsed.data.email.toLowerCase() !== editing.email) patch.email = parsed.data.email;
    if (parsed.data.role !== undefined && parsed.data.role !== editing.role) patch.role = parsed.data.role;
    if (parsed.data.isActive !== undefined && parsed.data.isActive !== editing.isActive) patch.isActive = parsed.data.isActive;
    if (Object.keys(patch).length === 0) {
      setEditing(null);
      return;
    }

    save.mutate({ id: editing.id, body: patch });
  };

  const rows = buyers.data ?? [];
  const editingSelf = editing?.isSelf ?? false;

  return (
    <>
      <DictionaryCard
        title="Buyers"
        description="Roles and access. Registration is open to the team, so a new member appears here as USER and gets promoted from this screen."
        canManage={false}
        isPending={buyers.isPending}
        error={buyers.isError ? buyers.error.message : undefined}
        count={rows.length}
      >
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-2.5">
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">{initials(row.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className={cn("truncate text-sm font-medium", !row.isActive && "text-muted-foreground")}>
                  {row.name}
                  {row.isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.email} · since {formatDate(row.createdAt)}
                </p>
              </div>
              <Badge variant={row.role === "ADMIN" ? "default" : "secondary"}>{row.role === "ADMIN" ? "Admin" : "Buyer"}</Badge>
              {!row.isActive && <Badge variant="outline">Disabled</Badge>}
              <span className="hidden w-20 shrink-0 text-right text-xs text-muted-foreground sm:block">
                {PluralBundles(row.bundleCount)}
              </span>
              {canManage && <RowActions canManage onEdit={() => openForm(row)} onDelete={() => setRemoving(row)} hideDelete={row.isSelf} />}
            </li>
          ))}
        </ul>
      </DictionaryCard>

      <RecordDialog
        open={editing !== null && draft !== null}
        onOpenChange={() => setEditing(null)}
        title={`Edit ${editing?.name ?? "account"}`}
        description={
          editingSelf
            ? "This is your own account: role and access cannot be changed here, so somebody else has to promote you."
            : "Disabling an account blocks its next sign-in. An open session keeps working until it is signed out."
        }
        pending={save.isPending}
        submitLabel="Save changes"
        onSubmit={submit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="buyerName" label="Name" error={errors.name}>
            <Input id="buyerName" value={draft?.name ?? ""} onChange={(event) => setDraft({ ...(draft as Draft), name: event.target.value })} />
          </Field>
          <Field id="buyerEmail" label="Email" error={errors.email} hint="Must stay unique">
            <Input id="buyerEmail" type="email" value={draft?.email ?? ""} onChange={(event) => setDraft({ ...(draft as Draft), email: event.target.value })} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="buyerRole" label="Role" error={errors.role} hint={editingSelf ? "Locked for your own account" : undefined}>
            <Select
              value={draft?.role ?? "USER"}
              disabled={editingSelf}
              onValueChange={(value) => setDraft({ ...(draft as Draft), role: value as Role })}
            >
              <SelectTrigger id="buyerRole" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">Buyer</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <label className="flex items-end gap-2 pb-1 text-sm">
            <Checkbox
              checked={draft?.isActive ?? false}
              disabled={editingSelf}
              onCheckedChange={(next) => setDraft({ ...(draft as Draft), isActive: next === true })}
            />
            Account may sign in
          </label>
        </div>
      </RecordDialog>

      <ConfirmDeleteDialog
        open={removing !== null}
        onOpenChange={(open) => (open ? null : setRemoving(null))}
        name={removing?.name ?? ""}
        detail={
          removing && removing.bundleCount > 0
            ? `${removing.name} still owns ${PluralBundles(removing.bundleCount)}, so the delete will be refused. Reassign the bundles or disable the account instead.`
            : `${removing?.name ?? ""} owns no bundles. Their comments and history entries go with the account.`
        }
        pending={remove.isPending}
        onConfirm={() => {
          if (removing) remove.mutate(removing.id, { onSuccess: () => setRemoving(null) });
        }}
      />
    </>
  );
}
