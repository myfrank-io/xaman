"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { undoToast } from "@/components/common/UndoToast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { trashContact } from "@/lib/actions/contacts";
import { trashHaulOut } from "@/lib/actions/haul-outs";
import { trashPart } from "@/lib/actions/parts";
import { trashPurchase } from "@/lib/actions/purchases";
import type { ActionResult } from "@/lib/actions/result";
import { restoreContact, restoreHaulOut, restorePart, restorePurchase } from "@/lib/actions/trash";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { boatPath, stockPath, suppliesPath } from "@/lib/queries/boat-routes";

export type TrashEntityKind = "haulOut" | "purchase" | "part" | "contact";

type EntityTrash = {
  /** Every namespace below carries the same three keys: `action`, `done`, `restored`. */
  namespace: "haulOuts.trash" | "supplies.purchases.trash" | "parts.delete" | "contacts.delete";
  trash: (boatId: string, id: string) => Promise<ActionResult>;
  restore: (input: { boatId: string; id: string }) => Promise<ActionResult>;
  /** Where the detail screen the button lives on sends the person once its row is gone. */
  listPath: (boatId: string) => string;
};

// The trash actions still name their id after their table (`haulOutId`, `partId`…); the restores
// all take the generic `{boatId, id}` of `actions/trash.ts`.
const KINDS: Record<TrashEntityKind, EntityTrash> = {
  haulOut: {
    namespace: "haulOuts.trash",
    trash: (boatId, id) => trashHaulOut({ boatId, haulOutId: id }),
    restore: restoreHaulOut,
    listPath: (boatId) => boatPath(boatId, "haulOuts"),
  },
  purchase: {
    namespace: "supplies.purchases.trash",
    trash: (boatId, id) => trashPurchase({ boatId, purchaseId: id }),
    restore: restorePurchase,
    listPath: (boatId) => suppliesPath(boatId),
  },
  part: {
    namespace: "parts.delete",
    trash: (boatId, id) => trashPart({ boatId, partId: id }),
    restore: restorePart,
    listPath: (boatId) => stockPath(boatId),
  },
  contact: {
    namespace: "contacts.delete",
    trash: (boatId, id) => trashContact({ boatId, contactId: id }),
    restore: restoreContact,
    listPath: (boatId) => boatPath(boatId, "contacts"),
  },
};

/**
 * « Mettre à la corbeille » of a haul-out, a purchase, a part or a provider — one button for the
 * four, because they only ever differed by the action, the namespace and the redirect.
 *
 * No confirmation (rule 13): the act is a soft delete carrying an 8 s « Annuler » *and* thirty
 * days in `/trash`. An AlertDialog in front of something that reversible is a speed bump, not a
 * safety net — the undo is. What the dialog used to say that the toast cannot infer, the caller
 * passes as `description`: the name of the part, the reference counts of a provider.
 */
export function TrashEntityButton({
  boatId,
  id,
  kind,
  description,
}: {
  boatId: string;
  id: string;
  kind: TrashEntityKind;
  /** One line under the toast title: what the person needs to know about what just left. */
  description?: string;
}) {
  const entity = KINDS[kind];
  const t = useTranslations(entity.namespace);
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function trash() {
    startTransition(async () => {
      const result = await entity.trash(boatId, id);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      undoToast({
        message: t("done"),
        description,
        undoLabel: tc("undo"),
        onUndo: () => {
          void entity.restore({ boatId, id }).then((restored) => {
            if (!restored.ok) {
              toast.error(errorMessage(restored.error));
              return;
            }
            toast.success(t("restored"));
            router.refresh();
          });
        },
      });
      router.push(entity.listPath(boatId) as Parameters<typeof router.push>[0]);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" disabled={pending} aria-busy={pending} onClick={trash}>
      {pending ? <Spinner /> : <Trash2Icon />}
      {t("action")}
    </Button>
  );
}
