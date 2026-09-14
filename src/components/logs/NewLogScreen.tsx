"use client";

import { useState } from "react";

import type { CategoryChoice } from "@/components/common/CategoryChips";
import type { ContactOption } from "@/components/contacts/specialties";
import { LogDocumentStart, type ReadDocument } from "@/components/logs/LogDocumentStart";
import { LogForm } from "@/components/logs/LogForm";
import {
  mergePrefill,
  type LogFormChoice,
  type LogFormDocument,
  type LogFormEngine,
  type LogFormPrefill,
} from "@/components/logs/log-form-values";

/**
 * « Noter une intervention » en deux temps (D115) : le document, puis le formulaire.
 *
 * L'écran ne fait que tenir l'ordre. Le premier temps vit dans `LogDocumentStart` (envoi et
 * lecture, la chaîne de la boîte de réception), le second dans `LogForm`, inchangé pour tous les
 * autres chemins — la checklist, « Refaire », la fiche moteur arrivent avec leurs paramètres et
 * sautent directement au formulaire, parce qu'elles savent déjà de quoi elles parlent.
 */
export function NewLogScreen({
  boatId,
  prefill,
  askForDocument,
  categories,
  engines,
  engineCategoryIds,
  contacts,
  equipment,
  haulOuts,
  canCreateContact,
}: {
  boatId: string;
  prefill: LogFormPrefill;
  /** False when the URL already says what the intervention is about. */
  askForDocument: boolean;
  categories: CategoryChoice[];
  engines: LogFormEngine[];
  engineCategoryIds: string[];
  contacts: ContactOption[];
  equipment: LogFormChoice[];
  haulOuts: LogFormChoice[];
  canCreateContact: boolean;
}) {
  const [step, setStep] = useState<"document" | "form">(askForDocument ? "document" : "form");
  const [read, setRead] = useState<ReadDocument | null>(null);

  if (step === "document") {
    return (
      <LogDocumentStart
        boatId={boatId}
        onRead={(read) => {
          setRead(read);
          setStep("form");
        }}
        onSkip={() => setStep("form")}
      />
    );
  }

  const sourceDocument: LogFormDocument | undefined = read
    ? {
        itemId: read.itemId,
        fileName: read.fileName,
        kind: read.suggestion?.kind ?? "log",
      }
    : undefined;

  return (
    <LogForm
      // Remounted when the document lands, so the form's defaults are the reading's: everything
      // it fills is a default value, and a default only ever applies at mount.
      key={read?.itemId ?? "blank"}
      boatId={boatId}
      log={null}
      prefill={read ? mergePrefill(prefill, read.suggestion, engines) : prefill}
      sourceDocument={sourceDocument}
      categories={categories}
      engines={engines}
      engineCategoryIds={engineCategoryIds}
      contacts={contacts}
      equipment={equipment}
      haulOuts={haulOuts}
      canCreateContact={canCreateContact}
    />
  );
}
