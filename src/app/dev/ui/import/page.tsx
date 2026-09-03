import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { ImportWizard } from "@/components/import/ImportWizard";
import type { ImportCatalog } from "@/lib/import/entities";
import { normaliseHeader } from "@/lib/import/mapping";

import { DEV_BOAT_ID, DevShell } from "../DevShell";

/**
 * A real stock export, tabs and all: two columns nothing maps to (« Fournisseur », « Dernier
 * achat »), one line without a designation, and a piece already on the boat. That is what the
 * mapping and the preview have to survive.
 */
const SAMPLE = [
  "Désignation\tRéf.\tQté\tSeuil\tEmplacement\tFournisseur\tDernier achat",
  "Filtre à huile Volvo\t3847643\t2\t1\tCoffre bâbord\tLe Guip\t12/03/2025",
  "Filtre à gasoil\t861477\t4\t2\tCoffre moteur\tVolvo Penta\t04/11/2024",
  "Courroie alternateur\t966051\t1\t1\tCoffre bâbord\tVolvo Penta\t18/06/2025",
  "\t000000\t3\t1\tCale avant\tAccastillage Diffusion\t02/02/2025",
  "Anode d'embase\t3588746\t6\t4\tCale avant\tVolvo Penta\t21/09/2024",
].join("\n");

/**
 * A logbook of hour readings (E12-4): the port engine named two ways, one line the boat has
 * no engine for, and one counter that drops back — the three refusals the preview has to
 * name before anything is written.
 */
const READINGS_SAMPLE = [
  "Moteur\tRelevé le\tHeures\tCommentaire",
  "Moteur bâbord\t10/01/2026\t1000\tDépart Lorient",
  "BB\t01/04/2026\t1180\t",
  "Moteur bâbord\t14/06/2026\t900\tSaisie douteuse",
  "Moteur central\t14/06/2026\t420\t",
  "Moteur tribord\t14/06/2026\t1204,5\t",
].join("\n");

/** The two engines the sample names, as the import screen would read them from the boat. */
const READINGS_CATALOG: ImportCatalog = {
  engines: [
    { id: "22222222-2222-4222-8222-000000000001", label: "Moteur bâbord", position: "port" },
    { id: "22222222-2222-4222-8222-000000000002", label: "Moteur tribord", position: "starboard" },
  ],
  readings: [],
};

/**
 * Visual acceptance of the import screen (E12-2, E12-4 → E12-7) without a database: the three
 * states of the wizard — one holding a clean table, one holding a table with refusals, and the
 * empty one — so the touch audit covers the file picker, the mapping cards and the preview.
 */
export default async function DevImportPage() {
  const t = await getTranslations("import");
  return (
    <DevShell>
      <div className="flex flex-col gap-12 pb-16">
        <div className="flex flex-col gap-6">
          <PageHeader title={t("entities.parts.title")} subtitle={t("subtitle")} />
          <ImportWizard
            boatId={DEV_BOAT_ID}
            entity="parts"
            backHref="/dev/ui"
            backLabel={t("back.parts")}
            existingKeys={[normaliseHeader("Filtre à huile Volvo")]}
            initialText={SAMPLE}
          />
        </div>

        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-h2">Relevés d&apos;heures</h2>
            <p className="mt-1 text-caption text-ink-2">
              Rapprochement par nom : « BB » trouve le moteur bâbord, un moteur inconnu et un
              compteur en baisse sont refusés et nommés.
            </p>
          </div>
          <ImportWizard
            boatId={DEV_BOAT_ID}
            entity="readings"
            backHref="/dev/ui"
            backLabel={t("back.readings")}
            catalog={READINGS_CATALOG}
            initialText={READINGS_SAMPLE}
          />
        </section>

        <section className="flex flex-col gap-6">
          <div>
            <h2 className="text-h2">Écran vierge</h2>
            <p className="mt-1 text-caption text-ink-2">
              Avant tout fichier : formats acceptés, modèle à télécharger, zone de collage.
            </p>
          </div>
          <ImportWizard
            boatId={DEV_BOAT_ID}
            entity="contacts"
            backHref="/dev/ui"
            backLabel={t("back.contacts")}
          />
        </section>
      </div>
    </DevShell>
  );
}
