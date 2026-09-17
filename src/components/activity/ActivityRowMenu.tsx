"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ACTIVITY_REMOVAL, activityOpenPath } from "@/components/activity/row-actions";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { undoToast } from "@/components/common/UndoToast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteCompletion } from "@/lib/actions/checklist";
import { deleteHourReading } from "@/lib/actions/engines";
import { trashHaulOut } from "@/lib/actions/haul-outs";
import { trashLog } from "@/lib/actions/logs";
import { trashPurchase } from "@/lib/actions/purchases";
import type { ActionResult } from "@/lib/actions/result";
import { restoreHaulOut, restoreLog, restorePurchase } from "@/lib/actions/trash";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import type { ActivityKind, ActivityRow } from "@/lib/queries/activity";

/** Retirer le fait : chaque sorte a son action, toutes prennent le bateau et l'identifiant. */
const REMOVE: Record<ActivityKind, (boatId: string, id: string) => Promise<ActionResult>> = {
  log: (boatId, id) => trashLog({ boatId, logId: id }),
  purchase: (boatId, id) => trashPurchase({ boatId, purchaseId: id }),
  haul_out: (boatId, id) => trashHaulOut({ boatId, haulOutId: id }),
  completion: (boatId, id) => deleteCompletion({ boatId, completionId: id }),
  reading: (boatId, id) => deleteHourReading({ boatId, readingId: id }),
};

/** Le remettre : seules les trois sortes qui passent par la corbeille reviennent. */
const RESTORE: Partial<
  Record<ActivityKind, (input: { boatId: string; id: string }) => Promise<ActionResult>>
> = {
  log: restoreLog,
  purchase: restorePurchase,
  haul_out: restoreHaulOut,
};

/**
 * Ce qu'on fait d'une ligne du fil, depuis la ligne (D144).
 *
 * « Ce qui a bougé » disait ce qui s'était passé et ne laissait rien en faire : pour corriger une
 * saisie il fallait deviner dans quel écran elle vivait, la retrouver dans une autre liste, et
 * ouvrir sa fiche. Quelqu'un qui vient de se tromper de ligne n'a pas à connaître la carte de
 * l'application pour réparer son erreur : il la voit, il la corrige là.
 *
 * Trois gestes au plus, jamais plus : ouvrir l'écran du fait quand il en a un, et le retirer.
 * Ce qui va à la corbeille part sans question, avec « Annuler » pendant huit secondes et trente
 * jours de rattrapage (règle 9) ; ce qui s'efface pour de bon — un cochage, un relevé — demande
 * d'abord confirmation, parce que là il n'y a pas de filet.
 */
export function ActivityRowMenu({
  boatId,
  row,
  canWrite,
}: {
  boatId: string;
  row: ActivityRow;
  canWrite: boolean;
}) {
  const t = useTranslations("dashboard.activity.row");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const openPath = activityOpenPath(boatId, row);
  const reversible = ACTIVITY_REMOVAL[row.kind] === "trash";

  // Rien à proposer : ni écran à ouvrir, ni droit d'écrire. Pas de bouton qui ne fait rien.
  if (!openPath && !canWrite) return null;

  function remove() {
    startTransition(async () => {
      const result = await REMOVE[row.kind](boatId, row.id);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setConfirming(false);
      const restore = RESTORE[row.kind];
      if (restore) {
        undoToast({
          message: t("trashed"),
          description: row.title,
          undoLabel: tc("undo"),
          onUndo: () => {
            void restore({ boatId, id: row.id }).then((undone) => {
              if (!undone.ok) {
                toast.error(errorMessage(undone.error));
                return;
              }
              toast.success(t("restored"));
              router.refresh();
            });
          },
        });
      } else {
        toast.success(t("deleted"), { description: row.title });
      }
      router.refresh();
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("actions", { title: row.title })}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {openPath ? (
            <DropdownMenuItem asChild>
              <Link href={openPath as Route}>{t("open")}</Link>
            </DropdownMenuItem>
          ) : null}
          {canWrite ? (
            <DropdownMenuItem
              variant="destructive"
              disabled={pending}
              onSelect={() => (reversible ? remove() : setConfirming(true))}
            >
              {reversible ? t("trash") : t("delete")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {canWrite && !reversible ? (
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title={t("confirmTitle")}
          description={t("confirmDescription", { title: row.title })}
          confirmLabel={t("delete")}
          pending={pending}
          onConfirm={remove}
        />
      ) : null}
    </>
  );
}
