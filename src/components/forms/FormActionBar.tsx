"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useOnline } from "@/components/common/use-online";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

// Keyboard height on iPad: the layout viewport does not shrink, the visual one does.
function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      setOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return offset;
}

/**
 * Sticky « Annuler / Enregistrer » bar (ux-flows §4.8): 56 px, opaque, safe-area aware,
 * positioned ABOVE the iPad keyboard through `visualViewport` — without it « Enregistrer »
 * sits under the keyboard, the number one defect of web forms on iPad.
 * The submit button is busy from the first tap (rule 11: wet fingers double-tap).
 */
export function FormActionBar({
  pending = false,
  disabled = false,
  saveLabel,
  cancelLabel,
  onCancel,
  secondaryLabel,
  onSecondary,
  queueable = false,
  className,
}: {
  pending?: boolean;
  disabled?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  /**
   * Second way out of a creation form: « Enregistrer et en saisir une autre ». It submits the
   * same form — the callback only says which of the two buttons was pressed, before the submit
   * event travels — so validation, the busy state and the offline queue behave identically.
   * Never offered on an edit: there is no second row to open behind it.
   */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /**
   * Creation form whose result can wait on the device (E9-1b): offline it still submits and
   * says so, instead of refusing. An edit is never queueable — replaying it later could
   * overwrite someone else's change (D25).
   */
  queueable?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const to = useTranslations("offline");
  const keyboard = useKeyboardOffset();
  const { online } = useOnline();
  return (
    <div
      className={cn(
        "sticky z-20 -mx-4 mt-8 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-2 sm:-mx-6 sm:px-6",
        className,
      )}
      style={{
        bottom: `calc(var(--bottom-nav-height, 0px) + ${keyboard}px)`,
        paddingBottom: keyboard > 0 ? undefined : "max(0.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
        {cancelLabel ?? t("cancel")}
      </Button>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {secondaryLabel && onSecondary ? (
          <Button
            type={online || queueable ? "submit" : "button"}
            variant="outline"
            disabled={pending || disabled}
            aria-disabled={(!online && !queueable) || undefined}
            onClick={online || queueable ? onSecondary : () => toast.error(to("actionUnavailable"))}
          >
            {secondaryLabel}
          </Button>
        ) : null}
        {/* Offline: the form is never emptied. A creation is saved on the device and re-sent
            later (E9-1b); anything else says why the button cannot do its job (§5.4). */}
        <Button
          type={online || queueable ? "submit" : "button"}
          disabled={pending || disabled}
          aria-busy={pending}
          aria-disabled={(!online && !queueable) || undefined}
          variant={online ? "default" : "outline"}
          onClick={online || queueable ? undefined : () => toast.error(to("actionUnavailable"))}
        >
          {pending ? (
            <>
              <Spinner className="size-4" />
              {t("saving")}
            </>
          ) : online ? (
            (saveLabel ?? t("save"))
          ) : queueable ? (
            to("saveOnDevice")
          ) : (
            to("retryLabel")
          )}
        </Button>
      </div>
    </div>
  );
}
