import { CalendarClockIcon, CircleCheckIcon, TimerIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

export type LogStatus = Database["public"]["Enums"]["log_status"];

// « Le plein est réservé à l'action requise » (art-direction §3.6 rule 2):
// Urgent and En cours are solid, Planifié and Terminé are tinted.
// A solid badge is filled with the `-fg` token, the only one that keeps white
// text above 5:1 (`--status-in-progress` alone gives 3.19:1).
// Full class strings so Tailwind can see them (no dynamic class construction).
const statusClasses: Record<LogStatus, string> = {
  planned: "border-status-planned-border bg-status-planned-tint text-status-planned-fg",
  in_progress: "border-transparent bg-status-in-progress-fg text-white dark:text-navy",
  done: "border-status-done-border bg-status-done-tint text-status-done-fg",
  urgent: "border-transparent bg-status-urgent-fg text-white dark:text-navy",
};

const statusDotClasses: Record<LogStatus, string> = {
  planned: "bg-status-planned",
  in_progress: "bg-status-in-progress",
  done: "bg-status-done",
  urgent: "bg-status-urgent",
};

const statusIcons = {
  planned: CalendarClockIcon,
  in_progress: TimerIcon,
  done: CircleCheckIcon,
  urgent: TriangleAlertIcon,
} as const;

export { statusDotClasses };

export function StatusBadge({
  status,
  size = "md",
  className,
}: {
  status: LogStatus;
  size?: "sm" | "md" | "default";
  className?: string;
}) {
  const t = useTranslations("logStatus");
  const Icon = statusIcons[status];

  return (
    <Badge variant="outline" size={size} className={cn(statusClasses[status], className)}>
      <Icon aria-hidden />
      {t(status)}
    </Badge>
  );
}

export function StatusDot({ status, className }: { status: LogStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        statusDotClasses[status],
        className,
      )}
      aria-hidden
    />
  );
}
