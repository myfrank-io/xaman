"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTrashUndo } from "@/components/common/use-trash-undo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trashPart } from "@/lib/actions/parts";
import { restorePart } from "@/lib/actions/trash";
import { editPartPath } from "@/lib/queries/boat-routes";

/**
 * Ce qu'on fait d'une pièce, depuis sa ligne (D144).
 *
 * Retirer une pièce du stock demandait d'ouvrir sa fiche pour y trouver le bouton — et il fallait
 * savoir que la ligne s'ouvrait, ce que rien ne disait. Une ligne notée par erreur, un doublon,
 * un essai : ça se répare là où ça se voit. Le geste garde son filet, « Annuler » pendant huit
 * secondes et trente jours de corbeille (règle 9), et la liste ne bouge pas sous le doigt.
 */
export function StockRowMenu({
  boatId,
  partId,
  name,
}: {
  boatId: string;
  partId: string;
  name: string;
}) {
  const t = useTranslations("parts");
  const td = useTranslations("parts.delete");
  const tc = useTranslations("common");
  const router = useRouter();
  const { trash, pending } = useTrashUndo({
    trash: () => trashPart({ boatId, partId }),
    restore: () => restorePart({ boatId, id: partId }),
    done: td("done"),
    restored: td("restored"),
    undoLabel: tc("undo"),
    description: name,
    // La liste reste où elle est : on travaille une liste ligne à ligne.
    onDone: () => router.refresh(),
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("rowActions", { name })}
          disabled={pending}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={editPartPath(boatId, partId) as Route}>{t("edit")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => trash()}>
          {td("action")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
