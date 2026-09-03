import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PlusIcon, UploadIcon } from "lucide-react";

import { ContactForm } from "@/components/contacts/ContactForm";
import { ContactsList } from "@/components/contacts/ContactsList";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/button";

import { DevShell } from "../DevShell";
import { ContactPickerDemo } from "./ContactPickerDemo";
import { devUiEnabled } from "@/lib/dev-ui";

const DEV_BOAT_ID = "00000000-0000-4000-8000-000000000000";

const CONTACTS = [
  {
    id: "c1",
    name: "Chantier Naval de Hyères",
    specialty: "Chantier carénage",
    company: null,
    phone: "04 94 00 00 00",
    email: "contact@exemple.fr",
  },
  {
    id: "c2",
    name: "Yann Le Goff",
    specialty: "Voilier",
    company: "Voilerie du Port",
    phone: "06 00 00 00 01",
    email: null,
  },
  {
    id: "c3",
    name: "Paul Martin",
    specialty: "Motoriste",
    company: "Yanmar Service",
    phone: "06 00 00 00 02",
    email: "paul@exemple.fr",
  },
  {
    id: "c4",
    name: "Léa Bernard",
    specialty: "Électronicien",
    company: null,
    phone: null,
    email: "lea@exemple.fr",
  },
  {
    id: "c5",
    name: "Marc Petit",
    specialty: "Mécanicien hors-bord",
    company: "Suzuki Marine",
    phone: "06 00 00 00 05",
    email: null,
  },
];

/** Static mock-up of the contacts module for visual acceptance (no seed needed). */
export default async function DevContactsPage() {
  if (!devUiEnabled()) notFound();
  const t = await getTranslations("contacts");
  const ti = await getTranslations("import");
  return (
    <DevShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-4 sm:p-6">
        {/* The same actions the real page carries. The mock used to show the header bare, so
            the touch audit never saw the two buttons that have to share a 358 px row — which
            is how « on a perdu le bouton pour importer un intervenant » got past it. */}
        <PageHeader
          title={t("title")}
          subtitle={t("count", { count: CONTACTS.length })}
          actions={
            <>
              <Button asChild variant="outline">
                <a href={`/boats/${DEV_BOAT_ID}/import?entity=contacts`}>
                  <UploadIcon />
                  {ti("action")}
                </a>
              </Button>
              <Button asChild>
                <a href={`/boats/${DEV_BOAT_ID}/contacts/new`}>
                  <PlusIcon />
                  {t("new")}
                </a>
              </Button>
            </>
          }
        />
        <ContactsList boatId={DEV_BOAT_ID} contacts={CONTACTS} canWrite />
        <SectionCard title={t("picker.provider")} bare>
          <div className="rounded-xl border border-border bg-surface p-5">
            <ContactPickerDemo boatId={DEV_BOAT_ID} contacts={CONTACTS} />
          </div>
        </SectionCard>
        {/* The form itself had no preview: the trade is a row of chips plus a free field
            behind « Autre » (D44), which is the control most likely to spill on a phone. */}
        {/* Rendered bare, exactly as `/contacts/new` renders it: its action bar bleeds into
            the page padding with a negative margin, so nesting it in a padded card pushes the
            whole column sideways — a defect of the preview, not of the form. */}
        {/* The creation case, which is the only one that offers « Choisir dans mes contacts »:
            on an existing provider the picker would overwrite what is already right. The mock
            showed only the edit form, so the audit never saw the button. */}
        <SectionCard title={t("new")} bare>
          <div>
            <ContactForm boatId={DEV_BOAT_ID} contact={null} usedSpecialties={["Gréeur"]} />
          </div>
        </SectionCard>
        <SectionCard title={t("edit")} bare>
          <div>
            <ContactForm
              boatId={DEV_BOAT_ID}
              contact={{
                id: "00000000-0000-4000-8000-0000000000c1",
                name: "Chantier Naval du Guip — Brest",
                specialty: "Chantier carénage",
                company: "Le Guip",
                phone: "02 98 00 00 00",
                email: "contact@chantier-naval-du-guip.example.fr",
                address: "1 quai du Commandant Malbert, 29200 Brest",
                notes: "Demander Yann. Créneau de carénage à réserver six mois à l'avance.",
                updatedAt: "2026-09-03T08:00:00.000Z",
              }}
              usedSpecialties={["Gréeur", "Peintre coque"]}
            />
          </div>
        </SectionCard>
      </div>
    </DevShell>
  );
}
