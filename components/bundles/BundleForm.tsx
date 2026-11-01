"use client";

import { useWatch, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_META, STATUS_ORDER } from "@/lib/status";
import { cn, formatCurrency, formatPercent, roundTo } from "@/lib/utils";
import { bundleSchema } from "@/lib/validations";
import type { BundleFacets, BundleListItem } from "@/types";
import type { BundleStatus } from "@/lib/generated/prisma/enums";

/**
 * Form value shape. Money and counters stay strings here because that is what a
 * number input holds; `bundleSchema` coerces them on submit, so the UI never has
 * to fight `NaN` while a field is half-typed.
 */
export type BundleFormValues = {
  name: string;
  offerId: string;
  angle: string;
  creative: string;
  geoIds: string[];
  userId: string;
  status: BundleStatus;
  budgetPlanned: string;
  budgetSpent: string;
  revenue: string;
  clicks: string;
  conversions: string;
  notes: string;
  tagIds: string[];
};

const EMPTY: BundleFormValues = {
  name: "",
  offerId: "",
  angle: "",
  creative: "",
  geoIds: [],
  userId: "",
  status: "IDEA",
  budgetPlanned: "0",
  budgetSpent: "0",
  revenue: "0",
  clicks: "0",
  conversions: "0",
  notes: "",
  tagIds: [],
};

function toValues(bundle: BundleListItem): BundleFormValues {
  return {
    name: bundle.name,
    offerId: bundle.offer.id,
    angle: bundle.angle,
    creative: bundle.creative ?? "",
    geoIds: bundle.geos.map((geo) => geo.id),
    userId: bundle.buyer.id,
    status: bundle.status,
    budgetPlanned: String(bundle.budgetPlanned),
    budgetSpent: String(bundle.budgetSpent),
    revenue: String(bundle.revenue),
    clicks: String(bundle.clicks),
    conversions: String(bundle.conversions),
    notes: bundle.notes ?? "",
    tagIds: bundle.tags.map((tag) => tag.id),
  };
}

const num = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function BundleForm({
  facets,
  isAdmin,
  bundle,
  pending,
  onSubmit,
  onCancel,
}: {
  facets: BundleFacets;
  isAdmin: boolean;
  bundle?: BundleListItem | null;
  pending: boolean;
  onSubmit: (values: BundleFormValues) => void;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<BundleFormValues>({
    // The schema coerces strings to numbers and carries defaults, so its input
    // type is wider than the form's; the resolver is where the two meet.
    resolver: zodResolver(bundleSchema) as unknown as Resolver<BundleFormValues>,
    defaultValues: bundle ? toValues(bundle) : { ...EMPTY, userId: facets.buyers[0]?.id ?? "" },
  });

  // useWatch rather than watch(): the React Compiler rule flags watch() because
  // its result cannot be memoized safely, and these values feed renders below.
  const values = useWatch({ control }) as BundleFormValues;
  const [spent, revenue, clicks, conversions] = useWatch({
    control,
    name: ["budgetSpent", "revenue", "clicks", "conversions"],
  });

  const derived = {
    cr: roundTo(num(clicks) ? (num(conversions) / num(clicks)) * 100 : 0, 2),
    roi: roundTo(num(spent) ? ((num(revenue) - num(spent)) / num(spent)) * 100 : 0, 2),
    roas: roundTo(num(spent) ? num(revenue) / num(spent) : 0, 2),
    profit: roundTo(num(revenue) - num(spent)),
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Bundle name" error={errors.name?.message} className="sm:col-span-2">
          <Input id="name" placeholder="Dating US - Smartlink - Video v2" aria-invalid={Boolean(errors.name)} {...register("name")} />
        </Field>

        <Field id="offerId" label="Offer" error={errors.offerId?.message}>
          <Select value={values.offerId} onValueChange={(value) => setValue("offerId", value, { shouldValidate: true })}>
            <SelectTrigger id="offerId" className="w-full">
              <SelectValue placeholder="Pick an offer" />
            </SelectTrigger>
            <SelectContent>
              {facets.offers.map((offer) => (
                <SelectItem key={offer.id} value={offer.id}>
                  {offer.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="status" label="Status" error={errors.status?.message}>
          <Select value={values.status} onValueChange={(value) => setValue("status", value as BundleStatus, { shouldValidate: true })}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ORDER.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_META[status].emoji} {STATUS_META[status].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="angle" label="Angle / approach" error={errors.angle?.message} className="sm:col-span-2">
          <Textarea id="angle" rows={2} placeholder="What the creative sells and how" aria-invalid={Boolean(errors.angle)} {...register("angle")} />
        </Field>

        <Field id="creative" label="Creative (URL)" error={errors.creative?.message} hint="Link to the drive folder or landing" className="sm:col-span-2">
          <Input id="creative" inputMode="url" placeholder="https://drive.google.com/..." aria-invalid={Boolean(errors.creative)} {...register("creative")} />
        </Field>

        <MultiSelect
          label="GEO"
          options={facets.geos}
          value={values.geoIds}
          onChange={(next) => setValue("geoIds", next, { shouldValidate: true })}
          error={errors.geoIds?.message}
        />

        <MultiSelect
          label="Tags"
          options={facets.tags}
          value={values.tagIds}
          onChange={(next) => setValue("tagIds", next, { shouldValidate: true })}
        />

        {isAdmin && (
          <Field id="userId" label="Buyer" error={errors.userId?.message} hint="Only an admin can reassign">
            <Select value={values.userId} onValueChange={(value) => setValue("userId", value, { shouldValidate: true })}>
              <SelectTrigger id="userId" className="w-full">
                <SelectValue placeholder="Assign a buyer" />
              </SelectTrigger>
              <SelectContent>
                {facets.buyers.map((buyer) => (
                  <SelectItem key={buyer.id} value={buyer.id}>
                    {buyer.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:col-span-2">
          <Field id="budgetPlanned" label="Budget, $" error={errors.budgetPlanned?.message}>
            <Input id="budgetPlanned" type="number" min="0" step="1" aria-invalid={Boolean(errors.budgetPlanned)} {...register("budgetPlanned")} />
          </Field>
          <Field id="budgetSpent" label="Spent, $" error={errors.budgetSpent?.message}>
            <Input id="budgetSpent" type="number" min="0" step="0.01" aria-invalid={Boolean(errors.budgetSpent)} {...register("budgetSpent")} />
          </Field>
          <Field id="revenue" label="Revenue, $" error={errors.revenue?.message}>
            <Input id="revenue" type="number" min="0" step="0.01" aria-invalid={Boolean(errors.revenue)} {...register("revenue")} />
          </Field>
          <Field id="clicks" label="Clicks" error={errors.clicks?.message}>
            <Input id="clicks" type="number" min="0" step="1" aria-invalid={Boolean(errors.clicks)} {...register("clicks")} />
          </Field>
          <Field id="conversions" label="Conversions" error={errors.conversions?.message}>
            <Input id="conversions" type="number" min="0" step="1" aria-invalid={Boolean(errors.conversions)} {...register("conversions")} />
          </Field>
        </div>

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs text-muted-foreground">Calculated from the numbers above</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "CR", value: `${derived.cr.toFixed(2)}%` },
              { label: "ROI", value: formatPercent(derived.roi), tone: derived.roi },
              { label: "ROAS", value: derived.roas.toFixed(2) },
              { label: "Profit", value: formatCurrency(derived.profit), tone: derived.profit },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-muted/60 px-3 py-2">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    item.tone === undefined ? undefined : item.tone > 0 ? "text-success" : item.tone < 0 ? "text-destructive" : undefined,
                  )}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        <Field id="notes" label="Notes" error={errors.notes?.message} className="sm:col-span-2">
          <Textarea id="notes" rows={3} placeholder="Findings, decisions, next steps" aria-invalid={Boolean(errors.notes)} {...register("notes")} />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : bundle ? "Save changes" : "Create bundle"}
        </Button>
      </div>
    </form>
  );
}

function Field({
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

/** Multi-select over a dictionary: popover with checkboxes, summary in the trigger. */
function MultiSelect({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { id: string; label: string; color?: string }[];
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("h-8 w-full justify-between font-normal", error && "border-destructive")}
          >
            <span className="truncate">
              {value.length
                ? options.filter((option) => value.includes(option.id)).map((option) => option.label).join(", ")
                : `Select ${label.toLowerCase()}`}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">{value.length}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-60 p-1">
          <ul className="max-h-60 space-y-0.5 overflow-y-auto">
            {options.map((option) => {
              const selected = value.includes(option.id);
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => toggle(option.id)}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded border",
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {selected && <CheckIcon className="size-3" />}
                    </span>
                    {option.color && <span className="size-2 rounded-full" style={{ background: option.color }} />}
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
