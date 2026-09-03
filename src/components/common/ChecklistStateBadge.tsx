import { CircleCheckIcon, CircleIcon, ClockIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ChecklistState = "never" | "ok" | "soon" | "overdue";

// One badge language for every state: a tinted chip (`-tint` fill, `-fg` text/icon ≥ 5:1,
// `-border` hairline). « En retard » and « Bientôt » no longer shout in solid red across the
// whole list — the icon, the border and the red figure at the row's end carry the urgency,
// and the label names the state so colour is never working alone.
const stateClasses: Record<ChecklistState, string> = {
  never: "border-state-never-border bg-state-never-tint text-state-never-fg",
  ok: "border-state-ok-border bg-state-ok-tint text-state-ok-fg",
  soon: "border-state-soon-border bg-state-soon-tint text-state-soon-fg",
  overdue: "border-state-overdue-border bg-state-overdue-tint text-state-overdue-fg",
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
