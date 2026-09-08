import { AlertCircleIcon } from "lucide-react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Form field anatomy (ux-flows §4.1): label 14 px/600, control, then ONE line under it —
 * error (red + icon), warning (amber, non-blocking) or help. `*` marks required fields;
 * optional ones say nothing.
 *
 * `group` is for a control that is not a single element — a radiogroup of chips. A `<label for>`
 * would then name the *first chip* rather than the group, because a `<button>` is a labelable
 * element and an associated label outranks the button's own text: the chip would announce
 * itself as the question. So the caption becomes a `<span>` carrying `<id>-label`, and the
 * group names itself with `aria-labelledby` pointing at it.
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
  group,
}: {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  help?: React.ReactNode;
  warning?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** The control is a group (radiogroup of chips), not one labelable element. */
  group?: boolean;
}) {
  const caption = (
    <>
      {label}
      {required ? (
        <span aria-hidden className="text-ink-3">
          {" *"}
        </span>
      ) : null}
    </>
  );

  return (
    <div className={cn("grid gap-2", className)}>
      {group ? (
        <Label asChild>
          <span id={`${id}-label`}>{caption}</span>
        </Label>
      ) : (
        <Label htmlFor={id}>{caption}</Label>
      )}
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
