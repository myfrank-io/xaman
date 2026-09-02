"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { deleteContact } from "@/lib/actions/contacts";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { boatPath } from "@/lib/queries/boat-routes";

// Physical delete with the reference counts in the question (DATA-MODEL §3.11).
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
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteContact({ boatId, contactId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setOpen(false);
      toast.success(t("done"));
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
