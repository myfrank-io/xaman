import { GaugeIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ChecklistState } from "@/components/common/ChecklistStateBadge";
import { cn } from "@/lib/utils";

/**
 * Reads a `checklist_item_status` row: « 126 j de retard », « dans 9 j »,
 * « dans 40 h », « compteur inconnu ». The number is always written, never
 * carried by colour alone (ux-flows §6.5).
 * An item whose engine has no reading can never be « late by hours »: only the
 * date deadline counts and the row says « compteur inconnu ».
 */
export function DueLabel({
  status,
  daysRemaining,
  hoursRemaining,
  hasCounter = true,
  compact = false,
  className,
}: {
  status: ChecklistState | null | undefined;
  daysRemaining?: number | null;
  hoursRemaining?: number | null;
  /** false when the linked engine has no hour reading at all. */
  hasCounter?: boolean;
  /** « 126 j » instead of « 126 j de retard » where the badge already says overdue. */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const tu = useTranslations("units");

  const days = daysRemaining ?? null;
  const hours = hasCounter ? (hoursRemaining ?? null) : null;

  if (!hasCounter && days === null) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-caption text-ink-3", className)}>
        <GaugeIcon className="size-4 shrink-0" aria-hidden />
        {t("unknownCounter")}
      </span>
    );
  }

  // The tightest of the two deadlines drives the label.
  const useHours = days === null || (hours !== null && hours * 1.2 < days);
  const value = useHours ? hours : days;
  const unit = useHours ? "h" : "j";
  if (value === null || !Number.isFinite(value)) return null;

  const overdue = status === "overdue" || value < 0;
  // Une échéance du jour se dit « aujourd'hui », jamais « dans 0 j » : c'est la ligne que le
  // point rouge de l'onglet annonce, elle doit se lire comme telle (D88).
  const today = !overdue && Math.round(value) === 0 && unit === "j";
  // Every phrase comes from `units.*` (rule 7): the count is an ICU argument, so the plural and
  // the thousands separator are the locale's business, not this component's.
  const count = Math.abs(Math.round(value));
  const text = overdue
    ? compact
      ? // The badge beside the row already says « en retard »; here the figure stands alone.
        useHours
        ? tu("hours", { count })
        : tu("daysShort", { count })
      : useHours
        ? tu("overdueHours", { count })
        : tu("overdueDays", { count })
    : today
      ? t("today").toLocaleLowerCase("fr-FR")
      : useHours
        ? tu("remainingHours", { count })
        : tu("remainingDays", { count });

  return (
    <span
      className={cn(
        "num text-num-sm font-semibold whitespace-nowrap",
        overdue || today
          ? "text-state-overdue-fg"
          : status === "soon"
            ? "text-state-soon-fg"
            : "text-ink-2",
        className,
      )}
    >
      {text}
    </span>
  );
}
