import { FlameIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { formatCurrency, formatDate } from "@/lib/format";
import { MIN_INTERVALS_FOR_ESTIMATE, type GasFacts as GasFactsValue } from "@/lib/gas";

/**
 * Facts, not a prediction (audit §3.4): how long ago the last bottle was, the average gap,
 * and an estimate only once three intervals exist — below that the average is an anecdote.
 */
export async function GasFacts({
  facts,
  total,
}: {
  facts: GasFactsValue;
  /** Sum of the gas purchases in the current list. */
  total: number;
}) {
  const t = await getTranslations("supplies.gas.facts");

  const lines: string[] = [];
  if (facts.lastAt === null) {
    lines.push(t("never"), t("neverHelp"));
  } else {
    lines.push(
      [
        facts.daysSinceLast === 0 ? t("lastToday") : t("last", { days: facts.daysSinceLast ?? 0 }),
        t("lastDate", { date: formatDate(facts.lastAt) }),
      ].join(" · "),
    );
    lines.push(
      facts.averageDays === null
        ? t("noAverage")
        : t("average", { days: facts.averageDays, count: facts.intervalCount }),
    );
    if (facts.nextEstimatedAt) {
      lines.push(t("next", { date: formatDate(facts.nextEstimatedAt) }));
    } else if (facts.intervalCount < MIN_INTERVALS_FOR_ESTIMATE) {
      lines.push(t("noEstimate"));
    }
    if (total > 0) lines.push(t("total", { amount: formatCurrency(total) }));
  }

  return (
    <section
      aria-label={t("title")}
      className="flex gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-2">
        <FlameIcon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-overline text-ink-2 uppercase">{t("title")}</h2>
        <ul className="mt-1 flex flex-col gap-0.5">
          {lines.map((line) => (
            <li key={line} className="num text-body text-foreground">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
