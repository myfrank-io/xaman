import { AlertCircleIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Form field anatomy (ux-flows §4.1): label 14 px/600, control, then ONE line under it —
 * error (red + icon), warning (amber, non-blocking) or help. `*` marks required fields;
 * optional ones say nothing.
 */
export function Field({
  id,
  label,
  required,
  help,
  warning,
  error,
  children,
  className,
}: {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  help?: React.ReactNode;
  warning?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span aria-hidden className="text-ink-3">
            {" *"}
          </span>
        ) : null}
      </Label>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-start gap-1 text-caption font-medium text-state-overdue-fg"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : warning ? (
        <p id={`${id}-help`} className="text-caption font-medium text-state-soon-fg">
          {warning}
        </p>
      ) : help ? (
        <p id={`${id}-help`} className="text-caption text-ink-3">
          {help}
        </p>
      ) : null}
    </div>
  );
}
