import { describe, expect, it } from "vitest";

import {
  buildDatabaseRow,
  createMatcher,
  descriptorOf,
  IMPORT_NAME_MAX,
  rejectionReason,
  rememberRow,
  type ImportCatalog,
  type ImportEntity,
  type ImportMatcher,
  type ImportRow,
} from "@/lib/import/entities";
import { applyDefaults, applyMapping, guessMapping, missingRequired } from "@/lib/import/mapping";
import { parseTable } from "@/lib/import/parse";

/**
 * The two lists a spreadsheet cannot name by id (E12-4): the checklist points already done,
 * and the engine hour readings. A file says « Vidange bâbord », never
 * `3f2c…`, so everything here is about turning a person's words into the right row — or
 * refusing the line and saying why, which is the only honest alternative.
 */

const OIL = "11111111-1111-4111-8111-000000000001";
const ANODES = "11111111-1111-4111-8111-000000000002";
const FLARES = "11111111-1111-4111-8111-000000000003";
const PORT = "22222222-2222-4222-8222-000000000001";
const STARBOARD = "22222222-2222-4222-8222-000000000002";

const BOAT: ImportCatalog = {
  items: [
    { id: OIL, label: "Vidange huile moteur — Bâbord", intervalHours: 250 },
    { id: ANODES, label: "Anodes de safran", intervalHours: null },
    { id: FLARES, label: "Fusées de détresse", intervalHours: null },
  ],
  engines: [
    { id: PORT, label: "Moteur bâbord", position: "port" },
    { id: STARBOARD, label: "Moteur tribord", position: "starboard" },
  ],
  readings: [
    { engineId: PORT, readAt: "2026-01-10", hours: 1000 },
    { engineId: PORT, readAt: "2026-04-01", hours: 1180 },
  ],
};

function row(values: Partial<Record<string, string>>): ImportRow {
  return values as ImportRow;
}

/** A fresh matcher per test: it takes in the lines it accepts, so it must never be shared. */
function matcher(catalog: ImportCatalog = BOAT): ImportMatcher {
  return createMatcher(catalog);
}

/** Reads a whole file the way the preview and the write do: in order, remembering as it goes. */
function readFile(entity: ImportEntity, rows: ImportRow[], catalog: ImportCatalog = BOAT) {
  const match = matcher(catalog);
  return rows.map((values) => {
    const reason = rejectionReason(entity, values, match);
    if (!reason) rememberRow(entity, values, match);
    return reason;
  });
}

describe("a checklist point is found by its name", () => {
  it("ignores accents and case, as the column headers already do", () => {
    const match = matcher();
    expect(
      rejectionReason(
        "completions",
        row({ name: "VIDANGE HUILE MOTEUR — BABORD", date: "14/06/2026", hours: "1250" }),
        match,
      ),
    ).toBeNull();
  });

  it("refuses a name the boat does not carry rather than picking a neighbour", () => {
    const match = matcher();
    expect(
      rejectionReason("completions", row({ name: "Vidange", date: "14/06/2026" }), match),
    ).toBe("import.errors.unknownItem");
  });

  it("refuses a name two points share, instead of choosing for the person", () => {
    const twins: ImportCatalog = {
      items: [
        { id: OIL, label: "Anodes", intervalHours: null },
        { id: ANODES, label: "Anodes", intervalHours: null },
      ],
    };
    expect(
      rejectionReason("completions", row({ name: "Anodes", date: "14/06/2026" }), matcher(twins)),
    ).toBe("import.errors.ambiguousItem");
  });

  // Without a catalog nothing can be resolved: refusing is the only safe answer, and it is
  // what a caller that forgot to load the boat's points would get.
  it("refuses everything when the boat has not been read", () => {
    expect(rejectionReason("completions", row({ name: "Anodes", date: "14/06/2026" }))).toBe(
      "import.errors.unknownItem",
    );
  });

  /**
   * A point's label may run to 160 characters, while every list cuts its subject to
   * IMPORT_NAME_MAX before it reaches a key or a column. Both forms are indexed, so a long
   * point is found rather than refused as unknown for a reason nobody can act on — and, above
   * all, the preview and the write agree, instead of accepting a line the write cannot place.
   */
  it("finds a point whose label is longer than the name the engine keeps", () => {
    const long = `Vidange huile moteur ${"et contrôle du niveau à froid ".repeat(4)}— Bâbord`;
    expect(long.length).toBeGreaterThan(IMPORT_NAME_MAX);
    const catalog: ImportCatalog = { items: [{ id: OIL, label: long, intervalHours: null }] };
    const match = matcher(catalog);

    expect(
      rejectionReason("completions", row({ name: long, date: "14/06/2026" }), match),
    ).toBeNull();
    expect(
      descriptorOf("completions").naturalKey(
        { name: long.slice(0, IMPORT_NAME_MAX), date: "14/06/2026" },
        match,
      ),
    ).not.toBe("");
    expect(
      buildDatabaseRow("completions", row({ name: long, date: "14/06/2026" }), {
        id: "id",
        boatId: "boat",
        userId: null,
        isNew: true,
        categoryId: null,
        contactId: () => null,
        match,
      }).checklist_item_id,
    ).toBe(OIL);
  });

  it("writes the resolved point, never the wording", () => {
    const built = buildDatabaseRow(
      "completions",
      row({ name: "vidange huile moteur — babord", date: "14/06/2026", hours: "1250" }),
      {
        id: "id",
        boatId: "boat",
        userId: "user",
        isNew: true,
        categoryId: null,
        contactId: () => null,
        match: matcher(),
      },
    );
    expect(built.checklist_item_id).toBe(OIL);
    expect(built.completed_at).toBe("2026-06-14");
  });
});

describe("what a completion cannot do without", () => {
  const base = { name: "Anodes de safran" };

  it("needs a date: undated it has no place in the history and no next deadline", () => {
    const match = matcher();
    expect(rejectionReason("completions", row({ ...base, date: "" }), match)).toBe(
      "import.errors.noDate",
    );
    expect(rejectionReason("completions", row({ ...base, date: "hier" }), match)).toBe(
      "import.errors.badDate",
    );
  });

  it("refuses a date in the future, which the database refuses too (D17)", () => {
    expect(rejectionReason("completions", row({ ...base, date: "01/01/2099" }), matcher())).toBe(
      "import.errors.futureDate",
    );
  });

  /**
   * `check_completion_hours` (0003) raises `engine_hours_required` on a point that carries
   * an hour interval. One line without hours would take the whole batch down, so it is refused
   * here, named, and listed for the person.
   */
  it("demands the engine hours exactly where the database demands them", () => {
    const match = matcher();
    expect(
      rejectionReason(
        "completions",
        row({ name: BOAT.items![0]!.label, date: "14/06/2026" }),
        match,
      ),
    ).toBe("import.errors.noEngineHours");
    expect(rejectionReason("completions", row({ ...base, date: "14/06/2026" }), match)).toBeNull();
  });

  it("refuses unreadable hours, and accepts a French comma", () => {
    const match = matcher();
    const point = BOAT.items![0]!.label;
    expect(
      rejectionReason(
        "completions",
        row({ name: point, date: "14/06/2026", hours: "plein" }),
        match,
      ),
    ).toBe("import.errors.badHours");
    expect(
      rejectionReason(
        "completions",
        row({ name: point, date: "14/06/2026", hours: "1 250,5" }),
        match,
      ),
    ).toBeNull();
  });

  // D11: the date printed on the object wins over the interval; the constraint added by 0004
  // demands it be later than the completion.
  it("refuses a « valide jusqu'au » that is not after the completion", () => {
    const match = matcher();
    expect(
      rejectionReason(
        "completions",
        row({ name: "Fusées de détresse", date: "14/06/2026", nextDate: "14/06/2024" }),
        match,
      ),
    ).toBe("import.errors.badDueDate");
    expect(
      rejectionReason(
        "completions",
        row({ name: "Fusées de détresse", date: "14/06/2026", nextDate: "14/06/2029" }),
        match,
      ),
    ).toBeNull();
  });

  it("leaves who did it as written, and never claims it was the importer", () => {
    const built = buildDatabaseRow(
      "completions",
      row({ name: "Anodes de safran", date: "14/06/2026", by: "Xavier" }),
      {
        id: "id",
        boatId: "boat",
        userId: "the-importer",
        isNew: true,
        categoryId: null,
        contactId: () => null,
        match: matcher(),
      },
    );
    expect(built.completed_by_name).toBe("Xavier");
    expect(built.completed_by).toBeNull();
    expect(built.created_by).toBe("the-importer");
  });
});

describe("a completion is recognised by its point and its day", () => {
  it("keeps two dates of the same point apart", () => {
    const match = matcher();
    const completions = descriptorOf("completions");
    const june = completions.naturalKey(
      row({ name: "Anodes de safran", date: "14/06/2026" }),
      match,
    );
    const october = completions.naturalKey(
      row({ name: "Anodes de safran", date: "02/10/2026" }),
      match,
    );
    expect(june).not.toBe(october);
  });

  it("matches two spellings of the same point on the same day", () => {
    const match = matcher();
    const completions = descriptorOf("completions");
    expect(
      completions.naturalKey(row({ name: "ANODES DE SAFRAN", date: "14/06/2026" }), match),
    ).toBe(completions.naturalKey(row({ name: "anodes de safran", date: "2026-06-14" }), match));
  });

  it("finds the row already in the database through the same key", () => {
    const completions = descriptorOf("completions");
    const fromFile = completions.naturalKey(
      row({ name: "Anodes de safran", date: "14/06/2026" }),
      matcher(),
    );
    const fromDatabase = completions.existingKey({
      id: "x",
      checklist_item_id: ANODES,
      completed_at: "2026-06-14",
    });
    expect(fromDatabase).toBe(fromFile);
  });

  // Neither table carries `needs_review` — 0001 gave it to `maintenance_logs` and `purchases`
  // only. Flagging these rows would have failed on the first real file.
  it("does not try to flag rows the tables cannot flag", () => {
    expect(descriptorOf("completions").needsReview).toBeUndefined();
    expect(descriptorOf("readings").needsReview).toBeUndefined();
  });
});

describe("an engine is found by its name, and by its side", () => {
  it("reads « bâbord » as the port engine when only one engine holds that side", () => {
    const match = matcher();
    expect(
      rejectionReason(
        "readings",
        row({ name: "Bâbord", date: "14/06/2026", hours: "1250" }),
        match,
      ),
    ).toBeNull();
    expect(match.engine("BB")).toEqual({ id: PORT });
    expect(match.engine("tribord")).toEqual({ id: STARBOARD });
  });

  it("never lets a side alias win over a label someone actually wrote", () => {
    const odd: ImportCatalog = {
      engines: [
        { id: PORT, label: "Tribord", position: "port" },
        { id: STARBOARD, label: "Yanmar 2", position: "starboard" },
      ],
    };
    // « Tribord » is the *label* of the port engine here: the label wins, the alias does not.
    expect(matcher(odd).engine("tribord")).toEqual({ id: PORT });
  });

  it("drops the side aliases when two engines share a side", () => {
    const twins: ImportCatalog = {
      engines: [
        { id: PORT, label: "Moteur avant", position: "port" },
        { id: STARBOARD, label: "Moteur arrière", position: "port" },
      ],
    };
    expect(matcher(twins).engine("bâbord")).toBeNull();
  });

  it("refuses an engine the boat does not have", () => {
    expect(
      rejectionReason(
        "readings",
        row({ name: "Moteur central", date: "14/06/2026", hours: "1250" }),
        matcher(),
      ),
    ).toBe("import.errors.unknownEngine");
  });
});

describe("the counter only goes up", () => {
  const port = { name: "Moteur bâbord" };

  it("accepts a reading above what the boat already knows for that day", () => {
    expect(
      rejectionReason("readings", row({ ...port, date: "14/06/2026", hours: "1250" }), matcher()),
    ).toBeNull();
  });

  /**
   * D12: a counter that really was replaced is declared on the engine's own screen, where the
   * dialog offers « le compteur a été remplacé » and stamps `counter_reset_at` — which
   * neutralises every hour deadline older than it. A spreadsheet cannot make that call, and
   * nobody is watching a warning while 300 lines go in, so the line is refused and listed.
   */
  it("refuses a value below a reading already dated before it", () => {
    expect(
      rejectionReason("readings", row({ ...port, date: "14/06/2026", hours: "900" }), matcher()),
    ).toBe("import.errors.hoursBackwards");
  });

  it("accepts older history below today's counter: it is not going backwards, it is earlier", () => {
    // 800 h in February sits between the 1000 h of January… no: it is below them, and that is
    // the point of comparing against readings *dated before* the line, not against the latest.
    expect(
      rejectionReason("readings", row({ ...port, date: "02/01/2026", hours: "800" }), matcher()),
    ).toBeNull();
  });

  it("catches a sheet that contradicts itself, not only the boat", () => {
    const reasons = readFile("readings", [
      row({ name: "Moteur tribord", date: "10/01/2026", hours: "400" }),
      row({ name: "Moteur tribord", date: "10/02/2026", hours: "460" }),
      // 46 h typed instead of 460: below line 2, and the boat knows nothing of this engine.
      row({ name: "Moteur tribord", date: "10/03/2026", hours: "46" }),
      row({ name: "Moteur tribord", date: "10/04/2026", hours: "520" }),
    ]);
    expect(reasons).toEqual([null, null, "import.errors.hoursBackwards", null]);
  });

  it("needs the hours and the date, and refuses a reading dated tomorrow", () => {
    const match = matcher();
    expect(rejectionReason("readings", row({ ...port, date: "14/06/2026" }), match)).toBe(
      "import.errors.noHours",
    );
    expect(rejectionReason("readings", row({ ...port, hours: "1250", date: "" }), match)).toBe(
      "import.errors.noDate",
    );
    expect(
      rejectionReason("readings", row({ ...port, hours: "1250", date: "01/01/2099" }), match),
    ).toBe("import.errors.futureDate");
  });

  it("refuses a counter no engine ever reaches", () => {
    expect(
      rejectionReason("readings", row({ ...port, date: "14/06/2026", hours: "999999" }), matcher()),
    ).toBe("import.errors.badHours");
  });
});

describe("a reading is one value per engine and per day", () => {
  const readings = descriptorOf("readings");

  it("reads the same key from the file and from the database", () => {
    const fromFile = readings.naturalKey(
      row({ name: "Moteur bâbord", date: "14/06/2026", hours: "1250" }),
      matcher(),
    );
    expect(
      readings.existingKey({
        id: "x",
        engine_id: PORT,
        read_at: "2026-06-14",
        maintenance_log_id: null,
        checklist_completion_id: null,
      }),
    ).toBe(fromFile);
  });

  /**
   * D5 / 0004 §9: a reading carried by an intervention is parked when the intervention goes to
   * the trash and rebuilt when it comes back. It belongs to that intervention, so an import
   * must never take it over — it stays unmatched and the imported line lives beside it.
   */
  it("never takes over a reading that belongs to an intervention or to a completion", () => {
    expect(
      readings.existingKey({
        id: "x",
        engine_id: PORT,
        read_at: "2026-06-14",
        maintenance_log_id: "some-log",
        checklist_completion_id: null,
      }),
    ).toBe("");
    expect(
      readings.existingKey({
        id: "x",
        engine_id: PORT,
        read_at: "2026-06-14",
        maintenance_log_id: null,
        checklist_completion_id: "some-completion",
      }),
    ).toBe("");
  });

  it("stamps the reading as coming from an import", () => {
    const built = buildDatabaseRow(
      "readings",
      row({ name: "Bâbord", date: "14/06/2026", hours: "1 250,54" }),
      {
        id: "id",
        boatId: "boat",
        userId: "user",
        isNew: true,
        categoryId: null,
        contactId: () => null,
        match: matcher(),
      },
    );
    expect(built.source).toBe("import");
    expect(built.engine_id).toBe(PORT);
    // `numeric(8,1)`: the tenth is what the column keeps.
    expect(built.hours).toBe(1250.5);
  });
});

describe("a real sheet lands on the right fields", () => {
  it("maps a logbook of hour readings without a single choice to make", () => {
    const readings = descriptorOf("readings");
    const table = parseTable(
      [
        "Moteur;Relevé le;Heures;Commentaire",
        "Moteur bâbord;10/01/2026;1000;Départ Lorient",
        "Moteur tribord;10/01/2026;980;",
      ].join("\r\n"),
    );
    const mapping = guessMapping(table.headers, readings.fields);
    const mapped = table.rows.map((cells) => applyMapping(cells, readings.fields, mapping));

    expect(mapped[0]).toMatchObject({
      name: "Moteur bâbord",
      date: "10/01/2026",
      hours: "1000",
      note: "Départ Lorient",
    });
    expect(mapped.every((line) => rejectionReason("readings", line, matcher()) === null)).toBe(
      true,
    );
  });

  /**
   * A logbook of one point names it in its title, not on every line: « Point de checklist »
   * accepts a value chosen once for the whole file, like the trade of a `.vcf` contact.
   */
  it("takes the point from a value given once for the whole file", () => {
    const completions = descriptorOf("completions");
    const table = parseTable(["Date;Heures", "12/03/2025;900", "14/06/2026;1250"].join("\r\n"));
    const mapping = guessMapping(table.headers, completions.fields);
    const defaults = { name: "Vidange huile moteur — Bâbord" };

    expect(missingRequired(completions.fields, mapping, defaults)).toEqual([]);
    expect(missingRequired(completions.fields, mapping, {})).toEqual(["Point de checklist"]);

    const mapped = table.rows.map((cells) =>
      applyDefaults(applyMapping(cells, completions.fields, mapping), completions.fields, defaults),
    );
    expect(readFile("completions", mapped)).toEqual([null, null]);
  });
});
