import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { ContactsList } from "@/components/contacts/ContactsList";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";

import { ContactPickerDemo } from "./ContactPickerDemo";

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
  if (process.env.NODE_ENV === "production") notFound();
  const t = await getTranslations("contacts");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <PageHeader title={t("title")} subtitle={t("count", { count: CONTACTS.length })} />
      <ContactsList boatId={DEV_BOAT_ID} contacts={CONTACTS} canWrite />
      <SectionCard title={t("picker.provider")} bare>
        <div className="rounded-xl border border-border bg-surface p-5">
          <ContactPickerDemo boatId={DEV_BOAT_ID} contacts={CONTACTS} />
        </div>
      </SectionCard>
    </div>
  );
}
