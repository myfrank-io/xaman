import { describe, expect, it } from "vitest";

import { csvField, toCsv } from "@/lib/export/csv";

describe("csv export", () => {
  it("quotes separators, quotes and line breaks, and writes numbers with a comma", () => {
    expect(csvField("Vidange ; filtre")).toBe('"Vidange ; filtre"');
    expect(csvField('Joint "torique"')).toBe('"Joint ""torique"""');
    expect(csvField("ligne 1\nligne 2")).toBe('"ligne 1\nligne 2"');
    expect(csvField(89.9)).toBe("89,9");
    expect(csvField(null)).toBe("");
  });

  it("neutralises formula injection", () => {
    expect(csvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvField("-5")).toBe("'-5");
  });

  it("writes a BOM, a header line and CRLF line endings", () => {
    const csv = toCsv(
      [{ date: "2026-03-06", title: "Vidange", cost: 620 }],
      [
        { header: "Date", value: (row) => row.date },
        { header: "Titre", value: (row) => row.title },
        { header: "Coût", value: (row) => row.cost },
      ],
    );
    expect(csv).toBe("﻿Date;Titre;Coût\r\n2026-03-06;Vidange;620\r\n");
  });
});
