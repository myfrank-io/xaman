"use client";

import Link from "next/link";
import type { Route } from "next";
import { MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CopyButton } from "@/components/ui/copy-button";
import { boatPath } from "@/lib/queries/boat-routes";

/**
 * L'adresse du carnet, portée là où on y pense (D145, étendu).
 *
 * La même carte « Par e-mail » que l'écran « À valider », en version compacte et réutilisable :
 * elle nomme l'adresse, mène à « À valider », et le bouton la copie — c'est ce qu'on veut dans
 * l'application Mail. Elle se pose partout où envoyer un papier au bateau est l'entrée la moins
 * coûteuse : les Dépenses (une facture reçue par mail), le Journal (une facture de l'intervention
 * d'hier). Présente seulement quand `INBOUND_EMAIL_DOMAIN` est configuré (l'appelant passe `null`
 * sinon) et pour qui peut contribuer.
 */
export function InboxAddressCard({ boatId, address }: { boatId: string; address: string }) {
  const t = useTranslations("inbox.address");

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <MailIcon aria-hidden className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="text-body font-semibold">{t("title")}</h2>
          <p className="text-caption text-ink-2">{t("help")}</p>
        </div>
      </div>
      <Link
        href={boatPath(boatId, "inbox") as Route}
        className="rounded-lg border border-border tap-feedback bg-surface px-3 py-2 num text-label break-all select-all focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {address}
      </Link>
      {/* Sans presse-papiers (vieux WebView) rien ne se passe : l'adresse est à l'écran,
          sélectionnable. */}
      <div>
        <CopyButton value={address} label={t("copy")} onCopied={() => toast.success(t("copied"))} />
      </div>
    </section>
  );
}
