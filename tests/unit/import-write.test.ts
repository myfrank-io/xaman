import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

import {
  buildDatabaseRow,
  descriptorOf,
  IMPORT_ENTITIES,
  type ImportEntity,
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
};

describeWithDb("every import payload is writable", () => {
  let client: Client;
  let boatId: string;

  beforeAll(async () => {
    client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    const { rows } = await client.query<{ id: string }>("select id from public.boats limit 1");
    boatId = rows[0]?.id ?? "";
  });

  afterAll(async () => {
    await client?.end();
  });

  it("has a seeded boat to write against", () => {
    expect(boatId, "the test database needs at least one boat").not.toBe("");
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
      });
    expect(build("logs").needs_review).toBe(true);
    expect(build("purchases").needs_review).toBe(true);
    expect(build("contacts").needs_review).toBeUndefined();
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
