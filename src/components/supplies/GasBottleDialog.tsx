"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { ContactOption } from "@/components/contacts/specialties";
import { Field } from "@/components/forms/Field";
import { useFieldError } from "@/components/forms/use-field-error";
import { SupplierField } from "@/components/supplies/SupplierField";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericField } from "@/components/ui/numeric-field";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { upsertPurchase } from "@/lib/actions/purchases";
import { formatDate, todayString } from "@/lib/format";
import type { GasFacts } from "@/lib/gas";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { upsertPurchaseSchema } from "@/lib/schemas/purchases";

export type GasDefaults = {
  /** Distinct bottle types already used on this boat, most recent first. */
  bottleTypes: string[];
  bottleType: string | null;
  supplierContactId: string | null;
  supplierName: string | null;
  categoryId: string | null;
};

const OTHER = "__other";

/**
 * « Bouteille de gaz » (E5-3, flow f): the most ordinary gesture on board, five taps, and
 * the user never reads the word « achat ». Everything is pre-filled from the last change;
 * the footer answers the real question — do I last until the end of the season.
 */
export function GasBottleDialog({
  boatId,
  open,
  onOpenChange,
  contacts,
  defaults,
  facts,
}: {
  boatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactOption[];
  defaults: GasDefaults;
  facts: GasFacts;
}) {
  const t = useTranslations("supplies.gas");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogHelp")}</DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog: fresh state and a fresh row id at every opening (rule 11). */}
        {open ? (
          <GasBottleForm
            boatId={boatId}
            contacts={contacts}
            defaults={defaults}
            facts={facts}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type FieldErrors = Partial<Record<"amount" | "purchasedAt" | "bottleType", string>>;

function GasBottleForm({
  boatId,
  contacts,
  defaults,
  facts,
  onClose,
}: {
  boatId: string;
  contacts: ContactOption[];
  defaults: GasDefaults;
  facts: GasFacts;
  onClose: () => void;
}) {
  const t = useTranslations("supplies.gas");
  const tp = useTranslations("supplies.purchases");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [id] = useState(() => crypto.randomUUID());
  const [purchasedAt, setPurchasedAt] = useState(() => todayString());
  const [choice, setChoice] = useState(defaults.bottleType ?? OTHER);
  const [otherType, setOtherType] = useState("");
  const [contactId, setContactId] = useState(defaults.supplierContactId);
  const [supplierName, setSupplierName] = useState(defaults.supplierName ?? "");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const bottleType = (choice === OTHER ? otherType : choice).trim();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = upsertPurchaseSchema.safeParse({
      id,
      boatId,
      kind: "gas",
      // Generated, never typed: the bottle type is the only thing that varies.
      designation: bottleType ? t("designationTyped", { type: bottleType }) : t("designation"),
      amount,
      purchasedAt,
      supplierContactId: contactId,
      supplierName,
      categoryId: defaults.categoryId,
      bottleType,
      maintenanceLogId: null,
      notes: null,
      needsReview: false,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof FieldErrors;
        next[key] ??= fieldError({ type: issue.code, message: issue.message });
      }
      setErrors(next);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await upsertPurchase(parsed.data);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("saved"), {
        description:
          facts.lastAt !== null && facts.daysSinceLast !== null
            ? t("savedSince", { days: facts.daysSinceLast })
            : undefined,
      });
      onClose();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field id="gas-date" label={tp("fields.purchasedAt")} required error={errors.purchasedAt}>
        <DateField
          id="gas-date"
          value={purchasedAt}
          onValueChange={setPurchasedAt}
          max={todayString()}
        />
      </Field>

      <div className="grid gap-2">
        <Label>{t("bottleType")}</Label>
        <ToggleGroup
          type="single"
          value={choice}
          aria-label={t("bottleType")}
          className="flex-wrap justify-start"
          onValueChange={(value) => value && setChoice(value)}
        >
          {defaults.bottleTypes.map((type) => (
            <ToggleGroupItem key={type} value={type} className="min-h-11">
              {type}
            </ToggleGroupItem>
          ))}
          <ToggleGroupItem value={OTHER} className="min-h-11">
            {t("otherType")}
          </ToggleGroupItem>
        </ToggleGroup>
        {choice === OTHER ? (
          <Field id="gas-other-type" label={t("otherTypeLabel")} error={errors.bottleType}>
            <Input
              id="gas-other-type"
              value={otherType}
              onChange={(event) => setOtherType(event.target.value)}
              autoComplete="off"
              className="max-w-sm"
            />
          </Field>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="gas-supplier">{tp("fields.supplier")}</Label>
        <SupplierField
          id="gas-supplier"
          boatId={boatId}
          contacts={contacts}
          contactId={contactId}
          name={supplierName}
          onContactChange={setContactId}
          onNameChange={setSupplierName}
          label={tp("fields.supplier")}
          nameLabel={tp("fields.supplierName")}
        />
      </div>

      <Field id="gas-amount" label={tp("fields.amount")} error={errors.amount}>
        <NumericField
          id="gas-amount"
          value={amount}
          onValueChange={(raw) => setAmount(raw)}
          suffix="€"
          enterKeyHint="done"
          className="max-w-40"
          containerClassName="max-w-40"
          aria-invalid={errors.amount ? true : undefined}
        />
      </Field>

      {facts.previousAt ? (
        <p className="num text-caption text-ink-2">
          {[
            t("previousChange", { date: formatDate(facts.lastAt) }),
            facts.averageDays !== null
              ? t("facts.average", { days: facts.averageDays, count: facts.intervalCount })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {tc("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner className="size-4" /> : null}
          {pending ? tc("saving") : tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
