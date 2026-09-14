import Link from "next/link";
import type { Route } from "next";
import { ListChecksIcon, NotebookPenIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { newChecklistItemPath, newLogPath } from "@/lib/queries/boat-routes";

/**
 * Les deux actes de l'écran d'arrivée, séparés par le temps du verbe (E18-13, D124).
 *
 * Il n'y en avait qu'un — « Noter une intervention », c'est-à-dire ce qui est **déjà fait**.
 * Se souvenir de « changer l'anode au printemps » obligeait à ouvrir la Checklist et à y trouver
 * « Ajouter un point » : le carnet ne prenait pas les notes qu'on prend le plus souvent à bord.
 *
 * Deux portes donc, dans l'ordre où on y pense : ce qu'il **faudra** faire, puis ce qui **vient
 * d'être** fait. Pas deux boutons primaires — deux cartes, qui nomment chacune leur objet et
 * disent où elles mènent.
 */
export async function WriteActions({ boatId }: { boatId: string }) {
  const t = await getTranslations("dashboard.write");

  const acts = [
    {
      key: "todo" as const,
      href: newChecklistItemPath(boatId),
      Icon: ListChecksIcon,
      title: t("todoTitle"),
      hint: t("todoHint"),
    },
    {
      key: "done" as const,
      href: newLogPath(boatId),
      Icon: NotebookPenIcon,
      title: t("doneTitle"),
      hint: t("doneHint"),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {acts.map(({ key, href, Icon, title, hint }) => (
        <Link
          key={key}
          href={href as Route}
          className="flex min-h-20 items-center gap-3 rounded-xl border border-border-strong tap-feedback bg-surface p-4 shadow-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-body font-semibold">{title}</span>
            <span className="text-caption text-ink-2">{hint}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
