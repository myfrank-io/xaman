"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { deletePart } from "@/lib/actions/parts";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { suppliesPath } from "@/lib/queries/boat-routes";

/**
 * Deleting a part (E5-4, D10): the stock is declarative, so no trash — a confirmation that
 * names the line, then the row is gone. Lives on the edit page only, never on the list.
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
  const t = useTranslations("supplies.stock.delete");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deletePart({ boatId, partId });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setOpen(false);
      toast.success(t("done"));
      router.push(suppliesPath(boatId, "stock") as Parameters<typeof router.push>[0]);
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
