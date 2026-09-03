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
  restoreTrashedEquipment,
} from "@/lib/actions/trash";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

export type TrashKind =
  "log" | "purchase" | "haulOut" | "part" | "contact" | "attachment" | "equipment";

const ACTIONS = {
  log: restoreLog,
  purchase: restorePurchase,
  haulOut: restoreHaulOut,
  part: restorePart,
  contact: restoreContact,
  attachment: restoreTrashedAttachment,
  equipment: restoreTrashedEquipment,
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
      {/* The word costs 90 px, and on a 360 px row that is 90 px the title does not get — it was
          left with 110 px and broke « Remplaceme / nt ». The icon carries the meaning on a
          phone, the label comes back from `sm`, and the accessible name is there either way. */}
      <span className="sr-only sm:not-sr-only">{t("restore")}</span>
    </Button>
  );
}
