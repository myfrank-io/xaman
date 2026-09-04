"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardListIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { chooseChecklistTemplate } from "@/lib/actions/checklist";
import { splitTemplates, type TemplateOption } from "@/lib/boat-onboarding";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

/**
 * « Choisir un modèle d'entretien » (D65) — the second of the two questions the onboarding used
 * to ask at once.
 *
 * The boat already has its systems and can already be used; what it has not got is a plan. This
 * is where that is chosen, at the moment it means something, with the counts shown so the choice
 * is informed: « 8 systèmes · 70 points d'entretien ».
 *
 * Shown only while the boat has no plan. Applying a model is additive (`apply_checklist_template`
 * never overwrites a point), so offering it again afterwards would quietly pile a second model on
 * top of the first — « Recaler ma checklist » is the screen for changing one's mind.
 */
export function ChoosePlanBlock({
  boatId,
  templates,
  suggestedTemplateId,
}: {
  boatId: string;
  templates: TemplateOption[];
  /** The generic model matching the hull — pre-selected, so the common case is one tap. */
  suggestedTemplateId: string | null;
}) {
  const t = useTranslations("checklist.plan");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [templateId, setTemplateId] = useState(suggestedTemplateId ?? "");

  const { exact, generic } = useMemo(() => splitTemplates(templates), [templates]);
  const chosen = templates.find((option) => option.id === templateId) ?? null;

  function apply() {
    if (!templateId) return;
    startTransition(async () => {
      const result = await chooseChecklistTemplate({ boatId, templateId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("applied"));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-surface-2 px-6 py-8 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-border bg-surface text-n-400 [&_svg]:size-7">
        <ClipboardListIcon aria-hidden />
      </div>
      <h2 className="font-display text-h1">{t("title")}</h2>
      <p className="mt-2 max-w-md text-body text-ink-2">{t("intro")}</p>

      <div className="mt-5 flex w-full max-w-md flex-col gap-2 text-left">
        <Label htmlFor="checklist-plan">{t("label")}</Label>
        <NativeSelect
          id="checklist-plan"
          value={templateId}
          disabled={pending}
          onChange={(event) => setTemplateId(event.target.value)}
        >
          <option value="">{t("placeholder")}</option>
          {exact.length > 0 ? (
            <optgroup label={t("groupExact")}>
              {exact.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {generic.length > 0 ? (
            <optgroup label={t("groupGeneric")}>
              {generic.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </NativeSelect>
        <p className="text-caption text-ink-3">
          {chosen
            ? t("summary", { categories: chosen.categoryCount, items: chosen.itemCount })
            : t("help")}
        </p>
      </div>

      <Button
        type="button"
        size="lg"
        className="mt-5"
        disabled={!templateId || pending}
        onClick={apply}
      >
        {pending ? <Spinner /> : null}
        {t("submit")}
      </Button>
      <p className="mt-4 max-w-md text-caption text-ink-3">{t("orBlank")}</p>
    </div>
  );
}
