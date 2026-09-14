import { describe, expect, it } from "vitest";

import { dueSentence, type DueInput } from "../../src/components/checklist/due-sentence";
import fr from "../../src/messages/fr.json";

function input(over: Partial<DueInput> = {}): DueInput {
  return {
    status: "soon",
    daysRemaining: 10,
    hoursRemaining: null,
    hasCounter: true,
    punctual: false,
    hasCompletion: true,
    ...over,
  };
}

/**
 * La phrase d'échéance (E20-1).
 *
 * L'ancienne ligne écrivait « dans 365 j » sur un point annuel. C'est exact et illisible : le
 * lecteur doit diviser par trente pour savoir s'il doit s'en occuper. Ces cas gardent les paliers
 * qui remplacent ce nombre par le mot qu'on emploie à bord.
 */
describe("quand une chose est à faire", () => {
  it("compte les jours tant qu'ils se comptent", () => {
    expect(dueSentence(input({ daysRemaining: 0 }))).toEqual({ key: "today", tone: "today" });
    expect(dueSentence(input({ daysRemaining: 1 }))).toEqual({ key: "tomorrow", tone: "soon" });
    expect(dueSentence(input({ daysRemaining: 8 }))).toEqual({
      key: "inDays",
      values: { count: 8 },
      tone: "soon",
    });
  });

  it("passe aux semaines, puis aux mois, puis aux ans", () => {
    expect(dueSentence(input({ daysRemaining: 21 }))).toMatchObject({
      key: "inWeeks",
      values: { count: 3 },
    });
    expect(dueSentence(input({ status: "ok", daysRemaining: 150 }))).toMatchObject({
      key: "inMonths",
      values: { count: 5 },
    });
    // Le cas qui a motivé la refonte : un point annuel ne se dit pas « dans 365 j ».
    expect(dueSentence(input({ status: "ok", daysRemaining: 365 }))).toMatchObject({
      key: "inYears",
      values: { count: 1 },
    });
  });

  it("dit le retard en toutes lettres, et l'urgence avec", () => {
    expect(dueSentence(input({ status: "overdue", daysRemaining: -79 }))).toEqual({
      key: "overdueDays",
      values: { count: 79 },
      tone: "overdue",
    });
    expect(
      dueSentence(input({ status: "overdue", daysRemaining: null, hoursRemaining: -12 })),
    ).toEqual({ key: "overdueHours", values: { count: 12 }, tone: "overdue" });
  });

  it("laisse les heures en heures", () => {
    // Un compteur ne se convertit pas en semaines : il tourne au rythme du moteur, pas du
    // calendrier. « Dans 3 semaines » serait un mensonge sur un bateau qui ne sort pas.
    expect(dueSentence(input({ daysRemaining: 300, hoursRemaining: 18 }))).toMatchObject({
      key: "inHours",
      values: { count: 18 },
    });
  });

  it("ne prétend pas connaître une échéance en heures sans compteur", () => {
    expect(
      dueSentence(input({ daysRemaining: null, hoursRemaining: 40, hasCounter: false })),
    ).toEqual({ key: "unknownCounter", tone: "calm" });
  });

  it("distingue ce qui n'a jamais été noté de ce qui se fait une seule fois", () => {
    expect(
      dueSentence(input({ status: "never", hasCompletion: false, daysRemaining: null })),
    ).toEqual({ key: "never", tone: "calm" });
    expect(dueSentence(input({ punctual: true, hasCompletion: true }))).toEqual({
      key: "punctual",
      tone: "calm",
    });
    expect(dueSentence(input({ punctual: true, hasCompletion: false }))).toEqual({
      key: "never",
      tone: "calm",
    });
  });

  it("ne rend jamais une clé que fr.json n'écrit pas (règle 7)", () => {
    const written = fr.checklist.due as Record<string, string>;
    const cases: DueInput[] = [
      input({ daysRemaining: 0 }),
      input({ daysRemaining: 1 }),
      input({ daysRemaining: 8 }),
      input({ daysRemaining: 21 }),
      input({ status: "ok", daysRemaining: 150 }),
      input({ status: "ok", daysRemaining: 365 }),
      input({ status: "overdue", daysRemaining: -3 }),
      input({ status: "overdue", daysRemaining: null, hoursRemaining: -3 }),
      input({ daysRemaining: 300, hoursRemaining: 18 }),
      input({ daysRemaining: null, hoursRemaining: 40, hasCounter: false }),
      input({ status: "never", hasCompletion: false, daysRemaining: null }),
      input({ punctual: true }),
    ];
    for (const one of cases) {
      const sentence = dueSentence(one);
      expect(written[sentence.key], sentence.key).toBeTruthy();
    }
    // Et l'inverse : une clé écrite que rien ne rend est une phrase morte dans le fichier.
    const produced = new Set(cases.map((one) => dueSentence(one).key));
    expect(Object.keys(written).filter((key) => !produced.has(key as never))).toEqual([]);
  });
});
