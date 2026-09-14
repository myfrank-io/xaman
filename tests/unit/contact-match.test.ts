import { describe, expect, it } from "vitest";

import {
  contactDraftFromSupplier,
  EMPTY_SUPPLIER,
  foldName,
  hasSupplierDetails,
  matchSupplierContact,
  phoneKey,
  supplierDisplayName,
  type ContactLike,
  type SupplierRead,
} from "@/lib/contacts/match";

/**
 * Le rapprochement du prestataire lu sur un document (D119).
 *
 * Ce que ces cas gardent, c'est la ligne : un rapprochement **exact** ou rien. Un score flou
 * rangerait une facture sous le mauvais prestataire, ce qu'aucun écran ne rattrape ; une absence
 * de rapprochement coûte un tap et propose une fiche déjà remplie.
 */
const YARD: ContactLike = {
  id: "contact-yard",
  name: "Chantier Naval du Golfe",
  company: null,
  phone: "02 97 55 12 34",
  email: "contact@cn-golfe.fr",
};
const SAILMAKER: ContactLike = {
  id: "contact-sails",
  name: "Marc Le Gall",
  company: "Voilerie du Ponant",
  phone: null,
  email: null,
};
const CONTACTS = [YARD, SAILMAKER];

function supplier(over: Partial<SupplierRead> = {}): SupplierRead {
  return { ...EMPTY_SUPPLIER, ...over };
}

describe("les clés de comparaison", () => {
  it("ramène un numéro à ses neuf derniers chiffres, quelle que soit sa forme", () => {
    expect(phoneKey("+33 2 97 55 12 34")).toBe("297551234");
    expect(phoneKey("02.97.55.12.34")).toBe("297551234");
    expect(phoneKey("0033297551234")).toBe("297551234");
    // Trop court pour identifier quoi que ce soit : on ne compare pas.
    expect(phoneKey("55 12 34")).toBeNull();
  });

  it("ignore accents, casse, ponctuation et forme sociale", () => {
    expect(foldName("SARL Chantier Naval du Golfe")).toBe("chantier naval du golfe");
    expect(foldName("Voilerie  du   Ponant.")).toBe("voilerie du ponant");
  });
});

describe("rapprocher ce que le document dit avec l'annuaire", () => {
  it("reconnaît une adresse e-mail exacte, et le dit", () => {
    const match = matchSupplierContact(
      supplier({ name: "CN GOLFE", email: "Contact@CN-Golfe.fr" }),
      CONTACTS,
    );
    expect(match).toEqual({ contactId: YARD.id, key: "email" });
  });

  it("reconnaît un numéro écrit autrement que dans la fiche", () => {
    const match = matchSupplierContact(
      supplier({ name: "Le chantier", phone: "+33 (0)2 97 55 12 34" }),
      CONTACTS,
    );
    expect(match).toEqual({ contactId: YARD.id, key: "phone" });
  });

  it("reconnaît une raison sociale, même préfixée et accentuée", () => {
    expect(
      matchSupplierContact(supplier({ company: "SARL Chantier Naval du Golfe" }), CONTACTS),
    ).toEqual({ contactId: YARD.id, key: "name" });
    // La fiche porte le nom d'une personne et la société sur le document : les deux comptent.
    expect(matchSupplierContact(supplier({ name: "Voilerie du Ponant" }), CONTACTS)).toEqual({
      contactId: SAILMAKER.id,
      key: "name",
    });
  });

  it("ne rapproche rien sur un fragment trop court ou un inconnu", () => {
    expect(matchSupplierContact(supplier({ name: "CN" }), CONTACTS)).toBeNull();
    expect(
      matchSupplierContact(
        supplier({ name: "Accastillage Diffusion", phone: "04 94 00 11 22" }),
        CONTACTS,
      ),
    ).toBeNull();
    expect(matchSupplierContact(EMPTY_SUPPLIER, CONTACTS)).toBeNull();
  });

  /** L'e-mail est plus sûr que le nom : deux fiches proches ne se départagent pas au hasard. */
  it("préfère l'e-mail au téléphone, et le téléphone au nom", () => {
    const homonym: ContactLike = {
      id: "contact-other",
      name: "Chantier Naval du Golfe",
      company: null,
      phone: null,
      email: null,
    };
    const match = matchSupplierContact(
      supplier({ name: "Chantier Naval du Golfe", email: "contact@cn-golfe.fr" }),
      [homonym, YARD],
    );
    expect(match).toEqual({ contactId: YARD.id, key: "email" });
  });
});

describe("ce que « créer la fiche » ouvre", () => {
  it("porte tout ce qui est écrit sur la page", () => {
    const draft = contactDraftFromSupplier(
      supplier({
        name: "Marc Le Gall",
        company: "Voilerie du Ponant",
        phone: "02 40 11 22 33",
        email: "atelier@voilerie-ponant.fr",
        address: "3 quai des Voiliers, 44000 Nantes",
      }),
    );
    expect(draft).toEqual({
      name: "Marc Le Gall",
      company: "Voilerie du Ponant",
      phone: "02 40 11 22 33",
      email: "atelier@voilerie-ponant.fr",
      address: "3 quai des Voiliers, 44000 Nantes",
    });
  });

  it("n'écrit pas deux fois le même nom quand la société *est* le prestataire", () => {
    const draft = contactDraftFromSupplier(
      supplier({ name: null, company: "SARL Chantier Naval du Golfe" }),
    );
    expect(draft.name).toBe("SARL Chantier Naval du Golfe");
    expect(draft.company).toBe("");
  });

  it("ne s'affiche que lorsqu'il y a quelque chose à montrer", () => {
    expect(hasSupplierDetails(null)).toBe(false);
    expect(hasSupplierDetails(EMPTY_SUPPLIER)).toBe(false);
    // Une adresse seule ne nomme personne : rien à proposer.
    expect(hasSupplierDetails(supplier({ address: "44000 Nantes" }))).toBe(false);
    expect(hasSupplierDetails(supplier({ phone: "02 40 11 22 33" }))).toBe(true);
    expect(supplierDisplayName(supplier({ company: "Voilerie du Ponant" }))).toBe(
      "Voilerie du Ponant",
    );
  });
});
