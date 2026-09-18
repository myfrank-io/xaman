"use client";

import Link from "next/link";
import type { Route } from "next";
import { MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CopyButton } from "@/components/ui/copy-button";
import { boatPath } from "@/lib/queries/boat-routes";

/**
 * Le troisième acte du tableau de bord : **l'adresse du carnet** (E18-15, D145).
 *
 * Chaque bateau a son adresse e-mail depuis D91 : ce qu'on lui envoie arrive dans « À valider »,
 * lu et pré-rempli, et un tap en fait une intervention ou un achat. C'est l'entrée la moins
 * coûteuse de toute l'application — on transfère une facture reçue par mail, on n'ouvre rien —
 * et elle était rangée là où personne ne la cherche : dans la feuille « Plus », et dans l'accordéon
 * d'identité du bateau. Une porte qu'on ne voit pas n'existe pas.
 *
 * Elle prend donc sa place à côté des deux autres façons d'écrire dans le carnet (D133), et
 * l'adresse **est** la ligne de la carte : on la lit sans rien ouvrir. La carte mène à
 * « À valider », où se trouvent l'appareil photo et ce qui attend ; le bouton, lui, copie
 * l'adresse — c'est ce qu'on veut dans l'application Mail, et ça évite de la recopier à la main.
 */
export function InboxAddressAct({ boatId, address }: { boatId: string; address: string }) {
  const t = useTranslations("dashboard.write");

  return (
    <div className="flex min-h-20 items-center gap-3 rounded-xl border border-border-strong bg-surface p-4 shadow-sm">
      <Link
        href={boatPath(boatId, "inbox") as Route}
        className="-m-4 flex min-w-0 flex-1 items-center gap-3 rounded-xl tap-feedback p-4 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MailIcon className="size-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-body font-semibold">{t("mailTitle")}</span>
          {/* L'adresse elle-même, lisible sans rien ouvrir : c'est elle, la promesse de la carte. */}
          <span className="num text-caption break-all text-ink-2 select-all">{address}</span>
        </span>
      </Link>
      {/* Sans presse-papiers (vieux WebView) rien ne se passe : l'adresse est à l'écran,
          sélectionnable. */}
      <CopyButton
        iconOnly
        value={address}
        label={t("mailCopy")}
        onCopied={() => toast.success(t("mailCopied"), { description: address })}
      />
    </div>
  );
}
