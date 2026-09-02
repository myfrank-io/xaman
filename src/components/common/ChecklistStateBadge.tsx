import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ChecklistState = "never" | "ok" | "soon" | "overdue";

const stateClasses: Record<ChecklistState, string> = {
  never: "border-state-never/30 bg-state-never/12 text-state-never",
  ok: "border-state-ok/30 bg-state-ok/12 text-state-ok",
  soon: "border-state-soon/30 bg-state-soon/12 text-state-soon",
  overdue: "border-state-overdue/30 bg-state-overdue/12 text-state-overdue",
};

export const stateDotClasses: Record<ChecklistState, string> = {
  never: "bg-state-never",
  ok: "bg-state-ok",
  soon: "bg-state-soon",
  overdue: "bg-state-overdue",
};

export function ChecklistStateBadge({
  state,
  size,
  className,
}: {
  state: ChecklistState;
  size?: "sm" | "default";
  className?: string;
}) {
  const t = useTranslations("checklistState");

  return (
    <Badge variant="outline" size={size} className={cn(stateClasses[state], className)}>
      <span className={cn("size-2 rounded-full", stateDotClasses[state])} aria-hidden />
      {t(state)}
    </Badge>
  );
}
