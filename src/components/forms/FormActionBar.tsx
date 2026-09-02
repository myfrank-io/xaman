"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

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
  className,
}: {
  pending?: boolean;
  disabled?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  onCancel: () => void;
  className?: string;
}) {
  const t = useTranslations("common");
  const keyboard = useKeyboardOffset();
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
      <Button type="submit" disabled={pending || disabled} aria-busy={pending}>
        {pending ? (
          <>
            <Spinner className="size-4" />
            {t("saving")}
          </>
        ) : (
          (saveLabel ?? t("save"))
        )}
      </Button>
    </div>
  );
}
