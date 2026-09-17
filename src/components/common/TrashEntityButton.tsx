"use client";

import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTrashUndo } from "@/components/common/use-trash-undo";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { trashContact } from "@/lib/actions/contacts";
import { trashHaulOut } from "@/lib/actions/haul-outs";
import { trashPart } from "@/lib/actions/parts";
import { trashPurchase } from "@/lib/actions/purchases";
import type { ActionResult } from "@/lib/actions/result";
import { restoreContact, restoreHaulOut, restorePart, restorePurchase } from "@/lib/actions/trash";
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
 * Mettre une de ces quatre choses à la corbeille, d'où qu'on le demande.
 *
 * No confirmation (rule 13): the act is a soft delete carrying an 8 s « Annuler » *and* thirty
 * days in `/trash`. An AlertDialog in front of something that reversible is a speed bump, not a
 * safety net — the undo is. What the dialog used to say that the toast cannot infer, the caller
 * passes as `description`: the name of the part, the reference counts of a provider.
 *
 * `leave` says what to do once the row is gone: a detail screen must go somewhere (its list),
 * a **list row** must stay exactly where it is (D144) — the person is working down a list, and
 * being thrown to the top of another screen for each line is how one loses one's place.
 */
export function useTrashEntity({
  boatId,
  id,
  kind,
  description,
  leave = true,
}: {
  boatId: string;
  id: string;
  kind: TrashEntityKind;
  description?: string;
  leave?: boolean;
}) {
  const entity = KINDS[kind];
  const t = useTranslations(entity.namespace);
  const tc = useTranslations("common");
  const router = useRouter();
  const { trash, pending } = useTrashUndo({
    trash: () => entity.trash(boatId, id),
    restore: () => entity.restore({ boatId, id }),
    done: t("done"),
    restored: t("restored"),
    undoLabel: tc("undo"),
    description,
    onDone: () => {
      if (leave) router.push(entity.listPath(boatId) as Parameters<typeof router.push>[0]);
      router.refresh();
    },
  });

  return { trash, pending, label: t("action") };
}

/** Le même geste en bouton, pour les écrans de détail. */
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
  const { trash, pending, label } = useTrashEntity({ boatId, id, kind, description });

  return (
    <Button type="button" variant="outline" disabled={pending} aria-busy={pending} onClick={trash}>
      {pending ? <Spinner /> : <Trash2Icon />}
      {label}
    </Button>
  );
}
