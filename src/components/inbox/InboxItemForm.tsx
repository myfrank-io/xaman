"use client";

import { useTranslations } from "next-intl";

import { CategoryChips, type CategoryChoice } from "@/components/common/CategoryChips";
import { ContactPicker } from "@/components/contacts/ContactPicker";
import type { ContactOption } from "@/components/contacts/specialties";
import { Field } from "@/components/forms/Field";
import type { InboxDraft, InboxEngine } from "@/components/inbox/inbox-draft";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericField } from "@/components/ui/numeric-field";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DateField } from "@/components/ui/date-field";
import type { InboxKind } from "@/lib/schemas/inbox";
import { VISIBLE_PURCHASE_KINDS, type VisiblePurchaseKind } from "@/lib/schemas/purchases";

/**
 * The fields of a document being filed: what the reading proposed, all of it editable, and
 * nothing else — the buttons and everything that writes stay on the card (`InboxItemCard`).
 *
 * A card with a warning opens straight on this form; a card without one opens on its one-line
 * summary and comes here on « Modifier », with exactly the same fields.
 */
export function InboxItemForm({
  boatId,
  itemId,
  draft,
  onChange,
  errors,
  categories,
  engines,
  contacts,
  canWrite,
}: {
  boatId: string;
  itemId: string;
  draft: InboxDraft;
  onChange: (changes: Partial<InboxDraft>) => void;
  errors: Record<string, string>;
  categories: CategoryChoice[];
  engines: InboxEngine[];
  contacts: ContactOption[];
  canWrite: boolean;
}) {
  const t = useTranslations("inbox");
  const tk = useTranslations("purchaseKind");

  return (
    <>
      <div className="grid gap-2">
        <Label>{t("fields.kind")}</Label>
        <ToggleGroup
          type="single"
          value={draft.kind}
          aria-label={t("fields.kind")}
          onValueChange={(next) => next && onChange({ kind: next as InboxKind })}
        >
          <ToggleGroupItem value="log" className="min-h-11">
            {t("kind.log")}
          </ToggleGroupItem>
          <ToggleGroupItem value="purchase" className="min-h-11">
            {t("kind.purchase")}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={`inbox-title-${itemId}`}
          label={draft.kind === "log" ? t("fields.title") : t("fields.designation")}
          required
          error={errors.title}
        >
          <Input
            id={`inbox-title-${itemId}`}
            value={draft.title}
            autoComplete="off"
            autoCapitalize="sentences"
            aria-invalid={errors.title ? true : undefined}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </Field>
        <Field id={`inbox-date-${itemId}`} label={t("fields.date")} required error={errors.date}>
          <DateField
            id={`inbox-date-${itemId}`}
            value={draft.date}
            onValueChange={(value) => onChange({ date: value })}
          />
        </Field>
      </div>

      <div className="grid gap-2">
        <Label>{t("fields.category")}</Label>
        <CategoryChips
          categories={categories}
          value={draft.categoryId}
          onValueChange={(id) => onChange({ categoryId: id })}
          label={t("fields.category")}
        />
        {errors.categoryId ? (
          <p role="alert" className="text-caption font-medium text-state-overdue-fg">
            {t("categoryRequired")}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`inbox-amount-${itemId}`} label={t("fields.amount")} error={errors.amount}>
          <NumericField
            id={`inbox-amount-${itemId}`}
            value={draft.amount}
            suffix="€"
            onValueChange={(raw) => onChange({ amount: raw })}
          />
        </Field>
        {draft.kind === "purchase" ? (
          <div className="grid gap-2">
            <Label>{t("fields.purchaseKind")}</Label>
            <ToggleGroup
              type="single"
              value={draft.purchaseKind}
              aria-label={t("fields.purchaseKind")}
              onValueChange={(next) =>
                next && onChange({ purchaseKind: next as VisiblePurchaseKind })
              }
            >
              {VISIBLE_PURCHASE_KINDS.map((kind) => (
                <ToggleGroupItem key={kind} value={kind} className="min-h-11">
                  {tk(kind)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`inbox-contact-${itemId}`}>{t("fields.contact")}</Label>
          <ContactPicker
            id={`inbox-contact-${itemId}`}
            boatId={boatId}
            contacts={contacts}
            value={draft.contactId}
            onValueChange={(contactId) => onChange({ contactId })}
            canCreate={canWrite}
            label={t("fields.contact")}
            crewLabel={t("fields.noContact")}
          />
        </div>
        {draft.kind === "purchase" ? (
          <Field id={`inbox-supplier-${itemId}`} label={t("fields.supplier")}>
            <Input
              id={`inbox-supplier-${itemId}`}
              value={draft.supplierName}
              autoComplete="off"
              placeholder={t("fields.supplierPlaceholder")}
              onChange={(event) => onChange({ supplierName: event.target.value })}
            />
          </Field>
        ) : null}
      </div>

      {draft.kind === "log" && engines.length > 0 ? (
        <div className="grid gap-2">
          <Label>{t("fields.hours")}</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {engines.map((engine) => (
              <Field key={engine.id} id={`inbox-hours-${itemId}-${engine.id}`} label={engine.label}>
                <NumericField
                  id={`inbox-hours-${itemId}-${engine.id}`}
                  value={draft.hours[engine.id] ?? ""}
                  suffix="h"
                  onValueChange={(raw) => onChange({ hours: { ...draft.hours, [engine.id]: raw } })}
                />
              </Field>
            ))}
          </div>
        </div>
      ) : null}

      <Field id={`inbox-notes-${itemId}`} label={t("fields.notes")}>
        <Textarea
          id={`inbox-notes-${itemId}`}
          rows={3}
          value={draft.notes}
          onChange={(event) => onChange({ notes: event.target.value })}
        />
      </Field>
    </>
  );
}
