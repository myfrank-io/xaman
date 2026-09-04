"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  CheckCircle2Icon,
  ClipboardListIcon,
  GaugeIcon,
  PenLineIcon,
  UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { NumericField } from "@/components/ui/numeric-field";
import { Spinner } from "@/components/ui/spinner";
import { finishOnboarding } from "@/lib/actions/onboarding";
import { splitTemplates, type TemplateOption } from "@/lib/boat-onboarding";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { parseDecimal } from "@/lib/numbers";

export type TourEngine = { id: string; label: string };

/**
 * Step 3 of three: « Comment ça marche » (D67).
 *
 * A tour that only talks is a tour nobody remembers, and this app has two settings without which
 * it cannot say anything true: the maintenance plan (a boat without one has zero checklist points
 * — the dashboard then announces « tout est à jour » on an empty carnet) and the engine counters
 * (without a reading, every hour-based deadline is silent, D1). So the two lessons that matter
 * carry their own control, already filled in, and the last tap writes them.
 *
 * The plan is pre-selected on the generic model of the hull — the same mapping `create_boat`
 * already used to copy the systems — so the whole step costs zero taps before « Ouvrir mon
 * carnet ». Nothing here is required: the counters can stay empty, and a plan can still be
 * chosen later from the Checklist screen.
 */
export function TourStep({
  boatId,
  templates,
  suggestedTemplateId,
  hasPlan,
  engines,
  dashboardHref,
}: {
  boatId: string;
  templates: TemplateOption[];
  /** The generic model matching the hull, so the common case is « rien à faire ». */
  suggestedTemplateId: string | null;
  /** A resumed step 3 on a boat that already chose: the plan is shown as done, never re-applied. */
  hasPlan: boolean;
  engines: TourEngine[];
  dashboardHref: string;
}) {
  const t = useTranslations("boats.onboarding.tour");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [templateId, setTemplateId] = useState(suggestedTemplateId ?? "");
  const [hours, setHours] = useState<Record<string, string>>({});

  // Drawn once, when the step opens (rule 11): the second tap of a double tap replays the same
  // ids and the upsert keeps one reading per engine instead of two.
  const [readingIds] = useState(() =>
    Object.fromEntries(engines.map((engine) => [engine.id, crypto.randomUUID()])),
  );

  const { exact, generic } = useMemo(() => splitTemplates(templates), [templates]);
  const chosen = templates.find((option) => option.id === templateId) ?? null;

  function finish() {
    const readings = engines
      .map((engine) => ({
        id: readingIds[engine.id] ?? "",
        engineId: engine.id,
        hours: parseDecimal(hours[engine.id] ?? ""),
      }))
      .filter((reading): reading is { id: string; engineId: string; hours: number } =>
        Number.isFinite(reading.hours as number),
      );

    startTransition(async () => {
      const result = await finishOnboarding({
        boatId,
        templateId: hasPlan ? null : templateId || null,
        readings,
      });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      router.replace(dashboardHref as Route);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Lesson icon={<ClipboardListIcon />} title={t("plan.title")} text={t("plan.text")}>
        {hasPlan ? (
          <p className="flex items-start gap-2 text-body text-ink-2">
            <CheckCircle2Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-state-ok-fg" />
            <span>{t("plan.already")}</span>
          </p>
        ) : templates.length === 0 ? (
          <p className="text-caption text-ink-3">{t("plan.none")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="tour-plan">{t("plan.label")}</Label>
            <NativeSelect
              id="tour-plan"
              value={templateId}
              disabled={pending}
              onChange={(event) => setTemplateId(event.target.value)}
            >
              <option value="">{t("plan.later")}</option>
              {exact.length > 0 ? (
                <optgroup label={t("plan.groupExact")}>
                  {exact.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {generic.length > 0 ? (
                <optgroup label={t("plan.groupGeneric")}>
                  {generic.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </NativeSelect>
            <p className="num text-caption text-ink-3">
              {chosen
                ? t("plan.summary", { categories: chosen.categoryCount, items: chosen.itemCount })
                : t("plan.laterHelp")}
            </p>
          </div>
        )}
      </Lesson>

      {engines.length > 0 ? (
        <Lesson icon={<GaugeIcon />} title={t("hours.title")} text={t("hours.text")}>
          <div className="grid gap-4 sm:grid-cols-2">
            {engines.map((engine) => (
              <Field
                key={engine.id}
                id={`tour-hours-${engine.id}`}
                label={engine.label}
                help={t("hours.optional")}
              >
                <NumericField
                  id={`tour-hours-${engine.id}`}
                  value={hours[engine.id] ?? ""}
                  disabled={pending}
                  placeholder={t("hours.placeholder")}
                  suffix="h"
                  onValueChange={(raw) => setHours((current) => ({ ...current, [engine.id]: raw }))}
                />
              </Field>
            ))}
          </div>
        </Lesson>
      ) : null}

      <Lesson icon={<PenLineIcon />} title={t("log.title")} text={t("log.text")} />
      <Lesson icon={<UsersIcon />} title={t("crew.title")} text={t("crew.text")} />

      <Button
        type="button"
        size="xl"
        className="mt-2"
        onClick={finish}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? <Spinner /> : <CheckCircle2Icon />}
        {t("finish")}
      </Button>
    </div>
  );
}

/** One lesson: an icon, a sentence, and — for the two that matter — the control that applies it. */
function Lesson({
  icon,
  title,
  text,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-n-500 [&_svg]:size-5"
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-h3">{title}</h2>
          <p className="text-body text-ink-2">{text}</p>
        </div>
        {children}
      </div>
    </section>
  );
}
