"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDownIcon, ChevronRightIcon, GaugeIcon } from "lucide-react";
import type { z } from "zod";

import {
  AttachmentPicker,
  pendingRows,
  type PickedAttachment,
} from "@/components/attachments/AttachmentPicker";
import { CategoryChips, type CategoryChoice } from "@/components/common/CategoryChips";
import { PageHeader } from "@/components/common/PageHeader";
import { ContactPicker } from "@/components/contacts/ContactPicker";
import type { ContactOption } from "@/components/contacts/specialties";
import { DiscardDialog } from "@/components/forms/DiscardDialog";
import { Field } from "@/components/forms/Field";
import { FormActionBar } from "@/components/forms/FormActionBar";
import { formResolver } from "@/components/forms/form-resolver";
import { numberToInput, textToInput } from "@/components/forms/form-values";
import { useDraft } from "@/components/forms/use-draft";
import { useFieldError } from "@/components/forms/use-field-error";
import { submitOrQueue } from "@/components/forms/submit-or-queue";
import { useUnsavedGuard } from "@/components/forms/use-unsaved-guard";
import { ChecklistMatches } from "@/components/logs/ChecklistMatches";
import { useOutbox } from "@/components/offline/use-outbox";
import { useOnline } from "@/components/common/use-online";
import { EngineHoursSection } from "@/components/logs/EngineHoursSection";
import { TitleSuggestions } from "@/components/logs/TitleSuggestions";
import { useTitleSuggestions } from "@/components/logs/use-title-suggestions";
import type {
  LogFormChoice,
  LogFormEngine,
  LogFormPrefill,
  LogFormValues,
} from "@/components/logs/log-form-values";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { NumericField } from "@/components/ui/numeric-field";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { saveAttachments } from "@/lib/actions/attachments";
import { saveLog, suggestChecklistItems, type ItemSuggestion } from "@/lib/actions/logs";
import { formatHours, todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import type { AttachmentItem } from "@/lib/queries/attachments";
import { logPath, logsPath } from "@/lib/queries/boat-routes";
import { saveLogSchema, SEGMENT_STATUSES, type LogStatusValue } from "@/lib/schemas/logs";

type Segment = (typeof SEGMENT_STATUSES)[number];

type LogFormState = {
  id: string;
  boatId: string;
  expectedUpdatedAt?: string;
  title: string;
  categoryId: string;
  status: LogStatusValue;
  performedAt: string;
  cost: string;
  contactId: string | null;
  equipmentId: string | null;
  haulOutId: string | null;
  notes: string;
  engineHours: { engineId: string; hours: string }[];
  checklistItemIds: string[];
};
type LogOutput = z.output<typeof saveLogSchema>;

const MATCH_DEBOUNCE_MS = 300;
const MIN_MATCH_CHARS = 3;

/**
 * « + J'ai fait… » (E3-3, D3, D7, D26). One screen for the whole story of an intervention:
 * title with suggestions, category, status, date, engine hours, cost, who did it, notes and the
 * checklist points it acknowledges — saved by a single Server Action.
 */
export function LogForm({
  boatId,
  log,
  prefill,
  categories,
  engines,
  engineCategoryIds,
  contacts,
  equipment,
  haulOuts,
  attachments = [],
  canCreateContact,
}: {
  boatId: string;
  log: LogFormValues | null;
  prefill?: LogFormPrefill;
  categories: CategoryChoice[];
  engines: LogFormEngine[];
  /** Categories that carry the engines: the hours block opens by itself for them. */
  engineCategoryIds: string[];
  contacts: ContactOption[];
  equipment: LogFormChoice[];
  haulOuts: LogFormChoice[];
  /** Documents already stored on this intervention (E10-1); empty on a creation. */
  attachments?: AttachmentItem[];
  canCreateContact: boolean;
}) {
  const t = useTranslations("logs.form");
  const ta = useTranslations("attachments");
  const tc = useTranslations("common");
  const ts = useTranslations("logStatus");
  const errorMessage = useErrorMessage();
  const to = useTranslations("offline");
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const outbox = useOutbox(boatId);
  const { online } = useOnline();
  const [newId] = useState(() => crypto.randomUUID());

  const initialHours = engines.map((engine) => ({
    engineId: engine.id,
    hours:
      numberToInput(log?.engineHours.find((row) => row.engineId === engine.id)?.hours ?? null) ||
      (prefill?.hours?.find((row) => row.engineId === engine.id)?.hours ?? ""),
  }));

  const defaultValues: LogFormState = {
    id: log?.id ?? newId,
    boatId,
    expectedUpdatedAt: log?.updatedAt,
    title: log?.title ?? prefill?.title ?? "",
    categoryId: log?.categoryId ?? prefill?.categoryId ?? "",
    status: log?.status ?? "done",
    performedAt: log?.performedAt ?? prefill?.performedAt ?? todayString(),
    cost: numberToInput(log?.cost ?? null),
    contactId: log?.contactId ?? prefill?.contactId ?? null,
    equipmentId: log?.equipmentId ?? prefill?.equipmentId ?? null,
    haulOutId: log?.haulOutId ?? null,
    notes: textToInput(log?.notes),
    engineHours: initialHours,
    checklistItemIds: log?.checklistItemIds ?? prefill?.checklistItemIds ?? [],
  };

  const form = useForm<LogFormState, unknown, LogOutput>({
    resolver: formResolver<LogFormState, LogOutput>(saveLogSchema),
    defaultValues,
  });
  const errors = form.formState.errors;
  const guard = useUnsavedGuard(form.formState.isDirty && !form.formState.isSubmitSuccessful);
  const draft = useDraft<LogFormState>(log ? `edit-${log.id}` : `new-${boatId}`, !log);

  // useWatch, not form.watch(): the React compiler cannot memoize the function returned by
  // useForm(), and this form re-renders on every keystroke.
  const control = form.control;
  const title = useWatch({ control, name: "title" });
  const categoryId = useWatch({ control, name: "categoryId" });
  const status = useWatch({ control, name: "status" });
  const performedAt = useWatch({ control, name: "performedAt" });
  const hourValues = useWatch({ control, name: "engineHours" });
  const checkedItems = useWatch({ control, name: "checklistItemIds" });

  const [segment, setSegment] = useState<Segment>(
    log?.status && log.status !== "urgent" ? log.status : "done",
  );
  const urgent = status === "urgent";
  const [titleFocused, setTitleFocused] = useState(false);
  const [hoursOpen, setHoursOpen] = useState(
    Boolean(prefill?.expandHours) ||
      initialHours.some((row) => row.hours !== "") ||
      engineCategoryIds.includes(defaultValues.categoryId),
  );
  const [detailsOpen, setDetailsOpen] = useState(
    Boolean(defaultValues.equipmentId || defaultValues.haulOutId),
  );
  const filledHours = hourValues.filter((row) => row.hours.trim() !== "").length;
  const [focusEngineId, setFocusEngineId] = useState<string | null>(null);
  const titleMatches = useTitleSuggestions(boatId, titleFocused ? title : "");
  // Suggestions are kept with the question they answer, so a stale list is never displayed and
  // nothing has to be cleared from inside an effect.
  const [suggested, setSuggested] = useState<{ key: string; items: ItemSuggestion[] }>({
    key: "",
    items: [],
  });
  const [serverError, setServerError] = useState<string | null>(null);
  // Documents (E10-1). On a creation their objects go up while the form is being typed — the id
  // of the intervention is drawn at open — and their rows are written once it exists.
  const [picked, setPicked] = useState<PickedAttachment[]>([]);
  // Same id the form will save under: the objects can go up before the row exists.
  const attachmentOwnerId = log?.id ?? newId;
  // Points the user ticked or unticked by hand are never re-decided by the suggestions.
  const decided = useRef<Set<string>>(new Set(defaultValues.checklistItemIds));

  // Session draft (creations only, D25): every change is kept, nothing is restored behind
  // the user's back — the banner asks first.
  const watched = useWatch({ control });
  const saveDraft = draft.save;
  useEffect(() => {
    if (log) return;
    saveDraft(watched as LogFormState);
  }, [watched, saveDraft, log]);

  // Checklist points named by this title, in this category (E3-3b).
  useEffect(() => {
    const trimmed = title.trim();
    if (!categoryId || trimmed.length < MIN_MATCH_CHARS) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      suggestChecklistItems({ boatId, categoryId, title: trimmed })
        .then((result) => {
          if (cancelled || !result.ok) return;
          setSuggested({ key: `${categoryId}|${trimmed}`, items: result.data });
          // Pre-tick a fresh entry (D3); an edited one keeps the points it already carries.
          if (log) return;
          const current = form.getValues("checklistItemIds");
          const added = result.data
            .filter((item) => item.score > 0.5 && !decided.current.has(item.id))
            .map((item) => item.id);
          if (added.length > 0) {
            form.setValue("checklistItemIds", [...new Set([...current, ...added])]);
            if (result.data.some((item) => item.intervalHours !== null)) setHoursOpen(true);
          }
        })
        // A failed lookup must never break the saisie: no suggestion, nothing else changes.
        .catch(() => undefined);
    }, MATCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [boatId, categoryId, title, form, log]);

  const hoursByEngine: Record<string, string> = {};
  for (const row of hourValues) hoursByEngine[row.engineId] = row.hours;

  const matches =
    suggested.key === `${categoryId}|${title.trim()}` && title.trim().length >= MIN_MATCH_CHARS
      ? suggested.items
      : [];
  const futureDate = performedAt > todayString();
  const backHref = log ? logPath(boatId, log.id) : logsPath(boatId);

  function setStatus(next: LogStatusValue) {
    form.setValue("status", next, { shouldDirty: true });
  }

  function onSubmit(values: LogOutput) {
    setServerError(null);
    startTransition(async () => {
      // A new intervention typed at sea is kept on the iPad rather than lost (E9-1b, D25);
      // an edit is sent or it fails, because replaying it later could overwrite a colleague.
      const outcome = await submitOrQueue({
        kind: "log",
        boatId,
        id: values.id,
        label: values.title,
        values,
        action: saveLog,
        enqueue: outbox.enqueue,
        online: online || Boolean(log),
      });
      if (outcome.status === "full") {
        setServerError(to("queueFull"));
        return;
      }
      if (outcome.status === "queued") {
        draft.clear();
        toast.success(to("savedOnDevice"));
        router.push(logsPath(boatId) as Parameters<typeof router.push>[0]);
        return;
      }
      if (outcome.status === "refused") {
        setServerError(errorMessage(outcome.error));
        return;
      }
      const result = { ok: true as const, data: outcome.data };
      // The intervention now exists: the documents uploaded while it was typed get their rows.
      const rows = log
        ? []
        : pendingRows(picked, { type: "maintenance_log", id: result.data.logId });
      if (rows.length > 0) {
        const committed = await saveAttachments({ boatId, items: rows });
        if (!committed.ok) toast.error(ta("commitFailed"));
      }
      draft.clear();
      const reading = result.data.readings[0];
      const engine = reading ? engines.find((row) => row.id === reading.engineId) : undefined;
      toast.success(
        reading && engine
          ? t("savedWithReading", { engine: engine.label, hours: formatHours(reading.hours) })
          : t("saved"),
        {
          action: {
            label: t("view"),
            onClick: () =>
              router.push(logPath(boatId, result.data.logId) as Parameters<typeof router.push>[0]),
          },
        },
      );
      router.push(
        (log ? logPath(boatId, result.data.logId) : logsPath(boatId)) as Parameters<
          typeof router.push
        >[0],
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <PageHeader title={log ? t("editTitle") : t("newTitle")} />

      {draft.draft && !log ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("draft.banner")}</span>
            <span className="flex gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const found = draft.draft;
                  if (found) form.reset({ ...found, id: form.getValues("id") });
                  draft.dismiss();
                }}
              >
                {t("draft.resume")}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => draft.clear()}>
                {t("draft.discard")}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}

      {serverError ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{serverError}</span>
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {tc("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Field id="log-title" label={t("title")} required error={fieldError(errors.title)}>
          <Input
            id="log-title"
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="next"
            placeholder={t("titlePlaceholder")}
            autoFocus={!log}
            aria-invalid={errors.title ? true : undefined}
            {...form.register("title")}
            onFocus={() => setTitleFocused(true)}
            onBlur={() => setTitleFocused(false)}
          />
        </Field>
        {titleFocused ? (
          <TitleSuggestions
            items={titleMatches}
            categories={categories}
            engines={engines}
            onPick={(suggestion) => {
              form.setValue("title", suggestion.title, { shouldDirty: true });
              if (suggestion.categoryId) {
                form.setValue("categoryId", suggestion.categoryId, { shouldDirty: true });
                if (engineCategoryIds.includes(suggestion.categoryId)) setHoursOpen(true);
              }
              if (suggestion.engineId) {
                setHoursOpen(true);
                setFocusEngineId(suggestion.engineId);
              }
              setTitleFocused(false);
            }}
          />
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label>
          {t("category")}
          <span aria-hidden className="text-ink-3">
            {" *"}
          </span>
        </Label>
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <CategoryChips
              categories={categories}
              value={field.value}
              onValueChange={(id) => {
                field.onChange(id);
                if (engineCategoryIds.includes(id)) setHoursOpen(true);
              }}
              label={t("category")}
            />
          )}
        />
        {errors.categoryId ? (
          <p role="alert" className="text-caption font-medium text-state-overdue-fg">
            {fieldError(errors.categoryId)}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>{t("status")}</Label>
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup
              type="single"
              value={urgent ? "" : segment}
              aria-label={t("status")}
              onValueChange={(next) => {
                if (!next) return;
                setSegment(next as Segment);
                setStatus(next as Segment);
              }}
            >
              {SEGMENT_STATUSES.map((value) => (
                <ToggleGroupItem key={value} value={value} className="min-h-11">
                  {ts(value)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button
              type="button"
              variant={urgent ? "destructive" : "outline"}
              aria-pressed={urgent}
              onClick={() => setStatus(urgent ? segment : "urgent")}
            >
              {ts("urgent")}
            </Button>
          </div>
        </div>
        <Field
          id="log-date"
          label={t("date")}
          required
          error={fieldError(errors.performedAt)}
          warning={futureDate && !errors.performedAt ? t("dateFuture") : undefined}
        >
          <Controller
            control={form.control}
            name="performedAt"
            render={({ field }) => (
              <DateField id="log-date" value={field.value} onValueChange={field.onChange} />
            )}
          />
        </Field>
      </div>

      {/* One control opens AND closes the readings: the button that revealed them is where the
          hand goes back to. Collapsed with values already typed, it says how many, because a
          reading that will be saved must never be invisible (rule 13). */}
      {engines.length > 0 ? (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            className="self-start"
            aria-expanded={hoursOpen}
            aria-controls="log-engine-hours"
            onClick={() => setHoursOpen((open) => !open)}
          >
            {hoursOpen ? <ChevronDownIcon /> : <GaugeIcon />}
            {t("hoursOpen")}
            {!hoursOpen && filledHours > 0 ? (
              <span className="text-caption font-normal text-ink-2">
                {t("hoursKept", { count: filledHours })}
              </span>
            ) : null}
          </Button>
          {hoursOpen ? (
            <div id="log-engine-hours">
              <EngineHoursSection
                engines={engines}
                values={hourValues.map((row) => row.hours)}
                focusEngineId={focusEngineId}
                onValueChange={(index, raw) =>
                  form.setValue(`engineHours.${index}.hours`, raw, { shouldDirty: true })
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="log-cost" label={t("cost")} error={fieldError(errors.cost)}>
          <NumericField
            id="log-cost"
            suffix="€"
            enterKeyHint="next"
            aria-invalid={errors.cost ? true : undefined}
            {...form.register("cost")}
          />
        </Field>
        <div className="grid gap-2">
          <Label htmlFor="log-contact">{t("by")}</Label>
          <Controller
            control={form.control}
            name="contactId"
            render={({ field }) => (
              <ContactPicker
                id="log-contact"
                boatId={boatId}
                contacts={contacts}
                value={field.value}
                onValueChange={field.onChange}
                canCreate={canCreateContact}
                label={t("by")}
              />
            )}
          />
        </div>
      </div>

      <Field id="log-notes" label={t("notes")} error={fieldError(errors.notes)}>
        <Textarea id="log-notes" rows={3} autoCapitalize="sentences" {...form.register("notes")} />
      </Field>

      {equipment.length > 0 || haulOuts.length > 0 ? (
        <div className="flex flex-col gap-4">
          <Button
            type="button"
            variant="ghost"
            className="self-start px-2"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((open) => !open)}
          >
            {detailsOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
            {t("more")}
          </Button>
          {detailsOpen ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {equipment.length > 0 ? (
                <Field id="log-equipment" label={t("equipment")}>
                  <Controller
                    control={form.control}
                    name="equipmentId"
                    render={({ field }) => (
                      <NativeSelect
                        id="log-equipment"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value || null)}
                      >
                        <option value="">{t("noEquipment")}</option>
                        {equipment.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.label}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  />
                </Field>
              ) : null}
              {haulOuts.length > 0 ? (
                <Field id="log-haul-out" label={t("haulOut")}>
                  <Controller
                    control={form.control}
                    name="haulOutId"
                    render={({ field }) => (
                      <NativeSelect
                        id="log-haul-out"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value || null)}
                      >
                        <option value="">{t("noHaulOut")}</option>
                        {haulOuts.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.label}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        <Label>{t("attachments")}</Label>
        <AttachmentPicker
          boatId={boatId}
          owner={{ type: "maintenance_log", id: attachmentOwnerId }}
          initial={attachments}
          deferred={!log}
          onItemsChange={setPicked}
        />
      </div>

      {status === "done" ? (
        <ChecklistMatches
          items={matches}
          checked={checkedItems}
          hoursByEngine={hoursByEngine}
          onToggle={(itemId, next) => {
            decided.current.add(itemId);
            const current = form.getValues("checklistItemIds");
            form.setValue(
              "checklistItemIds",
              next ? [...new Set([...current, itemId])] : current.filter((id) => id !== itemId),
              { shouldDirty: true },
            );
          }}
        />
      ) : null}

      <FormActionBar
        pending={pending}
        queueable={!log}
        onCancel={() =>
          guard.leave(() => {
            draft.clear();
            router.push(backHref as Parameters<typeof router.push>[0]);
          })
        }
      />
      <DiscardDialog open={guard.open} onStay={guard.stay} onDiscard={guard.discard} />
    </form>
  );
}
