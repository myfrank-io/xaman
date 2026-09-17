"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { undoToast } from "@/components/common/UndoToast";
import type { ActionResult } from "@/lib/actions/result";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

/**
 * Mettre une ligne à la corbeille, avec « Annuler » (règle 9, ux-flows §5.5).
 *
 * Le geste seul : il ne sait ni de quelle table sort la ligne, ni comment elle s'appelle — les
 * deux actions et les trois phrases lui sont données. C'est ce qui permet au même geste de servir
 * le bouton d'un écran de détail et le menu d'une ligne de liste sans traîner derrière lui les
 * quatre espaces de traduction de toutes les corbeilles de l'application (`src/i18n/slices.ts`).
 */
export function useTrashUndo({
  trash,
  restore,
  done,
  restored,
  undoLabel,
  description,
  onDone,
}: {
  trash: () => Promise<ActionResult>;
  restore: () => Promise<ActionResult>;
  /** Le titre du toast de départ, celui du retour, et le mot du bouton « Annuler ». */
  done: string;
  restored: string;
  undoLabel: string;
  /** La ligne sous le titre : ce que la personne doit reconnaître de ce qui vient de partir. */
  description?: string;
  /** Ce que l'écran fait ensuite : rafraîchir, et parfois s'en aller. */
  onDone: () => void;
}) {
  const errorMessage = useErrorMessage();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await trash();
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      undoToast({
        message: done,
        description,
        undoLabel,
        onUndo: () => {
          void restore().then((undone) => {
            if (!undone.ok) {
              toast.error(errorMessage(undone.error));
              return;
            }
            toast.success(restored);
            onDone();
          });
        },
      });
      onDone();
    });
  }

  return { trash: run, pending };
}
