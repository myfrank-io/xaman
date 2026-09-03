import { getTranslations } from "next-intl/server";

import { ListRow } from "@/components/common/ListRow";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { PurgeButton } from "@/components/trash/PurgeButton";
import { RestoreButton, type TrashKind } from "@/components/trash/RestoreButton";

import { DEV_BOAT_ID, DevShell } from "../DevShell";

/**
 * Visual acceptance of the trash (D40 / D41), the screen that grew six sections today and had
 * no preview. It is the densest row in the app: a title, two lines of metadata, an amount, and
 * **two** buttons — restore and purge — which is exactly the row most likely to break on a
 * phone. Long French names on purpose; short ones prove nothing.
 */
const ROWS: { kind: TrashKind; title: string; meta: string; amount?: string }[] = [
  {
    kind: "log",
    title: "Remplacement du guindant du Code 0 et révision de l'emmagasineur",
    meta: "Voiles & Gréement · supprimée le 03/09/2026 par Xavier Marin · purge dans 30 j",
    amount: "1 284,00 €",
  },
  {
    kind: "purchase",
    title: "Accastillage Diffusion — commande du 12/03",
    meta: "Pièce · supprimé le 02/09/2026 · purge dans 29 j",
    amount: "342,90 €",
  },
  {
    kind: "part",
    title: "Filtre à huile Volvo Penta D2-75",
    meta: "Moteurs · supprimée le 03/09/2026 · purge dans 30 j",
  },
  {
    kind: "contact",
    title: "Chantier Naval du Guip — Brest",
    meta: "Chantier carénage · supprimé le 01/09/2026 · purge dans 28 j",
  },
];

export default async function DevTrashPage() {
  const t = await getTranslations("trash");

  return (
    <DevShell>
      <div className="flex flex-col gap-6 pb-16">
        <PageHeader title={t("title")} subtitle={t("description")} />
        <SectionCard title={t("sections.logs")}>
          {ROWS.map((row, index) => (
            <ListRow
              key={row.kind}
              size="lg"
              categoryColor={index === 0 ? "#B24A2E" : undefined}
              title={row.title}
              meta={<span className="truncate">{row.meta}</span>}
              trailing={
                row.amount ? (
                  <span className="num text-caption text-ink-2">{row.amount}</span>
                ) : null
              }
              action={
                <div className="flex items-center gap-1">
                  <RestoreButton boatId={DEV_BOAT_ID} id={`dev-${row.kind}`} kind={row.kind} />
                  <PurgeButton
                    boatId={DEV_BOAT_ID}
                    id={`dev-${row.kind}`}
                    kind={row.kind}
                    label={row.title}
                  />
                </div>
              }
            />
          ))}
        </SectionCard>
      </div>
    </DevShell>
  );
}
