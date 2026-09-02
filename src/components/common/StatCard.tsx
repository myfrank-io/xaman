import * as React from "react";

import { cn } from "@/lib/utils";

type StatCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
  /** `dark` for the gradient dashboard header */
  variant?: "light" | "dark";
  className?: string;
};

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "",
  warning: "text-state-soon",
  danger: "text-state-overdue",
  success: "text-state-ok",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  variant = "light",
  className,
}: StatCardProps) {
  const dark = variant === "dark";

  return (
    <div
      className={cn(
        "flex min-h-24 flex-col justify-between rounded-xl border p-4",
        dark
          ? "border-white/10 bg-white/10 text-white backdrop-blur-sm"
          : "bg-card text-card-foreground shadow-sm",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-sm font-medium",
          dark ? "text-white/70" : "text-muted-foreground",
        )}
      >
        {icon ? <span className="[&_svg]:size-4">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
          !dark && toneClasses[tone],
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className={cn("mt-1 text-xs", dark ? "text-white/60" : "text-muted-foreground")}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
