import { describe, expect, it } from "vitest";

import { toActivityRow } from "@/lib/queries/activity";

/**
 * Le fil du carnet (D132).
 *
 * La vue unit cinq tables ; cette fonction est la seule couche entre elle et une liste. Ce qu'on
 * vérifie ici est ce qu'une union SQL peut laisser passer et qu'un écran ne doit pas montrer :
 * une ligne sans titre, un genre qu'on ne connaît pas, un nom réduit à des espaces.
 */
const ROW = {
  kind: "completion",
  id: "00000000-0000-4000-8000-000000000001",
  happened_at: "2026-09-12",
  title: "Vidange huile + filtre à huile",
  who: "Xavier",
  category_name: "Moteurs",
  category_color: "#D97706",
  amount: null,
  hours: 1256,
};

describe("toActivityRow", () => {
  it("reads a fact of the carnet", () => {
    expect(toActivityRow(ROW)).toEqual({
      kind: "completion",
      id: ROW.id,
      happenedAt: "2026-09-12",
      title: "Vidange huile + filtre à huile",
      who: "Xavier",
      categoryName: "Moteurs",
      categoryColor: "#D97706",
      amount: null,
      hours: 1256,
    });
  });

  it("keeps the five kinds and nothing else", () => {
    for (const kind of ["completion", "log", "purchase", "reading", "haul_out"]) {
      expect(toActivityRow({ ...ROW, kind })?.kind).toBe(kind);
    }
    // Un genre inconnu ne se rend pas : l'écran n'a pas de mot pour lui.
    expect(toActivityRow({ ...ROW, kind: "trash" })).toBe(null);
    expect(toActivityRow({ ...ROW, kind: null })).toBe(null);
  });

  it("refuses a line an eye could not read", () => {
    expect(toActivityRow({ ...ROW, title: "   " })).toBe(null);
    expect(toActivityRow({ ...ROW, title: null })).toBe(null);
    expect(toActivityRow({ ...ROW, happened_at: null })).toBe(null);
    expect(toActivityRow({ ...ROW, id: null })).toBe(null);
  });

  it("says nobody rather than an empty name", () => {
    expect(toActivityRow({ ...ROW, who: "  " })?.who).toBe(null);
    expect(toActivityRow({ ...ROW, who: null })?.who).toBe(null);
    expect(toActivityRow({ ...ROW, who: "  Emmanuel " })?.who).toBe("Emmanuel");
  });
});
