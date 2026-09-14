import { describe, expect, it } from "vitest";

import {
  hasPrefillParams,
  mergePrefill,
  type LogFormEngine,
  type LogFormPrefill,
} from "@/components/logs/log-form-values";
import type { InboxSuggestion } from "@/lib/schemas/inbox";

/**
 * Une intervention commence par son document (D115) — et ce que la lecture propose se traduit dans
 * la langue du formulaire sans jamais écraser ce que l'URL avait déjà dit : un paramètre est une
 * intention explicite, une lecture est une proposition (D91).
 */
const CATEGORY = "11111111-1111-4111-8111-111111111111";
const ENGINE = "22222222-2222-4222-8222-222222222222";
const CONTACT = "33333333-3333-4333-8333-333333333333";

const ENGINES: LogFormEngine[] = [
  { id: ENGINE, label: "Moteur bâbord", lastHours: 1200, lastDate: "2026-06-01" },
];

const suggestion: InboxSuggestion = {
  documentType: "invoice",
  kind: "log",
  purchaseKind: "service",
  title: "Vidange moteur bâbord",
  date: "2026-09-01",
  amount: 312.46,
  currency: "EUR",
  supplierName: "Chantier Naval du Golfe",
  supplier: {
    name: "Chantier Naval du Golfe",
    company: null,
    phone: "02 97 55 12 34",
    email: "contact@cn-golfe.fr",
    address: "12 quai des Voiliers, 56000 Vannes",
  },
  contactId: CONTACT,
  categoryId: CATEGORY,
  engineHours: [{ engineId: ENGINE, hours: 1284 }],
  lineItems: [{ designation: "Huile 15W40", amount: 48 }],
  notes: "Vidange et filtre.",
  confidence: "high",
  warnings: [],
};

describe("le formulaire pré-rempli par le document (D115)", () => {
  it("traduit la lecture dans les chaînes que les champs tactiles parlent", () => {
    const prefill = mergePrefill({}, suggestion, ENGINES);
    expect(prefill.title).toBe("Vidange moteur bâbord");
    expect(prefill.categoryIds).toEqual([CATEGORY]);
    expect(prefill.performedAt).toBe("2026-09-01");
    // Virgule française, jamais un point : c'est ce que `NumericField` affiche et relit.
    expect(prefill.cost).toBe("312,46");
    expect(prefill.contactId).toBe(CONTACT);
    expect(prefill.hours).toEqual([{ engineId: ENGINE, hours: "1284" }]);
    // Un relevé lu ouvre le bloc des heures : une valeur qui sera enregistrée n'est jamais
    // invisible (règle 13).
    expect(prefill.expandHours).toBe(true);
    expect(prefill.notes).toContain("Vidange et filtre.");
    expect(prefill.notes).toContain("Huile 15W40");
    expect(prefill.supplier?.phone).toBe("02 97 55 12 34");
  });

  it("ne touche à rien de ce que l'URL a déjà nommé", () => {
    const fromUrl: LogFormPrefill = {
      title: "Carénage",
      categoryIds: ["44444444-4444-4444-8444-444444444444"],
      performedAt: "2026-08-15",
      contactId: "55555555-5555-4555-8555-555555555555",
      hours: [{ engineId: ENGINE, hours: "1000" }],
    };
    const prefill = mergePrefill(fromUrl, suggestion, ENGINES);
    expect(prefill.title).toBe("Carénage");
    expect(prefill.categoryIds).toEqual(fromUrl.categoryIds);
    expect(prefill.performedAt).toBe("2026-08-15");
    expect(prefill.contactId).toBe(fromUrl.contactId);
    expect(prefill.hours).toEqual(fromUrl.hours);
    // Ce que l'URL ne disait pas, la lecture le remplit quand même.
    expect(prefill.cost).toBe("312,46");
  });

  it("laisse tomber un moteur que ce bateau n'a pas, et un document illisible ne propose rien", () => {
    const other = mergePrefill(
      {},
      { ...suggestion, engineHours: [{ engineId: "un-autre-moteur", hours: 10 }] },
      ENGINES,
    );
    expect(other.hours).toEqual([]);
    expect(other.expandHours).toBe(false);
    expect(mergePrefill({ title: "Saisie à la main" }, null, ENGINES)).toEqual({
      title: "Saisie à la main",
    });
  });

  it("retombe sur le nom seul quand la lecture est antérieure au bloc prestataire (D116)", () => {
    const old = mergePrefill(
      {},
      {
        ...suggestion,
        supplier: { name: null, company: null, phone: null, email: null, address: null },
      },
      ENGINES,
    );
    expect(old.supplier?.name).toBe("Chantier Naval du Golfe");
  });
});

describe("les chemins qui savent déjà de quoi ils parlent sautent l'étape du document", () => {
  it("reconnaît chacun des paramètres de pré-remplissage", () => {
    expect(hasPrefillParams({})).toBe(false);
    expect(hasPrefillParams({ from: "dashboard" })).toBe(false);
    // Le dialogue « Fait » de la checklist, « Refaire », la fiche moteur, la fiche équipement.
    expect(hasPrefillParams({ item: "x" })).toBe(true);
    expect(hasPrefillParams({ title: "Vidange", category: "y" })).toBe(true);
    expect(hasPrefillParams({ engine: "z" })).toBe(true);
    expect(hasPrefillParams({ hours: ["a:1"] })).toBe(true);
  });
});
