import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

import {
  buildDatabaseRow,
  createMatcher,
  descriptorOf,
  IMPORT_ENTITIES,
  type ImportEntity,
  type ImportMatcher,
  type ImportRow,
} from "@/lib/import/entities";

/**
 * The import writes what it says it writes.
 *
 * TypeScript cannot check a column name that only exists in Postgres: `buildDatabaseRow`
 * returns a plain object and the Supabase client takes it as `never`. This suite closes that
 * hole by inserting the real payload into the real table, inside a transaction that is rolled
 * back. It is how `maintenance_logs.next_due_at` was caught — a column migration 0004 had
 * removed on purpose, offered by the import, and destined to fail on the first real file in
 * production and nowhere else.
 *
 * Needs a database, like `rls.test.ts`: DATABASE_URL, or the suite skips itself.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDb = DATABASE_URL ? describe : describe.skip;

/** One filled-in row per list, using the same wording a real French file would carry. */
const SAMPLES: Record<ImportEntity, ImportRow> = {
  logs: {
    name: "Vidange moteur bâbord",
    date: "14/06/2026",
    category: "Moteurs",
    provider: "Motoriste Yanmar",
    cost: "1 348,50",
    reference: "F-2026-0142",
    notes: "Filtres et joints changés.",
  },
  purchases: {
    name: "Filtre à huile Volvo",
    date: "02/06/2026",
    amount: "42,90",
    kind: "Pièce",
    quantity: "2",
    supplier: "Accastillage Diffusion",
    category: "Moteurs",
    reference: "AD-88213",
    notes: "Deux filtres d'avance.",
  },
  contacts: {
    name: "Chantier Naval du Guip",
    specialty: "Chantier",
    company: "Le Guip",
    phone: "02 98 00 00 00",
    email: "contact@leguip.fr",
    address: "Brest",
    notes: "Cale sèche disponible en hiver.",
  },
  equipment: {
    name: "Guindeau",
    category: "Coque & Pont",
    brand: "Lofrans",
    model: "Tigres",
    serial: "LT-4471",
    quantity: "1",
    installedAt: "01/05/2020",
    notes: "",
  },
  parts: {
    name: "Filtre à huile Volvo",
    reference: "3847643",
    quantity: "2",
    minQuantity: "1",
    unit: "pc",
    location: "Coffre bâbord",
    category: "Moteurs",
    notes: "",
  },
  // The two lists matched by name (E12-4): `name` is filled in `beforeAll` with a checklist
  // point and an engine the test database really carries — that is the whole difficulty.
  completions: {
    name: "",
    date: "14/06/2026",
    hours: "1250",
    by: "Xavier",
    nextDate: "14/06/2029",
    note: "Huile 15W40, filtre neuf.",
  },
  readings: {
    name: "",
    date: "14/06/2026",
    hours: "1250,5",
    note: "Relevé au départ de Lorient.",
  },
};

describeWithDb("every import payload is writable", () => {
  let client: Client;
  let boatId: string;
  let itemLabel = "";
  let engineLabel = "";
  /** Built from the real checklist points, engines and readings of the boat under test. */
  let match: ImportMatcher;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    // A boat carrying a checklist point and an engine, so the two matched lists have a
    // subject; any boat otherwise, for the five lists that need none.
    const { rows } = await client.query<{ id: string }>(
      `select b.id from public.boats b
       order by (exists (select 1 from public.engines e where e.boat_id = b.id)
             and exists (select 1 from public.checklist_items i where i.boat_id = b.id)) desc,
                b.created_at
       limit 1`,
    );
    boatId = rows[0]?.id ?? "";

    const { rows: items } = await client.query<{
      id: string;
      label: string;
      interval_hours: number | null;
    }>("select id, label, interval_hours from public.checklist_items where boat_id = $1", [boatId]);
    const { rows: engines } = await client.query<{
      id: string;
      label: string;
      position: string;
    }>("select id, label, position from public.engines where boat_id = $1", [boatId]);
    const { rows: readings } = await client.query<{
      engine_id: string;
      read_at: Date;
      hours: string;
    }>("select engine_id, read_at, hours from public.engine_hour_readings where boat_id = $1", [
      boatId,
    ]);

    itemLabel = items[0]?.label ?? "";
    engineLabel = engines[0]?.label ?? "";
    SAMPLES.completions.name = itemLabel;
    SAMPLES.readings.name = engineLabel;

    match = createMatcher({
      items: items.map((item) => ({
        id: item.id,
        label: item.label,
        intervalHours: item.interval_hours,
      })),
      engines: engines.map((engine) => ({
        id: engine.id,
        label: engine.label,
        position: engine.position,
      })),
      readings: readings.map((reading) => ({
        engineId: reading.engine_id,
        readAt: reading.read_at.toISOString().slice(0, 10),
        hours: Number(reading.hours),
      })),
    });
  });

  afterAll(async () => {
    await client?.end();
  });

  it("has a seeded boat to write against", () => {
    expect(boatId, "the test database needs at least one boat").not.toBe("");
  });

  it("has a checklist point and an engine to attach the two matched lists to", () => {
    expect(itemLabel, "the test database needs a checklist item").not.toBe("");
    expect(engineLabel, "the test database needs an engine").not.toBe("");
  });

  for (const entity of IMPORT_ENTITIES) {
    it(`writes ${entity} with column names the table actually has`, async () => {
      const descriptor = descriptorOf(entity);
      const payload = buildDatabaseRow(entity, SAMPLES[entity], {
        id: crypto.randomUUID(),
        boatId,
        userId: null,
        isNew: true,
        categoryId: null,
        contactId: () => null,
        match,
      });
      const columns = Object.keys(payload);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");

      await client.query("begin");
      try {
        await expect(
          client.query(
            `insert into public.${descriptor.table} (${columns.join(", ")}) values (${placeholders})`,
            Object.values(payload),
          ),
          `${entity} → public.${descriptor.table}`,
        ).resolves.toBeDefined();
      } finally {
        await client.query("rollback");
      }
    });
  }

  it("writes the same row twice as one row: a re-import corrects, it does not duplicate", async () => {
    const id = crypto.randomUUID();
    const context = {
      id,
      boatId,
      userId: null,
      categoryId: null,
      contactId: () => null,
    };
    const created = buildDatabaseRow("logs", SAMPLES.logs, { ...context, isNew: true });
    const updated = buildDatabaseRow(
      "logs",
      { ...SAMPLES.logs, notes: "Corrigé après relecture." },
      { ...context, isNew: false },
    );

    await client.query("begin");
    try {
      const insert = (row: Record<string, unknown>, onConflict: string) => {
        const columns = Object.keys(row);
        return client.query(
          `insert into public.maintenance_logs (${columns.join(", ")})
           values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) ${onConflict}`,
          Object.values(row),
        );
      };
      await insert(created, "");
      await insert(updated, "on conflict (id) do update set notes = excluded.notes");

      const { rows } = await client.query<{ count: string; notes: string }>(
        "select count(*)::text as count, max(notes) as notes from public.maintenance_logs where id = $1",
        [id],
      );
      expect(rows[0]?.count).toBe("1");
      expect(rows[0]?.notes).toContain("Corrigé après relecture.");
    } finally {
      await client.query("rollback");
    }
  });

  it("marks the two dated lists for review and leaves the reference lists alone", () => {
    const build = (entity: ImportEntity) =>
      buildDatabaseRow(entity, SAMPLES[entity], {
        id: crypto.randomUUID(),
        boatId,
        userId: null,
        isNew: true,
        categoryId: null,
        contactId: () => null,
        match,
      });
    expect(build("logs").needs_review).toBe(true);
    expect(build("purchases").needs_review).toBe(true);
    expect(build("contacts").needs_review).toBeUndefined();
    // `checklist_completions` and `engine_hour_readings` have no `needs_review` column at all
    // (0001, and 0004 never added one): flagging them would fail on the very first file.
    expect(build("completions").needs_review).toBeUndefined();
    expect(build("readings").needs_review).toBeUndefined();
  });

  it("re-imports a completion of the same point on the same day as one row", async () => {
    const context = {
      boatId,
      userId: null,
      categoryId: null,
      contactId: () => null,
      match,
    };
    const id = crypto.randomUUID();
    const created = buildDatabaseRow("completions", SAMPLES.completions, {
      ...context,
      id,
      isNew: true,
    });
    // The same sheet, corrected and imported again: the natural key finds the row already there.
    const descriptor = descriptorOf("completions");
    const again = { ...SAMPLES.completions, note: "Corrigé après relecture." };
    const updated = buildDatabaseRow("completions", again, { ...context, id, isNew: false });

    await client.query("begin");
    try {
      const insert = (row: Record<string, unknown>, onConflict: string) => {
        const columns = Object.keys(row);
        return client.query(
          `insert into public.checklist_completions (${columns.join(", ")})
           values (${columns.map((_, i) => `$${i + 1}`).join(", ")}) ${onConflict}`,
          Object.values(row),
        );
      };
      await insert(created, "");
      await insert(updated, "on conflict (id) do update set note = excluded.note");

      const { rows } = await client.query<Record<string, unknown>>(
        "select id, checklist_item_id, completed_at, note from public.checklist_completions where id = $1",
        [id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.note).toBe("Corrigé après relecture.");
      // The key read back from the database is the key the file produces: the second import
      // recognises the first instead of writing a twin.
      expect(descriptor.existingKey(rows[0] ?? {})).toBe(
        descriptor.naturalKey(SAMPLES.completions, match),
      );
    } finally {
      await client.query("rollback");
    }
  });

  it("moves the engine counter through the completion, without a second import path", async () => {
    const payload = buildDatabaseRow("completions", SAMPLES.completions, {
      id: crypto.randomUUID(),
      boatId,
      userId: null,
      isNew: true,
      categoryId: null,
      contactId: () => null,
      match,
    });
    const columns = Object.keys(payload);

    await client.query("begin");
    try {
      await client.query(
        `insert into public.checklist_completions (${columns.join(", ")})
         values (${columns.map((_, i) => `$${i + 1}`).join(", ")})`,
        Object.values(payload),
      );
      // `sync_engine_hours_from_completion` (0003) derives the reading: the import writes one
      // table, the database keeps the counter in step.
      const { rows } = await client.query<{ hours: string; source: string }>(
        "select hours, source from public.engine_hour_readings where checklist_completion_id = $1",
        [payload.id],
      );
      expect(rows[0]?.hours).toBe("1250.0");
      expect(rows[0]?.source).toBe("checklist");
    } finally {
      await client.query("rollback");
    }
  });

  it("finds a reading already on the boat through the same key, and never a derived one", async () => {
    const descriptor = descriptorOf("readings");
    const { rows } = await client.query<Record<string, unknown>>(
      `select id, engine_id, read_at, maintenance_log_id, checklist_completion_id
         from public.engine_hour_readings where boat_id = $1`,
      [boatId],
    );
    // Everything the dev seed carries comes from an intervention: owned, so never matched.
    for (const row of rows.filter((row) => row.maintenance_log_id ?? row.checklist_completion_id)) {
      expect(descriptor.existingKey(row)).toBe("");
    }

    const payload = buildDatabaseRow("readings", SAMPLES.readings, {
      id: crypto.randomUUID(),
      boatId,
      userId: null,
      isNew: true,
      categoryId: null,
      contactId: () => null,
      match,
    });
    const columns = Object.keys(payload);
    await client.query("begin");
    try {
      await client.query(
        `insert into public.engine_hour_readings (${columns.join(", ")})
         values (${columns.map((_, i) => `$${i + 1}`).join(", ")})`,
        Object.values(payload),
      );
      const { rows: written } = await client.query<Record<string, unknown>>(
        `select id, engine_id, read_at, maintenance_log_id, checklist_completion_id
           from public.engine_hour_readings where id = $1`,
        [payload.id],
      );
      expect(descriptor.existingKey(written[0] ?? {})).toBe(
        descriptor.naturalKey(SAMPLES.readings, match),
      );
    } finally {
      await client.query("rollback");
    }
  });

  it("copies an unmatched provider into the notes instead of dropping it", () => {
    const row = buildDatabaseRow("logs", SAMPLES.logs, {
      id: crypto.randomUUID(),
      boatId,
      userId: null,
      isNew: true,
      categoryId: null,
      contactId: () => null,
    });
    expect(row.contact_id).toBeNull();
    expect(String(row.notes)).toContain("Motoriste Yanmar");
  });

  it("links a provider that matches a contact, and leaves the notes clean", () => {
    const row = buildDatabaseRow("logs", SAMPLES.logs, {
      id: crypto.randomUUID(),
      boatId,
      userId: null,
      isNew: true,
      categoryId: null,
      contactId: () => "11111111-1111-4111-8111-111111111111",
    });
    expect(row.contact_id).toBe("11111111-1111-4111-8111-111111111111");
    expect(String(row.notes)).not.toContain("Prestataire :");
  });
});
