import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractText, isExtractable } from "@/lib/inbox/extract";
import {
  findDate,
  fold,
  HEURISTIC_WARNING_CODES,
  heuristicSuggestion,
  parseAmount,
} from "@/lib/inbox/heuristics";
import type { InboxContext } from "@/lib/inbox/prompt";

import fr from "../../src/messages/fr.json";

/**
 * The local reader (D92): the document's text, then the rules. The fixtures are one invoice
 * rendered by Chromium — as a PDF with its text layer, and as a PNG the OCR has to read.
 */
const FIXTURES = path.join(__dirname, "..", "fixtures", "inbox");

const context: InboxContext = {
  boatName: "Xaman",
  boatType: "catamaran",
  today: "2026-09-08",
  categories: [
    { id: "cat-engines", name: "Moteurs", externalRef: "engines" },
    { id: "cat-hull", name: "Coque & Pont", externalRef: "hull_deck" },
    { id: "cat-energy", name: "Énergie", externalRef: "energy" },
    { id: "cat-safety", name: "Sécurité", externalRef: "safety" },
  ],
  engines: [
    { id: "eng-port", label: "Moteur bâbord", propulsion: "saildrive" },
    { id: "eng-sb", label: "Moteur tribord", propulsion: "saildrive" },
  ],
  contacts: [
    { id: "contact-yard", name: "Chantier naval du Port", company: null, specialty: "yard" },
    { id: "contact-elec", name: "Marc Le Gall", company: "Marine Élec", specialty: "electrician" },
  ],
};

const INVOICE_TEXT = `CHANTIER NAVAL DU PORT
12 quai des Pêcheurs, 56000 Vannes — SIRET 123 456 789 00012
FACTURE N° F-2026-0412
Date : 12/03/2026  Échéance : 12/04/2026
Bateau : Xaman — moteur tribord, compteur 1 245 h
Vidange moteur tribord (main d'œuvre 2 h) 180,00 €
Huile Yanmar 15W40 5 L 62,50 €
Filtre à huile Yanmar 119305-35170 24,90 €
Turbine pompe eau de mer 48,00 €
Total HT : 262,83 €
TVA 20 % : 52,57 €
Total TTC : 315,40 €
Net à payer : 315,40 € — Merci de votre confiance`;

describe("the local reader's helpers", () => {
  it("folds accents, ligatures and case", () => {
    expect(fold("Main d'Œuvre — Réparation")).toBe("main d'oeuvre — reparation");
  });

  it.each([
    ["315", "40", 315.4],
    ["1 234", "56", 1234.56],
    ["1.234", "56", 1234.56],
    ["48", undefined, 48],
    ["12", "5", 12.5],
  ])("parses %s,%s", (whole, cents, expected) => {
    expect(parseAmount(whole, cents)).toBe(expected);
  });

  it("prefers the labelled date, never a deadline, never the future", () => {
    expect(findDate(["Échéance : 12/04/2026", "Date : 12/03/2026"], "2026-09-08")).toEqual({
      date: "2026-03-12",
      labelled: true,
    });
    expect(findDate(["Vannes, le 3 mars 2026"], "2026-09-08")).toEqual({
      date: "2026-03-03",
      labelled: true,
    });
    expect(findDate(["Livraison 20/12/2026", "Facture 2026-01-15"], "2026-09-08")).toEqual({
      date: "2026-01-15",
      labelled: false,
    });
    expect(findDate(["Réf 31/02/2026", "Tél 02 97 00 00 00"], "2026-09-08")).toBeNull();
  });
});

describe("the local reader on an invoice", () => {
  const suggestion = heuristicSuggestion(
    { text: INVOICE_TEXT, fileName: "facture-0412.pdf", ocrConfidence: null },
    context,
  );

  it("files it as an intervention on the engines", () => {
    expect(suggestion).not.toBeNull();
    expect(suggestion?.documentType).toBe("invoice");
    expect(suggestion?.kind).toBe("log");
    expect(suggestion?.purchaseKind).toBe("service");
    expect(suggestion?.categoryId).toBe("cat-engines");
    expect(suggestion?.title).toBe("Vidange moteur tribord");
  });

  it("reads the date, the total including tax and the supplier", () => {
    expect(suggestion?.date).toBe("2026-03-12");
    expect(suggestion?.amount).toBe(315.4);
    expect(suggestion?.currency).toBe("EUR");
    expect(suggestion?.contactId).toBe("contact-yard");
    expect(suggestion?.supplierName).toBe("Chantier naval du Port");
  });

  it("reads the hour meter of the engine the line names", () => {
    expect(suggestion?.engineHours).toEqual([{ engineId: "eng-sb", hours: 1245 }]);
  });

  it("keeps the lines and drops the totals", () => {
    expect(suggestion?.lineItems.map((l) => l.designation)).toEqual([
      "Vidange moteur tribord (main d'œuvre 2 h)",
      "Huile Yanmar 15W40",
      "Filtre à huile Yanmar 119305-35170",
      "Turbine pompe eau de mer",
    ]);
    expect(suggestion?.lineItems.map((l) => l.amount)).toEqual([180, 62.5, 24.9, 48]);
  });

  it("is sure of a clean reading and says it read locally", () => {
    expect(suggestion?.confidence).toBe("high");
    expect(suggestion?.warnings).toEqual(["local"]);
  });
});

describe("the local reader on other papers", () => {
  it("files a shop receipt as a purchase of parts", () => {
    const text = `ACCASTILLAGE DIFFUSION LORIENT
TICKET DE CAISSE 04/07/2026 16:42
Anode zinc saildrive 2x 38,00 €
Manille inox 8 mm 6,90 €
TOTAL 44,90 €
CB SANS CONTACT 44,90
Merci de votre visite`;
    const s = heuristicSuggestion({ text, fileName: "IMG_0412.jpg", ocrConfidence: 88 }, context);
    expect(s?.documentType).toBe("receipt");
    expect(s?.kind).toBe("purchase");
    expect(s?.purchaseKind).toBe("part");
    expect(s?.title).toBe("Anode zinc saildrive");
    expect(s?.amount).toBe(44.9);
    expect(s?.date).toBe("2026-07-04");
    expect(s?.supplierName).toBe("ACCASTILLAGE DIFFUSION LORIENT");
    expect(s?.contactId).toBeNull();
    expect(s?.warnings).toContain("dateUnlabelled");
  });

  it("files a quote as an intervention and finds the contact by company", () => {
    const text = `Marine Élec — 4 rue du Port, Lorient
DEVIS n° D-118 du 02/09/2026
Remplacement chargeur de quai Victron 12/30 et câblage 380,00 € HT
Main d'œuvre 2 h 140,00 € HT
Total HT 520,00 €
Total TTC 624,00 €
Devis valable jusqu'au 02/10/2026`;
    const s = heuristicSuggestion({ text, fileName: "devis.pdf" }, context);
    expect(s?.documentType).toBe("quote");
    expect(s?.kind).toBe("log");
    expect(s?.title).toBe("Devis Marine Élec");
    expect(s?.contactId).toBe("contact-elec");
    expect(s?.categoryId).toBe("cat-energy");
    expect(s?.amount).toBe(624);
    expect(s?.date).toBe("2026-09-02");
  });

  it("guesses the largest amount when nothing says « total », and says so", () => {
    const text = `Station Marine du Crouesty
Gasoil 120 L 1,89 €/L 226,80 €
le 15/08/2026`;
    const s = heuristicSuggestion({ text, fileName: "gasoil.jpg", ocrConfidence: 61 }, context);
    expect(s?.kind).toBe("purchase");
    expect(s?.purchaseKind).toBe("gas");
    expect(s?.amount).toBe(226.8);
    expect(s?.warnings).toEqual(expect.arrayContaining(["amountGuessed", "ocrQuality"]));
    expect(s?.confidence).not.toBe("high");
  });

  it("gives up on a document without text", () => {
    expect(heuristicSuggestion({ text: "  \n 12 \n", fileName: "photo.jpg" }, context)).toBeNull();
  });

  it("names every warning code in French", () => {
    const words = (fr.inbox as { warningCodes: Record<string, string> }).warningCodes;
    for (const code of HEURISTIC_WARNING_CODES) expect(words[code]?.trim(), code).toBeTruthy();
  });
});

describe("the text of a document", () => {
  it("knows what it can read", () => {
    expect(isExtractable("application/pdf")).toBe(true);
    expect(isExtractable("image/jpeg")).toBe(true);
    expect(isExtractable("image/heic")).toBe(false);
  });

  it("reads a PDF's text layer line by line", async () => {
    const bytes = await readFile(path.join(FIXTURES, "invoice.pdf"));
    const { text, ocrConfidence } = await extractText(bytes, "application/pdf");
    expect(ocrConfidence).toBeNull();
    expect(text).toContain("Total TTC : 315,40 €");
    const s = heuristicSuggestion({ text, fileName: "invoice.pdf" }, context);
    expect(s?.amount).toBe(315.4);
    expect(s?.date).toBe("2026-03-12");
    expect(s?.contactId).toBe("contact-yard");
  });

  it("reads a photo with the French OCR model shipped in the repository", async () => {
    const bytes = await readFile(path.join(FIXTURES, "invoice.png"));
    const { text, ocrConfidence } = await extractText(bytes, "image/png");
    expect(ocrConfidence).toBeGreaterThan(70);
    const s = heuristicSuggestion({ text, fileName: "invoice.png", ocrConfidence }, context);
    expect(s?.amount).toBe(315.4);
    expect(s?.date).toBe("2026-03-12");
    expect(s?.kind).toBe("log");
    expect(s?.categoryId).toBe("cat-engines");
  }, 60_000);
});
