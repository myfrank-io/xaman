"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";

import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { TrashKind } from "@/components/trash/RestoreButton";
import { Button } from "@/components/ui/button";
import {
  purgeAttachment,
  purgeContact,
  purgeEquipment,
  purgeHaulOut,
  purgeLog,
  purgePart,
  purgePurchase,
} from "@/lib/actions/trash";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

const ACTIONS = {
  log: purgeLog,
  purchase: purgePurchase,
  haulOut: purgeHaulOut,
  part: purgePart,
  contact: purgeContact,
  attachment: purgeAttachment,
  equipment: purgeEquipment,
} as const;

/**
 * « Supprimer définitivement » (D40): the hard delete the nightly purge would have done on day
 * 30, asked for early. It is the one place in the app where something really goes away, so it
 * names the line and says so — and the icon-only button keeps « Restaurer » the obvious one.
 */
export function PurgeButton({
  boatId,
  id,
  kind,
  label,
}: {
  boatId: string;
  id: string;
  kind: TrashKind;
  label: string;
}) {
  const t = useTranslations("trash.purge");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await ACTIONS[kind]({ boatId, id });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setOpen(false);
      toast.success(t("done"));
      router.refresh();
    });
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button type="button" variant="ghost" size="icon" aria-label={t("action", { label })}>
          <Trash2Icon />
        </Button>
      }
      title={t("title", { label })}
      description={kind === "contact" ? t("descriptionContact") : t("description")}
      confirmLabel={t("confirm")}
      pending={pending}
      onConfirm={confirm}
    />
  );
}
