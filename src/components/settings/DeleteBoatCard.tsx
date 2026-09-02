"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { deleteBoat } from "@/lib/actions/boat";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

// Owner only: the boat name must be typed (ux-flows §5.6). The action redirects to /boats.
export function DeleteBoatCard({ boatId, boatName }: { boatId: string; boatName: string }) {
  const t = useTranslations("settings.delete");
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteBoat({ boatId, confirmName: boatName });
      if (result && !result.ok) toast.error(errorMessage(result.error));
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-state-overdue-border bg-state-overdue-tint p-5">
      <p className="text-body text-foreground">{t("description")}</p>
      <div>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          trigger={
            <Button type="button" variant="destructive">
              {t("button")}
            </Button>
          }
          title={t("confirmTitle", { name: boatName })}
          description={t("confirmDescription")}
          confirmLabel={t("button")}
          confirmKeyword={boatName}
          keywordLabel={t("keyword")}
          pending={pending}
          onConfirm={confirm}
        />
      </div>
    </div>
  );
}
