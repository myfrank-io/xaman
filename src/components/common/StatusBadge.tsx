import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

export type LogStatus = Database["public"]["Enums"]["log_status"];

// Full class strings so Tailwind can see them (no dynamic class construction).
const statusClasses: Record<LogStatus, string> = {
  planned: "border-status-planned/30 bg-status-planned/12 text-status-planned",
  in_progress: "border-status-in-progress/30 bg-status-in-progress/12 text-status-in-progress",
  done: "border-status-done/30 bg-status-done/12 text-status-done",
  urgent: "border-status-urgent/30 bg-status-urgent/12 text-status-urgent",
};

const statusDotClasses: Record<LogStatus, string> = {
  planned: "bg-status-planned",
  in_progress: "bg-status-in-progress",
  done: "bg-status-done",
  urgent: "bg-status-urgent",
};

export function StatusBadge({
  status,
  size,
  className,
}: {
  status: LogStatus;
  size?: "sm" | "default";
  className?: string;
}) {
  const t = useTranslations("logStatus");

  return (
    <Badge variant="outline" size={size} className={cn(statusClasses[status], className)}>
      <span className={cn("size-2 rounded-full", statusDotClasses[status])} aria-hidden />
      {t(status)}
    </Badge>
  );
}
