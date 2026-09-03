"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Undo2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  restoreContact,
  restoreHaulOut,
  restoreLog,
  restorePart,
  restorePurchase,
  restoreTrashedAttachment,
} from "@/lib/actions/trash";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

export type TrashKind = "log" | "purchase" | "haulOut" | "part" | "contact" | "attachment";

const ACTIONS = {
  log: restoreLog,
  purchase: restorePurchase,
  haulOut: restoreHaulOut,
  part: restorePart,
  contact: restoreContact,
  attachment: restoreTrashedAttachment,
} as const;

/** « Restaurer » (E3-5): `deleted_at = null`, and the parked hour readings come back with it. */
export function RestoreButton({
  boatId,
  id,
  kind,
}: {
  boatId: string;
  id: string;
  kind: TrashKind;
}) {
  const t = useTranslations("trash");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await ACTIONS[kind]({ boatId, id });
          if (!result.ok) {
            toast.error(errorMessage(result.error));
            return;
          }
          toast.success(t("restored"));
          router.refresh();
        })
      }
    >
      {pending ? <Spinner /> : <Undo2Icon />}
      {t("restore")}
    </Button>
  );
}
