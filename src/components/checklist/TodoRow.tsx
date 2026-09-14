"use client";

import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckIcon } from "lucide-react";

import { dueSentence } from "@/components/checklist/due-sentence";
import { hasCounter, isPunctual, type ChecklistRow } from "@/components/checklist/rows";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Une chose à faire, sur une ligne (E20-1).
 *
 * L'ancienne ligne donnait 112 px à un badge en capitales, une colonne à l'échéance, 88 px à un
 * bouton « Fait », et ce qui restait au titre — c'est-à-dire rien : sur un téléphone on lisait
 * « Enrouleur… », « Bas-étai et… », « Remplacer la… ». Le seul mot qui dit quoi faire était le
 * seul qu'on ne pouvait pas lire.
 *
 * Ici le titre prend toute la largeur, sur deux lignes s'il le faut, et rien ne le concurrence.
 * L'état ne se dit plus en capitales mais par **un trait de couleur** à gauche et par **la phrase**
 * en dessous — « En retard de 79 jours », « À faire aujourd'hui », « Dans trois semaines » —, si
 * bien que la couleur ne porte jamais seule l'information. Et l'action est une case à cocher de
 * 44 px : cocher, c'est cocher, pas ouvrir un formulaire.
 */
const TONE_BAR: Record<string, string> = {
  overdue: "bg-danger",
  today: "bg-danger",
  soon: "bg-warning",
  calm: "bg-border",
};

const OPEN_AREA =
  "block min-h-11 w-full rounded-lg py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

const TONE_TEXT: Record<string, string> = {
  overdue: "text-danger-fg font-medium",
  today: "text-danger-fg font-medium",
  soon: "text-warning-fg",
  calm: "text-ink-3",
};

export function TodoRow({
  row,
  href,
  onOpen,
  open = false,
  onTick,
  busy = false,
  withCategory = true,
}: {
  row: ChecklistRow;
  href?: string;
  /** Le détail se déplie sous la ligne au lieu de vivre sur un autre écran. */
  onOpen?: () => void;
  open?: boolean;
  /** Absent pour un lecteur : la ligne reste lisible, elle ne se coche pas. */
  onTick?: (row: ChecklistRow) => void;
  busy?: boolean;
  withCategory?: boolean;
}) {
  const t = useTranslations("checklist");
  const due = dueSentence({
    status: row.status,
    daysRemaining: row.daysRemaining,
    hoursRemaining: row.hoursRemaining,
    hasCounter: hasCounter(row),
    punctual: isPunctual(row),
    hasCompletion: row.hasCompletion,
  });
  const sentence = t(`due.${due.key}`, due.values ?? {});
  const line = withCategory ? `${sentence} · ${row.categoryName}` : sentence;

  return (
    <div className="relative flex items-stretch gap-3 border-b border-border last:border-b-0">
      <span
        aria-hidden
        className={cn("w-1 shrink-0 rounded-r-sm", TONE_BAR[due.tone] ?? TONE_BAR.calm)}
      />
      <div className="flex min-w-0 flex-1 items-center gap-3 py-1">
        <div className="min-w-0 flex-1">
          {/* Toute la zone du titre ouvre le détail — c'est là que la réalisation se corrige.
              Un lien quand le détail est ailleurs, un bouton quand il se déplie sous la ligne ;
              dans les deux cas c'est le titre qu'on touche, jamais une ligne de plus sous lui. */}
          {href ? (
            <Link href={href as Route} className={OPEN_AREA}>
              <RowText label={row.label} line={line} tone={due.tone} />
            </Link>
          ) : onOpen ? (
            <button type="button" onClick={onOpen} aria-expanded={open} className={OPEN_AREA}>
              <RowText label={row.label} line={line} tone={due.tone} />
            </button>
          ) : (
            <div className="py-2">
              <RowText label={row.label} line={line} tone={due.tone} />
            </div>
          )}
        </div>
        {onTick ? (
          <button
            type="button"
            onClick={() => onTick(row)}
            disabled={busy}
            aria-label={t("tick.label", { label: row.label })}
            className={cn(
              "mr-2 grid size-11 shrink-0 place-items-center rounded-full border-2",
              "border-border text-ink-3 transition-colors",
              "hover:border-foreground/40 hover:bg-accent hover:text-foreground",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              busy && "opacity-60",
            )}
          >
            {busy ? <Spinner className="size-5" /> : <CheckIcon className="size-5" aria-hidden />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RowText({ label, line, tone }: { label: string; line: string; tone: string }) {
  return (
    <>
      {/* Deux lignes au plus : au-delà ce n'est plus un titre, c'est une description — et elle
          a sa place sur la fiche, pas dans une liste qu'on parcourt à la verticale. */}
      <p className="text-ink line-clamp-2 text-body font-medium">{label}</p>
      <p className={cn("mt-0.5 truncate text-caption", TONE_TEXT[tone] ?? TONE_TEXT.calm)}>
        {line}
      </p>
    </>
  );
}
