import { CircleCheckIcon, CircleIcon, ClockIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ChecklistState = "never" | "ok" | "soon" | "overdue";

// Solid for what demands an action (Bientôt, En retard), tinted for the rest.
// Solid uses the `-fg` token so white text stays above 5:1 (art-direction §7.4).
const stateClasses: Record<ChecklistState, string> = {
  never: "border-state-never-border bg-state-never-tint text-state-never-fg",
  ok: "border-state-ok-border bg-state-ok-tint text-state-ok-fg",
  soon: "border-transparent bg-state-soon-fg text-white dark:text-navy",
  overdue: "border-transparent bg-state-overdue-fg text-white dark:text-navy",
};

export const stateDotClasses: Record<ChecklistState, string> = {
  never: "bg-state-never",
  ok: "bg-state-ok",
  soon: "bg-state-soon",
  overdue: "bg-state-overdue",
};

const stateIcons = {
  never: CircleIcon,
  ok: CircleCheckIcon,
  soon: ClockIcon,
  overdue: TriangleAlertIcon,
} as const;

export function ChecklistStateBadge({
  state,
  size = "md",
  className,
}: {
  state: ChecklistState;
  size?: "sm" | "md" | "default";
  className?: string;
}) {
  const t = useTranslations("checklistState");
  const Icon = stateIcons[state];

  return (
    <Badge variant="outline" size={size} className={cn(stateClasses[state], className)}>
      <Icon aria-hidden />
      {t(state)}
    </Badge>
  );
}

export function ChecklistStateDot({
  state,
  className,
}: {
  state: ChecklistState;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-block size-3 shrink-0 rounded-full", stateDotClasses[state], className)}
      aria-hidden
    />
  );
}
