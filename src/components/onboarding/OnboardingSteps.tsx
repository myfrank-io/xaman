"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/boat-onboarding";
import { cn } from "@/lib/utils";

/** The three steps, in order, with the message key naming each one. */
const LABELS = { 1: "steps.boat", 2: "steps.logbook", 3: "steps.tour" } as const;

/**
 * « Où j'en suis » — the header of the three onboarding screens (D67).
 *
 * Three states, and each is carried by two signals rather than colour alone (rule 12): a done
 * step is a tick on the green fill, the current one is filled and bold, the ones ahead are grey
 * and light. The « Étape 2 sur 3 » line above is not decoration either — it is what a screen
 * reader announces first, and what survives on a 320 px screen where the three labels wrap.
 *
 * Deliberately not links. Step 1 has already written the boat, so « revenir » there would draw a
 * new id and open a second carnet; the flow only ever moves forward, and everything it writes is
 * editable afterwards from the app.
 */
export function OnboardingSteps({ step }: { step: OnboardingStep }) {
  const t = useTranslations("boats.onboarding");

  return (
    <nav aria-label={t("progress")} className="flex flex-col gap-2">
      <p className="text-overline text-ink-2 uppercase">
        {t("stepOf", { step, total: ONBOARDING_STEPS.length })}
      </p>
      <ol className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {ONBOARDING_STEPS.map((current) => {
          const done = current < step;
          return (
            <li
              key={current}
              aria-current={current === step ? "step" : undefined}
              className="flex items-center gap-2"
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-label font-semibold",
                  done
                    ? "bg-state-ok-fg text-white"
                    : current === step
                      ? "bg-primary text-primary-foreground"
                      : "bg-n-100 text-ink-2",
                )}
              >
                {done ? <CheckIcon className="size-4" aria-hidden /> : current}
              </span>
              <span
                className={cn(
                  "text-label",
                  current === step ? "font-semibold text-foreground" : "text-ink-2",
                )}
              >
                {t(LABELS[current])}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
