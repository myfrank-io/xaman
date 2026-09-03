import { CalendarClockIcon, CircleCheckIcon, TimerIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

export type LogStatus = Database["public"]["Enums"]["log_status"];

// One badge language, not two: every status is a tinted chip — soft `-tint` fill, `-fg` text
// and icon (measured ≥ 5:1 on the tint), a `-border` hairline. A wall of solid red reads as a
// dashboard in alarm; the tint keeps the instrument calm while the icon, the border and the
// red figure beside it still carry the urgency. Colour is never alone — the label spells it out.
// Full class strings so Tailwind can see them (no dynamic class construction).
const statusClasses: Record<LogStatus, string> = {
  planned: "border-status-planned-border bg-status-planned-tint text-status-planned-fg",
  in_progress:
    "border-status-in-progress-border bg-status-in-progress-tint text-status-in-progress-fg",
  done: "border-status-done-border bg-status-done-tint text-status-done-fg",
  urgent: "border-status-urgent-border bg-status-urgent-tint text-status-urgent-fg",
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
