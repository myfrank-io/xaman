import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { ImportWizard } from "@/components/import/ImportWizard";
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
 * Visual acceptance of the import screen (E12-2, E12-5 → E12-7) without a database: the two
 * states of the wizard, the empty one and the one holding a table, so the touch audit covers
 * the file picker as well as the mapping cards and the preview.
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
