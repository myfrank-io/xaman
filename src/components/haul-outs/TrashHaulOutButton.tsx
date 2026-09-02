"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { undoToast } from "@/components/common/UndoToast";
import { Button } from "@/components/ui/button";
import { restoreHaulOut, trashHaulOut } from "@/lib/actions/haul-outs";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { boatPath } from "@/lib/queries/boat-routes";

/** « Mettre à la corbeille » of a haul-out (E6-1): soft delete, 8 s undo, 30 days in `/trash`. */
export function TrashHaulOutButton({ boatId, haulOutId }: { boatId: string; haulOutId: string }) {
  const t = useTranslations("haulOuts.trash");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await trashHaulOut({ boatId, haulOutId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setOpen(false);
      undoToast({
        message: t("done"),
        undoLabel: tc("undo"),
        onUndo: () => {
          void restoreHaulOut({ boatId, haulOutId }).then((restored) => {
            if (!restored.ok) {
              toast.error(errorMessage(restored.error));
              return;
            }
            toast.success(t("restored"));
            router.refresh();
          });
        },
      });
      router.push(boatPath(boatId, "haulOuts") as Parameters<typeof router.push>[0]);
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
