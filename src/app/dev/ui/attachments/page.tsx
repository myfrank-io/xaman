import { AttachmentGallery } from "@/components/attachments/AttachmentGallery";
import { AttachmentPicker } from "@/components/attachments/AttachmentPicker";
import { DocumentImport } from "@/components/attachments/DocumentImport";
import type { CategoryChoice } from "@/components/common/CategoryChips";

import { DevShell, DEV_BOAT_ID } from "../DevShell";
import { SAMPLE_CATEGORIES } from "../sample-data";
import { DEV_ATTACHMENTS, DEV_ATTACHMENT_OWNER, DEV_DOCUMENT_LOGS } from "./sample";

const CATEGORIES: CategoryChoice[] = SAMPLE_CATEGORIES.map((category) => ({ ...category }));

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2">{title}</h2>
        {description ? <p className="mt-1 text-caption text-ink-2">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Visual acceptance of the attachments (E10-1) without Supabase: the gallery of a sheet, the
 * picker of a form and the batch import. Nothing uploads here — the buttons open the pickers
 * of the device, which is exactly what the touch audit has to measure.
 */
export default async function DevAttachmentsPage() {
  return (
    <DevShell>
      <div className="flex flex-col gap-12 pb-16">
        <div>
          <h1 className="text-h1">Photos et documents</h1>
          <p className="mt-1 text-body text-ink-2">
            Recette visuelle des pièces jointes : galerie d&apos;une fiche, sélecteur d&apos;un
            formulaire, import en lot.
          </p>
        </div>

        <Section
          title="Galerie"
          description="Vignettes 4:3, PDF en pastille de document, légende dessous, « ajouté par » en pied. Le dernier objet est illisible : l'aperçu le dit."
        >
          <AttachmentGallery items={DEV_ATTACHMENTS} />
        </Section>

        <Section
          title="Sélecteur"
          description="Trois entrées (caméra, photothèque, Fichiers), une légende par document, une suppression qui passe par la corbeille."
        >
          <AttachmentPicker
            boatId={DEV_BOAT_ID}
            owner={{ type: "maintenance_log", id: DEV_ATTACHMENT_OWNER }}
            initial={DEV_ATTACHMENTS.slice(0, 2)}
          />
        </Section>

        <Section
          title="Import en lot"
          description="Un lot déposé d'un coup ; rien ne part avant qu'on ait dit où le ranger."
        >
          <DocumentImport
            boatId={DEV_BOAT_ID}
            logs={DEV_DOCUMENT_LOGS}
            categories={CATEGORIES}
            canWrite
          />
        </Section>
      </div>
    </DevShell>
  );
}
