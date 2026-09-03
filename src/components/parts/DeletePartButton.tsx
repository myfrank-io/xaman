"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { undoToast } from "@/components/common/UndoToast";
import { Button } from "@/components/ui/button";
import { trashPart, untrashPart } from "@/lib/actions/parts";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { stockPath } from "@/lib/queries/boat-routes";

/**
 * « Mettre à la corbeille » a part (E5-4, D40 reversing D10): a confirmation that names the
 * line, then an 8 s toast carrying the undo — and `/trash` behind it for 30 days. Lives on the
 * edit page only, never on the list.
 */
export function DeletePartButton({
  boatId,
  partId,
  name,
}: {
  boatId: string;
  partId: string;
  name: string;
}) {
  const t = useTranslations("equipment.stock.delete");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await trashPart({ boatId, partId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setOpen(false);
      undoToast({
        message: t("done"),
        undoLabel: tc("undo"),
        onUndo: () => {
          void untrashPart({ boatId, partId }).then((restored) => {
            if (!restored.ok) {
              toast.error(errorMessage(restored.error));
              return;
            }
            toast.success(t("restored"));
            router.refresh();
          });
        },
      });
      router.push(stockPath(boatId) as Parameters<typeof router.push>[0]);
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="outline">
          <Trash2Icon />
          {t("action")}
        </Button>
      }
      title={t("title", { name })}
      description={t("description")}
      confirmLabel={t("action")}
      pending={pending}
      onConfirm={confirm}
    />
  );
}
