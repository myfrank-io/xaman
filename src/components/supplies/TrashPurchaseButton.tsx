"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { undoToast } from "@/components/common/UndoToast";
import { Button } from "@/components/ui/button";
import { restorePurchase, trashPurchase } from "@/lib/actions/purchases";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { suppliesPath } from "@/lib/queries/boat-routes";

/**
 * « Mettre à la corbeille » (ux-flows §5.6): an AlertDialog to confirm, then an 8 s toast
 * carrying the undo. The toast is not the safety net — `/trash` is — but it is what makes
 * a mis-tap harmless.
 */
export function TrashPurchaseButton({
  boatId,
  purchaseId,
}: {
  boatId: string;
  purchaseId: string;
}) {
  const t = useTranslations("supplies.purchases.trash");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await trashPurchase({ boatId, purchaseId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setOpen(false);
      undoToast({
        message: t("done"),
        undoLabel: tc("undo"),
        onUndo: () => {
          void restorePurchase({ boatId, purchaseId }).then((restored) => {
            if (!restored.ok) {
              toast.error(errorMessage(restored.error));
              return;
            }
            toast.success(t("restored"));
            router.refresh();
          });
        },
      });
      router.push(suppliesPath(boatId) as Parameters<typeof router.push>[0]);
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
      title={t("title")}
      description={t("description")}
      confirmLabel={t("action")}
      pending={pending}
      onConfirm={confirm}
    />
  );
}
