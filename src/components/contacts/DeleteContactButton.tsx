"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { undoToast } from "@/components/common/UndoToast";
import { Button } from "@/components/ui/button";
import { trashContact, untrashContact } from "@/lib/actions/contacts";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { boatPath } from "@/lib/queries/boat-routes";

/**
 * « Mettre à la corbeille » a provider (D41). The reference counts stay in the question: they
 * are what the person is really deciding about, and until the purge those links are all kept.
 */
export function DeleteContactButton({
  boatId,
  contactId,
  name,
  references,
}: {
  boatId: string;
  contactId: string;
  name: string;
  references: { logs: number; purchases: number; haulOuts: number };
}) {
  const t = useTranslations("contacts.delete");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await trashContact({ boatId, contactId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setOpen(false);
      undoToast({
        message: t("done"),
        undoLabel: tc("undo"),
        onUndo: () => {
          void untrashContact({ boatId, contactId }).then((restored) => {
            if (!restored.ok) {
              toast.error(errorMessage(restored.error));
              return;
            }
            toast.success(t("restored"));
            router.refresh();
          });
        },
      });
      router.push(boatPath(boatId, "contacts") as Parameters<typeof router.push>[0]);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <Trash2Icon />
        {t("action")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("title", { name })}
        description={t("description", references)}
        confirmLabel={t("confirm")}
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
