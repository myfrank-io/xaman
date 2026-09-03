import Link from "next/link";
import type { Route } from "next";
import { PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import type { CategoryChoice } from "@/components/common/CategoryChips";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { LogActions } from "@/components/logs/LogActions";
import { LogDetail } from "@/components/logs/LogDetail";
import { LogForm } from "@/components/logs/LogForm";
import { LogsList } from "@/components/logs/LogsList";
import { LogsToolbar } from "@/components/logs/LogsToolbar";

import { DEV_ATTACHMENTS } from "../attachments/sample";
import { DevShell, DEV_BOAT_ID } from "../DevShell";
import { SAMPLE_CATEGORIES } from "../sample-data";
import { DevLogsGallery } from "./DevLogsGallery";
import {
  DEV_CONTACTS,
  DEV_ENGINES,
  DEV_EQUIPMENT,
  DEV_HAUL_OUTS,
  DEV_LOG_COMPLETIONS,
  DEV_LOG_DETAIL,
  DEV_LOG_ROWS,
} from "./sample";

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
 * Visual acceptance of the journal (E3-2, E3-3, E3-4) without Supabase: the list in every
 * status, the form with its hours block open, and the detail.
 */
export default async function DevLogsPage() {
  const [t, tc] = await Promise.all([getTranslations("logs"), getTranslations("create")]);
  return (
    <DevShell>
      <div className="flex flex-col gap-12 pb-16">
        <div>
          <h1 className="text-h1">Journal</h1>
          <p className="mt-1 text-body text-ink-2">
            Recette visuelle des écrans du journal, avec des données factices.
          </p>
        </div>

        <Section
          title="En-tête"
          description="« Noter une intervention » en haut à droite : sur cet écran, l'action de la page remplace le « + » du cadre (D35)."
        >
          <PageHeader
            title={t("title")}
            subtitle={t("results", { count: 7 })}
            actions={
              <Button asChild size="xl">
                <Link href={`/boats/${DEV_BOAT_ID}/logs/new` as Route}>
                  <PlusIcon />
                  {tc("newLog")}
                </Link>
              </Button>
            }
          />
        </Section>

        <Section
          title="Liste"
          description="Lignes de 76 px, liseré de catégorie, heures relevées à droite, « À vérifier » en ambre."
        >
          <LogsToolbar
            boatId={DEV_BOAT_ID}
            filters={{
              tab: "history",
              q: "",
              category: "",
              status: "",
              review: false,
              contact: "",
            }}
            categories={CATEGORIES}
            reviewCount={2}
            contactName={null}
            canContribute
          />
          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <LogsList boatId={DEV_BOAT_ID} rows={DEV_LOG_ROWS} />
          </div>
        </Section>

        <Section
          title="Suggestions et points concernés"
          description="Suggestions de titre ouvertes (jamais de datalist) et points de checklist pré-cochés ; le point sans heures est grisé."
        >
          <DevLogsGallery categories={CATEGORIES} />
        </Section>

        <Section
          title="Formulaire"
          description="Catégorie Moteurs sélectionnée : le bloc des heures est déplié, les champs restent vides."
        >
          <LogForm
            boatId={DEV_BOAT_ID}
            log={null}
            prefill={{
              title: "Vidange moteur SB",
              categoryId: CATEGORIES[0]?.id,
              expandHours: true,
            }}
            categories={CATEGORIES}
            engines={DEV_ENGINES}
            engineCategoryIds={[CATEGORIES[0]?.id ?? ""]}
            contacts={DEV_CONTACTS}
            equipment={DEV_EQUIPMENT}
            haulOuts={DEV_HAUL_OUTS}
            canCreateContact
          />
        </Section>

        <Section
          title="Détail"
          description="Toutes les informations, les cochages liés et le pied « créé par »."
        >
          <LogDetail
            boatId={DEV_BOAT_ID}
            log={DEV_LOG_DETAIL}
            contact={{ name: "Motoriste Yanmar", phone: "04 94 00 00 00" }}
            haulOut={{ id: "haul-1", label: "10/01/2026 · Chantier Naval de Hyères" }}
            engineHours={[
              { engineId: "engine-sb", label: "Moteur SB", hours: 1256 },
              { engineId: "engine-bb", label: "Moteur BB", hours: 1208 },
            ]}
            completions={DEV_LOG_COMPLETIONS}
            purchases={[{ id: "purchase-1", designation: "Filtres à huile ×2", amount: 48.5 }]}
            attachments={DEV_ATTACHMENTS}
            canWrite
            actions={
              <LogActions
                boatId={DEV_BOAT_ID}
                canWrite
                log={{
                  id: DEV_LOG_DETAIL.id,
                  title: DEV_LOG_DETAIL.title,
                  categoryId: DEV_LOG_DETAIL.categoryId,
                  contactId: "contact-engine",
                  equipmentId: "equip-1",
                  engineHours: [
                    { engineId: "engine-sb", label: "Moteur SB", hours: 1256 },
                    { engineId: "engine-bb", label: "Moteur BB", hours: 1208 },
                  ],
                }}
              />
            }
          />
        </Section>
      </div>
    </DevShell>
  );
}
