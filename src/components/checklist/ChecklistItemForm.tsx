"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, XIcon } from "lucide-react";

import { AttachmentFormSection } from "@/components/attachments/AttachmentFormSection";
import { pendingRows, type PickedAttachment } from "@/components/attachments/AttachmentPicker";
import { saveAttachments } from "@/lib/actions/attachments";
import type { AttachmentItem } from "@/lib/queries/attachments";

import { CategoryChipsMulti, type CategoryChoice } from "@/components/common/CategoryChips";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { PageHeader } from "@/components/common/PageHeader";
import { DiscardDialog } from "@/components/forms/DiscardDialog";
import { Field } from "@/components/forms/Field";
import { FormActionBar } from "@/components/forms/FormActionBar";
import { numberToInput, textToInput } from "@/components/forms/form-values";
import { useFieldError } from "@/components/forms/use-field-error";
import { useUnsavedGuard } from "@/components/forms/use-unsaved-guard";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { NumericField } from "@/components/ui/numeric-field";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { setChecklistItemActive, upsertChecklistItem } from "@/lib/actions/checklist";
import { todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { categoryPath, checklistPath } from "@/lib/queries/boat-routes";
import {
  CHECKLIST_CATEGORIES_MAX,
  INTERVAL_MONTH_PRESETS,
  upsertChecklistItemSchema,
} from "@/lib/schemas/checklist";

export type ChecklistItemFormValues = {
  id: string;
  categoryId: string;
  categoryIds?: string[];
  label: string;
  description: string | null;
  intervalMonths: number | null;
  intervalHours: number | null;
  engineId: string | null;
  actions: string[];
  anchorDate: string;
  isActive: boolean;
  completionsCount: number;
  updatedAt: string;
};

type Preset = "3" | "6" | "12" | "24" | "36" | "other" | "none";
type FieldKey =
  | "label"
  | "categoryIds"
  | "intervalMonths"
  | "intervalHours"
  | "engineId"
  | "description"
  | "anchorDate"
  | "actions";

function presetOf(months: number | null): Preset {
  if (months === null) return "none";
  return (INTERVAL_MONTH_PRESETS as readonly number[]).includes(months)
    ? (String(months) as Preset)
    : "other";
}

// Creation and editing share the same categories and document controls as interventions.
export function ChecklistItemForm({
  boatId,
  categories,
  engines,
  item,
  defaultCategoryId,
  existingLabels,
  attachments = [],
}: {
  boatId: string;
  categories: CategoryChoice[];
  engines: { id: string; label: string; tracksHours: boolean }[];
  item: ChecklistItemFormValues | null;
  defaultCategoryId: string;
  existingLabels: string[];
  attachments?: AttachmentItem[];
}) {
  const t = useTranslations("checklist.form");
  const ta = useTranslations("attachments");
  const ti = useTranslations("checklist.item");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newId] = useState(() => crypto.randomUUID());
  const [categoryIds, setCategoryIds] = useState(
    item?.categoryIds ??
      (item?.categoryId || defaultCategoryId ? [item?.categoryId ?? defaultCategoryId] : []),
  );
  const [picked, setPicked] = useState<PickedAttachment[]>([]);
  const version = useRef(item?.updatedAt);
  const submitting = useRef(false);
  const attachmentBlocked = picked.some((file) => file.stage !== "done");
  const [label, setLabel] = useState(item?.label ?? "");
  const [preset, setPreset] = useState<Preset>(item ? presetOf(item.intervalMonths) : "12");
  const [otherMonths, setOtherMonths] = useState(
    item && presetOf(item.intervalMonths) === "other" ? numberToInput(item.intervalMonths) : "",
  );
  const [intervalHours, setIntervalHours] = useState(numberToInput(item?.intervalHours));
  const [engineId, setEngineId] = useState(item?.engineId ?? "");
  const [description, setDescription] = useState(textToInput(item?.description));
  const [steps, setSteps] = useState<string[]>(item?.actions ?? []);
  const [anchorDate, setAnchorDate] = useState(item?.anchorDate ?? "");
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmActive, setConfirmActive] = useState(false);
  const guard = useUnsavedGuard((dirty || picked.some((file) => !file.persisted)) && !saved);

  // D73: an hour interval on an engine without a meter is a deadline nothing can ever compute.
  // Non-blocking: the value is kept, and comes back the day a meter is fitted.
  const meterless =
    engineId !== "" && engines.find((engine) => engine.id === engineId)?.tracksHours === false;

  const duplicate =
    label.trim() !== "" &&
    existingLabels.some(
      (existing) =>
        existing.toLocaleLowerCase("fr") === label.trim().toLocaleLowerCase("fr") &&
        existing !== item?.label,
    );

  function touch<T>(setter: (value: T) => void) {
    return (value: T) => {
      setDirty(true);
      setter(value);
    };
  }

  function moveStep(index: number, direction: -1 | 1) {
    const next = [...steps];
    const target = index + direction;
    const current = next[index];
    const other = next[target];
    if (current === undefined || other === undefined) return;
    next[index] = other;
    next[target] = current;
    touch(setSteps)(next);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (attachmentBlocked) {
      toast.error(ta("waitForFiles"));
      return;
    }
    const intervalMonths =
      preset === "none" ? null : preset === "other" ? otherMonths : Number(preset);
    const parsed = upsertChecklistItemSchema.safeParse({
      id: item?.id ?? newId,
      boatId,
      expectedUpdatedAt: version.current,
      categoryIds,
      label,
      description,
      intervalMonths,
      intervalHours,
      engineId,
      actions: steps,
      anchorDate,
    });
    if (!parsed.success) {
      const next: Partial<Record<FieldKey, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as FieldKey;
        next[key] ??= fieldError({ type: issue.code, message: issue.message });
      }
      setErrors(next);
      return;
    }
    setErrors({});
    submitting.current = true;
    startTransition(async () => {
      try {
        const result = await upsertChecklistItem(parsed.data);
        if (!result.ok) {
          toast.error(errorMessage(result.error));
          return;
        }
        version.current = result.data.updatedAt;
        const rows = pendingRows(picked, { type: "checklist_item", id: result.data.itemId });
        if (rows.length) {
          const committed = await saveAttachments({ boatId, items: rows });
          if (!committed.ok) {
            toast.error(ta("commitRetry"));
            return;
          }
        }
        setSaved(true);
        toast.success(t("saved"));
        router.push(
          `${checklistPath(boatId)}?view=all&open=${result.data.itemId}` as Parameters<
            typeof router.push
          >[0],
        );
        router.refresh();
      } catch {
        toast.error(ta("saveRetry"));
      } finally {
        submitting.current = false;
      }
    });
  }

  function toggleActive() {
    if (!item) return;
    startTransition(async () => {
      const result = await setChecklistItemActive({
        boatId,
        itemId: item.id,
        isActive: !item.isActive,
      });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(item.isActive ? t("disabled") : t("enabled"));
      setSaved(true);
      router.push(categoryPath(boatId, item.categoryId) as Parameters<typeof router.push>[0]);
      router.refresh();
    });
  }

  // No category yet (opened from the checklist root): « Annuler » goes back to the checklist,
  // not to `/checklist/` with an empty segment.
  const parentId = item?.categoryId ?? defaultCategoryId;
  const backHref = parentId ? categoryPath(boatId, parentId) : checklistPath(boatId);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <PageHeader title={item ? t("edit") : t("new")} />
      <AttachmentFormSection
        boatId={boatId}
        owner={{ type: "checklist_item", id: item?.id ?? newId }}
        initial={attachments}
        deferred={!item}
        disabled={pending}
        onItemsChange={setPicked}
      />
      <Field
        id="item-label"
        label={t("label")}
        required
        error={errors.label}
        warning={duplicate ? t("duplicate") : undefined}
      >
        <Input
          id="item-label"
          value={label}
          onChange={(event) => touch(setLabel)(event.target.value)}
          autoComplete="off"
          aria-invalid={errors.label ? true : undefined}
        />
      </Field>
      <div className="grid gap-2">
        <Label>
          {t("category")}
          <span aria-hidden className="text-ink-3">
            {" "}
            *
          </span>
        </Label>
        <CategoryChipsMulti
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"
          categories={categories}
          values={categoryIds}
          onValuesChange={touch(setCategoryIds)}
          max={CHECKLIST_CATEGORIES_MAX}
          label={t("category")}
        />
        <p className="text-caption text-ink-3">{t("categoryMultiHelp")}</p>
        {errors.categoryIds ? (
          <p role="alert" className="text-caption text-state-overdue-fg">
            {errors.categoryIds}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Label>{t("interval")}</Label>
        <ToggleGroup
          type="single"
          value={preset}
          onValueChange={(next) => next && touch(setPreset)(next as Preset)}
          className="w-full flex-wrap justify-start"
        >
          {INTERVAL_MONTH_PRESETS.map((months) => (
            <ToggleGroupItem key={months} value={String(months)} className="min-h-11">
              {months} {t("monthsSuffix")}
            </ToggleGroupItem>
          ))}
          <ToggleGroupItem value="other" className="min-h-11">
            {t("other")}
          </ToggleGroupItem>
          <ToggleGroupItem value="none" className="min-h-11">
            {t("none")}
          </ToggleGroupItem>
        </ToggleGroup>
        {preset === "other" ? (
          <NumericField
            mode="numeric"
            value={otherMonths}
            onValueChange={(raw) => touch(setOtherMonths)(raw)}
            suffix={t("monthsSuffix")}
            aria-label={t("interval")}
            aria-invalid={errors.intervalMonths ? true : undefined}
            containerClassName="max-w-48"
          />
        ) : null}
        {preset === "none" ? <p className="text-caption text-ink-3">{t("noneHelp")}</p> : null}
        {errors.intervalMonths ? (
          <p className="text-caption text-state-overdue-fg">{errors.intervalMonths}</p>
        ) : null}
      </div>
      <div className="grid items-start gap-5 sm:grid-cols-2">
        <Field
          id="item-hours"
          label={t("hours")}
          warning={meterless && intervalHours.trim() !== "" ? t("hoursNoCounter") : undefined}
          error={errors.intervalHours}
        >
          <NumericField
            id="item-hours"
            mode="numeric"
            value={intervalHours}
            onValueChange={(raw) => touch(setIntervalHours)(raw)}
            suffix={t("hoursSuffix")}
            aria-invalid={errors.intervalHours ? true : undefined}
          />
        </Field>
        <Field id="item-engine" label={t("engine")} help={t("engineHelp")} error={errors.engineId}>
          <NativeSelect
            id="item-engine"
            value={engineId}
            onChange={(event) => touch(setEngineId)(event.target.value)}
            aria-invalid={errors.engineId ? true : undefined}
          >
            <option value="">{t("noEngine")}</option>
            {engines.map((engine) => (
              <option key={engine.id} value={engine.id}>
                {engine.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field id="item-description" label={t("description")} error={errors.description}>
        <Textarea
          id="item-description"
          rows={3}
          value={description}
          onChange={(event) => touch(setDescription)(event.target.value)}
          autoCapitalize="sentences"
        />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-label font-semibold text-ink-2">{t("steps")}</legend>
        {steps.map((step, index) => (
          <div key={index} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right num text-label text-ink-3">{index + 1}.</span>
            <Input
              value={step}
              onChange={(event) => {
                const next = [...steps];
                next[index] = event.target.value;
                touch(setSteps)(next);
              }}
              autoComplete="off"
              aria-label={`${t("steps")} ${index + 1}`}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("moveUp")}
              disabled={index === 0}
              onClick={() => moveStep(index, -1)}
            >
              <ArrowUpIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("moveDown")}
              disabled={index === steps.length - 1}
              onClick={() => moveStep(index, 1)}
            >
              <ArrowDownIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("removeStep")}
              onClick={() => touch(setSteps)(steps.filter((_, i) => i !== index))}
            >
              <XIcon />
            </Button>
          </div>
        ))}
        {errors.actions ? (
          <p role="alert" className="text-caption text-state-overdue-fg">
            {errors.actions}
          </p>
        ) : null}
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={steps.length >= 50}
            onClick={() => touch(setSteps)([...steps, ""])}
          >
            <PlusIcon />
            {t("addStep")}
          </Button>
        </div>
      </fieldset>
      <Field id="item-anchor" label={t("anchor")} help={t("anchorHelp")} error={errors.anchorDate}>
        {/* Rule 13: a date is chips + the native wheel, never a bare field. The anchor is a
            reference that has already happened — the chips look backwards, today is the ceiling. */}
        <DateField
          id="item-anchor"
          value={anchorDate}
          max={todayString()}
          onValueChange={touch(setAnchorDate)}
        />
      </Field>
      {item ? (
        <div className="border-t border-border pt-5">
          <Button type="button" variant="outline" onClick={() => setConfirmActive(true)}>
            {item.isActive ? ti("disable") : ti("enable")}
          </Button>
        </div>
      ) : null}
      <FormActionBar
        pending={pending}
        disabled={attachmentBlocked}
        onCancel={() =>
          guard.leave(() => router.push(backHref as Parameters<typeof router.push>[0]))
        }
      />
      <DiscardDialog open={guard.open} onStay={guard.stay} onDiscard={guard.discard} />
      {item ? (
        <ConfirmDialog
          open={confirmActive}
          onOpenChange={setConfirmActive}
          title={item.isActive ? t("disableTitle", { label: item.label }) : ti("enable")}
          description={
            item.isActive ? t("disableDescription", { count: item.completionsCount }) : undefined
          }
          confirmLabel={item.isActive ? ti("disable") : ti("enable")}
          destructive={item.isActive}
          pending={pending}
          onConfirm={() => {
            setConfirmActive(false);
            toggleActive();
          }}
        />
      ) : null}
    </form>
  );
}
