"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CategoryIcon } from "@/components/common/CategoryBadge";
import { PageHeader } from "@/components/common/PageHeader";
import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NumericField } from "@/components/ui/numeric-field";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { anchorChecklistItems } from "@/lib/actions/checklist";
import { addHourReading } from "@/lib/actions/engines";
import { formatDate, formatHours, todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { checklistPath } from "@/lib/queries/boat-routes";
import { WIZARD_AGES, type WizardAge } from "@/lib/schemas/checklist";

export type WizardEngine = {
  id: string;
  label: string;
  lastHours: number | null;
  lastDate: string | null;
};

export type WizardCategory = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  items: {
    id: string;
    label: string;
    intervalMonths: number | null;
    intervalHours: number | null;
  }[];
};

/**
 * Start-up wizard (E4-9, D2): counters → items to keep → rough age of the last completion.
 * Three screens, under five minutes; the queue is right from day one and nothing is red by mistake.
 */
export function StartupWizard({
  boatId,
  engines,
  categories,
  /**
   * Opens the wizard on a given step. Only `/dev/ui/checklist-setup` passes it: steps 2 and 3
   * are behind a button, so the touch audit only ever saw step 1 — and step 2 is the dense one,
   * eighty points with a toggle each.
   */
  initialStep,
}: {
  boatId: string;
  engines: WizardEngine[];
  categories: WizardCategory[];
  initialStep?: 1 | 2 | 3;
}) {
  const t = useTranslations("checklist.wizard");
  const tu = useTranslations("units");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<1 | 2 | 3>(initialStep ?? (engines.length > 0 ? 1 : 2));
  const [readingIds] = useState(
    () => new Map(engines.map((engine) => [engine.id, crypto.randomUUID()])),
  );
  const [hours, setHours] = useState<Record<string, string>>({});
  const [dropped, setDropped] = useState<Set<string>>(() => new Set());
  const [ages, setAges] = useState<Record<string, WizardAge>>({});

  const allItems = categories.flatMap((category) => category.items);
  const keptCount = allItems.filter((item) => !dropped.has(item.id)).length;

  function toggle(itemId: string, keep: boolean) {
    setDropped((current) => {
      const next = new Set(current);
      if (keep) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleCategory(category: WizardCategory, keep: boolean) {
    setDropped((current) => {
      const next = new Set(current);
      for (const item of category.items) {
        if (keep) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  function saveReadings() {
    startTransition(async () => {
      let saved = 0;
      for (const engine of engines) {
        const value = hours[engine.id]?.trim();
        if (!value) continue;
        const result = await addHourReading({
          id: readingIds.get(engine.id),
          boatId,
          engineId: engine.id,
          hours: value,
          readAt: todayString(),
          note: null,
          counterReplaced: false,
        });
        if (!result.ok) {
          toast.error(`${engine.label} : ${errorMessage(result.error)}`);
          return;
        }
        saved += 1;
      }
      if (saved > 0) toast.success(t("readingsSaved", { count: saved }));
      setStep(2);
    });
  }

  function finish() {
    startTransition(async () => {
      const result = await anchorChecklistItems({
        boatId,
        items: categories.flatMap((category) =>
          category.items.map((item) => ({
            itemId: item.id,
            keep: !dropped.has(item.id),
            age: dropped.has(item.id) ? null : (ages[category.id] ?? "never"),
          })),
        ),
      });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("done"));
      router.push(checklistPath(boatId) as Route);
      router.refresh();
    });
  }

  const stepTitle = step === 1 ? t("step1") : step === 2 ? t("step2") : t("step3");
  const stepHelp = step === 1 ? t("step1Help") : step === 2 ? t("step2Help") : t("step3Help");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("intro")} />
      <div>
        <p className="text-overline text-ink-2 uppercase">{t("stepOf", { step })}</p>
        <h2 className="mt-1 text-h2">{stepTitle}</h2>
        <p className="mt-1 text-body text-ink-2">{stepHelp}</p>
      </div>

      {step === 1 ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {engines.map((engine) => (
            <Field
              key={engine.id}
              id={`wizard-hours-${engine.id}`}
              label={engine.label}
              help={
                engine.lastHours !== null && engine.lastDate
                  ? `${formatHours(engine.lastHours)} · ${formatDate(engine.lastDate)}`
                  : undefined
              }
            >
              <NumericField
                id={`wizard-hours-${engine.id}`}
                value={hours[engine.id] ?? ""}
                onValueChange={(raw) => setHours((current) => ({ ...current, [engine.id]: raw }))}
                suffix="h"
              />
            </Field>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <p className="num text-body font-medium">
            {t("kept", { kept: keptCount, total: allItems.length })}
          </p>
          {categories.map((category) => {
            const kept = category.items.filter((item) => !dropped.has(item.id)).length;
            return (
              <section
                key={category.id}
                className="overflow-hidden rounded-xl border border-border bg-surface"
              >
                <header className="flex min-h-14 items-center gap-3 border-b border-border bg-surface-2 px-4">
                  <CategoryIcon color={category.color} icon={category.icon} />
                  <span className="min-w-0 flex-1 truncate text-h3">{category.name}</span>
                  <span className="num text-caption text-ink-2">
                    {kept} / {category.items.length}
                  </span>
                  <Checkbox
                    aria-label={t("allCategory")}
                    checked={
                      kept === category.items.length ? true : kept === 0 ? false : "indeterminate"
                    }
                    onCheckedChange={(value) => toggleCategory(category, value === true)}
                  />
                </header>
                <ul>
                  {category.items.map((item) => (
                    <li key={item.id}>
                      <label className="flex min-h-12 items-center gap-3 border-b border-border px-4 py-2 text-body last:border-b-0">
                        <Checkbox
                          checked={!dropped.has(item.id)}
                          onCheckedChange={(value) => toggle(item.id, value === true)}
                        />
                        <span
                          className={
                            dropped.has(item.id)
                              ? "min-w-0 flex-1 text-ink-3 line-through"
                              : "min-w-0 flex-1"
                          }
                        >
                          {item.label}
                        </span>
                        <span className="shrink-0 num text-caption text-ink-3">
                          {[
                            item.intervalMonths
                              ? tu("everyMonths", { count: item.intervalMonths })
                              : null,
                            item.intervalHours
                              ? tu("everyHours", { count: item.intervalHours })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-3">
          {categories
            .filter((category) => category.items.some((item) => !dropped.has(item.id)))
            .map((category) => (
              <div
                key={category.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CategoryIcon color={category.color} icon={category.icon} />
                  <span className="truncate text-h3">{category.name}</span>
                </div>
                <ToggleGroup
                  type="single"
                  value={ages[category.id] ?? "never"}
                  onValueChange={(next) =>
                    next && setAges((current) => ({ ...current, [category.id]: next as WizardAge }))
                  }
                  aria-label={category.name}
                  className="w-full sm:w-auto"
                >
                  {WIZARD_AGES.map((age) => (
                    <ToggleGroupItem key={age} value={age} className="min-h-11">
                      {t(`ages.${age}`)}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
            ))}
        </div>
      ) : null}

      <div className="sticky bottom-[var(--bottom-nav-height,0px)] z-20 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
        {step === 1 || (step === 2 && engines.length === 0) ? (
          <Button asChild variant="ghost">
            <Link href={checklistPath(boatId) as Route}>{t("later")}</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(step === 3 ? 2 : 1)}
            disabled={pending}
          >
            {t("back")}
          </Button>
        )}
        {step === 1 ? (
          <Button type="button" onClick={saveReadings} disabled={pending} aria-busy={pending}>
            {pending ? <Spinner /> : null}
            {t("next")}
          </Button>
        ) : step === 2 ? (
          <Button type="button" onClick={() => setStep(3)} disabled={keptCount === 0}>
            {t("next")}
          </Button>
        ) : (
          <Button type="button" onClick={finish} disabled={pending} aria-busy={pending}>
            {pending ? <Spinner /> : null}
            {t("finish")}
          </Button>
        )}
      </div>
    </div>
  );
}
