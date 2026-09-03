import { describe, expect, it } from "vitest";

import { isListedSpecialty, specialtyOptions } from "@/components/contacts/specialties";
import fr from "@/messages/fr.json";
import { CONTACT_SPECIALTIES } from "@/lib/schemas/contacts";

/**
 * The trades offered on a screen (D44). Two screens ask for one — the contact form and the
 * import's « valeurs pour tout le fichier » — and both read this list, so a trade named on one
 * is a chip on the other. « Autre » is the escape hatch, never one of the options here.
 */
const label = (key: string) => (fr.contacts.specialties as Record<string, string>)[key] ?? key;

describe("the trades a boat can choose from", () => {
  it("offers the built-ins, « Autre » excluded: it names a new one rather than being one", () => {
    const options = specialtyOptions(label);
    expect(options).toContain("Chantier carénage");
    expect(options).toContain("Motoriste");
    expect(options).not.toContain(label("other"));
    expect(options).toHaveLength(CONTACT_SPECIALTIES.length - 1);
  });

  it("adds the trades this boat already uses, sorted, after the built-ins", () => {
    const options = specialtyOptions(label, ["Peintre", "Accastilleur"]);
    const extra = options.slice(CONTACT_SPECIALTIES.length - 1);
    expect(extra).toEqual(["Accastilleur", "Peintre"]);
  });

  it("never offers the same trade twice, whatever its case or accents", () => {
    const options = specialtyOptions(label, ["MOTORISTE", "motoriste", "Chantier Carenage"]);
    expect(options.filter((o) => o.toLowerCase() === "motoriste")).toHaveLength(1);
    // « Chantier Carenage » is « Chantier carénage » written without its accent: not a new trade.
    expect(options).toHaveLength(CONTACT_SPECIALTIES.length - 1);
  });

  it("ignores blanks, so an empty cell never becomes a chip", () => {
    expect(specialtyOptions(label, ["", "   "])).toHaveLength(CONTACT_SPECIALTIES.length - 1);
  });

  it("knows whether a value is one of the chips or a name being typed", () => {
    expect(isListedSpecialty("Motoriste", label)).toBe(true);
    expect(isListedSpecialty("Accastilleur", label)).toBe(false);
    expect(isListedSpecialty("Accastilleur", label, ["Accastilleur"])).toBe(true);
  });
});
