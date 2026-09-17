"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { nextDueSentence } from "@/components/checklist/next-due";
import type { ChecklistRow } from "@/components/checklist/rows";
import { undoToast } from "@/components/common/UndoToast";
import { useOnline } from "@/components/common/use-online";
import { submitOrQueue } from "@/components/forms/submit-or-queue";
import { useOutbox } from "@/components/offline/use-outbox";
import { completeChecklistItem } from "@/lib/actions/checklist";
import { trashLog } from "@/lib/actions/logs";
import { formatDate, formatHours, todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

export type Ticked = {
  /** The optimistic key of the completion; the database draws the real one from the line. */
  id: string;
  /** The intervention the tick writes — or finishes, when the point was already in hand (D140). */
  logId: string;
  completedAt: string;
  completedByName: string;
  engineHours: number | null;
  nextDueAt: string | null;
};

/**
 * Cocher en un geste (E20-2).
 *
 * Le dialogue posait cinq questions dont il connaissait déjà quatre réponses : la date, c'est
 * aujourd'hui ; la personne, c'est celle qui touche l'écran ; les heures, c'est le compteur du
 * moteur, relevé et affiché deux écrans plus loin ; la note, il n'y en a pas. La cinquième —
 * « valide jusqu'au » — ne concerne qu'une poignée de papiers.
 *
 * Donc on ne demande plus. On écrit ce qu'on sait, on **dit ce qu'on a supposé** dans la
 * confirmation — « Par Xavier, à 1482,5 h · Prochaine : 14/09/2027 » — et « Annuler » reste sous
 * le pouce pendant huit secondes. Deviner en le montrant vaut mieux que demander : la personne
 * qui coche à l'instant, cas de loin le plus fréquent, n'a rien à faire ; celle dont la supposition
 * est fausse le voit tout de suite et corrige depuis la ligne, où la réalisation est écrite.
 *
 * Depuis D140, cocher **écrit une intervention** : c'est elle que le journal montre, et c'est
 * d'elle que la base déduit la réalisation. Un point déjà confié au chantier (D141) porte une
 * intervention prévue : la cocher termine celle-là, au lieu d'en écrire une seconde. Et
 * « Annuler » met l'intervention à la corbeille — la réalisation tombe avec elle.
 *
 * Reste le seul cas où l'on ne sait pas : un point à intervalle d'heures dont le moteur n'a
 * jamais été relevé. La base l'exige (`check_completion_hours`), donc on pose **une** question,
 * celle-là, et rien d'autre : `needsCounter` la remonte à l'écran appelant.
 */
export function useTick(
  boatId: string,
  options: {
    currentUserName: string;
    /** Ce que la ligne devient dans la liste, tout de suite, sans attendre le serveur. */
    onTicked?: (row: ChecklistRow, ticked: Ticked) => void;
    onUndone?: (row: ChecklistRow) => void;
    /** Le point demande un compteur que personne n'a jamais relevé : à l'écran de le demander. */
    onNeedsCounter?: (row: ChecklistRow) => void;
  },
) {
  const t = useTranslations("checklist");
  const tc = useTranslations("checklist.complete");
  const to = useTranslations("offline");
  const router = useRouter();
  const errorMessage = useErrorMessage();
  const outbox = useOutbox(boatId);
  const { online } = useOnline();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const tick = useCallback(
    (row: ChecklistRow, override?: { engineHours?: number | null }) => {
      // Ce que la base exige, et la seule chose que l'app ne peut pas inventer.
      const needsHours = row.intervalHours !== null;
      const engineHours =
        override?.engineHours !== undefined
          ? override.engineHours
          : needsHours
            ? row.currentHours
            : null;
      if (needsHours && engineHours === null) {
        options.onNeedsCounter?.(row);
        return;
      }

      // L'intervention que le geste écrit, tirée ici pour qu'un rejeu n'en écrive qu'une (règle 11).
      const logId = crypto.randomUUID();
      const completionId = crypto.randomUUID();
      const completedAt = todayString();
      const openLog = row.openLog;
      const ticked: Ticked = {
        id: completionId,
        logId: openLog?.id ?? logId,
        completedAt,
        completedByName: openLog?.contactName ?? options.currentUserName,
        engineHours,
        nextDueAt: null,
      };
      // La ligne bouge avant l'aller-retour : le geste doit répondre à la vitesse du doigt.
      options.onTicked?.(row, ticked);
      setBusy(row.id);

      startTransition(async () => {
        const outcome = await submitOrQueue({
          kind: "completion",
          boatId,
          id: logId,
          label: row.label,
          values: {
            logId,
            boatId,
            itemId: row.id,
            completedAt,
            completedBy: null,
            completedByName: null,
            engineHours,
            nextDueAt: null,
            note: null,
            openLogId: openLog?.id ?? null,
          },
          action: completeChecklistItem,
          enqueue: outbox.enqueue,
          online,
          // Cocher est le seul geste qui doit survivre à une liaison morte (E9-1b).
          allowQueue: true,
        });
        setBusy(null);
        if (outcome.status === "full") {
          options.onUndone?.(row);
          toast.error(to("queueFull"));
          return;
        }
        if (outcome.status === "refused") {
          options.onUndone?.(row);
          toast.error(errorMessage(outcome.error));
          return;
        }

        // Ce que le cochage vient de promettre, et ce qu'il a supposé : les deux se lisent.
        const promise = nextDueSentence(
          {
            completedAt,
            engineHours,
            intervalMonths: row.intervalMonths,
            intervalHours: row.intervalHours,
            fixedDueAt: null,
          },
          {
            date: formatDate,
            hours: formatHours,
            both: (values) => tc("nextDueBoth", values),
            sentence: (values) => tc("nextDue", values),
          },
        );
        // Un point confié au chantier est fait par le chantier : c'est son nom que la
        // réalisation portera (D32), et c'est lui que la confirmation nomme.
        const name = openLog?.contactName ?? options.currentUserName;
        const guessed =
          engineHours !== null
            ? t("tick.guessedWithHours", { name, hours: formatHours(engineHours) })
            : t("tick.guessed", { name });
        const description = [guessed, promise].filter(Boolean).join(" · ");
        const savedLogId = outcome.status === "sent" ? outcome.data.logId : logId;

        undoToast({
          message:
            outcome.status === "queued"
              ? to("savedOnDevice")
              : openLog
                ? tc("finishedPlanned", { label: row.label })
                : tc("saved", { label: row.label }),
          description,
          undoLabel: tc("undo"),
          onUndo: () => {
            if (outcome.status === "queued") {
              outbox.discard(logId);
              options.onUndone?.(row);
              toast.success(tc("undone"));
              return;
            }
            // Annuler, c'est mettre l'intervention à la corbeille : la réalisation tombe avec
            // elle, et la corbeille garde trente jours ce qui aurait été un vrai geste (règle 9).
            void trashLog({ boatId, logId: savedLogId }).then((undone) => {
              if (!undone.ok) {
                toast.error(errorMessage(undone.error));
                return;
              }
              options.onUndone?.(row);
              toast.success(openLog ? tc("undoneReopened") : tc("undoneTrashed"));
              router.refresh();
            });
          },
        });
        if (outcome.status !== "queued") router.refresh();
      });
    },
    [boatId, errorMessage, online, options, outbox, router, t, tc, to],
  );

  return { tick, busy, pending };
}
