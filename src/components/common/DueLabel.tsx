import { GaugeIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ChecklistState } from "@/components/common/ChecklistStateBadge";
import { cn } from "@/lib/utils";

const numberFr = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

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
  // point rouge de l'onglet annonce, elle doit se lire comme telle (D81).
  const today = !overdue && Math.round(value) === 0 && unit === "j";
  const amount = numberFr.format(Math.abs(Math.round(value)));
  const text = overdue
    ? compact
      ? `${amount} ${unit}`
      : `${amount} ${unit} de retard`
    : today
      ? t("today").toLocaleLowerCase("fr-FR")
      : `dans ${amount} ${unit}`;

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
