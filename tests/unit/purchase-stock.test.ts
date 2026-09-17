/**
 * Buying a part is a purchase, and a purchase of a part is stock coming in (D143, `0045`).
 *
 * Runs against a Postgres that has the migrations + supabase/seed.sql applied, like
 * `checklist-journal.test.ts`: DATABASE_URL, or the suite skips itself. Every case runs inside a
 * transaction that is rolled back, impersonating a user exactly like PostgREST does.
 *
 * What is proven here is the invariant « À racheter » now rests on:
 *
 *   the stock holds what the purchases brought in, and gives it back the moment one is trashed —
 *   whoever wrote it, and without anyone typing the quantity twice.
 */
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;
const describeWithDb = DATABASE_URL ? describe : describe.skip;

type User = { id: string; email: string };

const OWNER: User = { id: "00000000-0000-0000-0000-000000000011", email: "owner@test.xaman" };
const EDITOR: User = { id: "00000000-0000-0000-0000-000000000012", email: "editor@test.xaman" };
const PRO: User = { id: "00000000-0000-0000-0000-000000000013", email: "pro@test.xaman" };

const BOAT = "00000000-0000-0000-0000-00000000b001";
const BOAT2 = "00000000-0000-0000-0000-00000000b002";
const CATEGORY = "00000000-0000-0000-0000-00000000ca01";

/** Ids of this suite, kept away from the other files' (transactions are rolled back). */
const FILTER = "00000000-0000-0000-0000-0000000fa010";
const ANODE = "00000000-0000-0000-0000-0000000fa020";
const BUY = "00000000-0000-0000-0000-0000000fb010";

const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

afterAll(async () => {
  await pool.end();
});

/** One rolled-back transaction, as `user` (PostgREST's `set local role` + claims). */
async function as<T>(user: User, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" }),
    ]);
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

/** A part of the boat's locker: `quantity` in reserve, `minQuantity` wanted. */
async function plantPart(
  c: PoolClient,
  part: { id: string; name: string; quantity: number; minQuantity: number; boatId?: string },
) {
  await c.query(
    `insert into public.parts (id, boat_id, name, quantity, min_quantity, unit, category_id, created_by)
     values ($1, $2, $3, $4, $5, 'pc', $6, $7)`,
    [
      part.id,
      part.boatId ?? BOAT,
      part.name,
      part.quantity,
      part.minQuantity,
      part.boatId && part.boatId !== BOAT ? null : CATEGORY,
      OWNER.id,
    ],
  );
}

/** What « Racheté » writes: a purchase of `quantity` units of that part, today, no price. */
async function buyBack(
  c: PoolClient,
  user: User,
  buy: { id?: string; partId: string; quantity: number; boatId?: string },
) {
  await c.query(
    `insert into public.purchases
       (id, boat_id, purchased_at, kind, designation, quantity, part_id, category_id, created_by)
     values ($1, $2, current_date, 'part', 'Rachat', $3, $4, $5, $6)`,
    [buy.id ?? BUY, buy.boatId ?? BOAT, buy.quantity, buy.partId, CATEGORY, user.id],
  );
}

async function stockOf(c: PoolClient, partId: string): Promise<number> {
  const res = await c.query("select quantity from public.parts where id = $1", [partId]);
  return Number((res.rows[0] as { quantity: string }).quantity);
}

describeWithDb("a purchase of a part is stock coming in (0045)", () => {
  it("puts the units in the locker, and counts the line as counted today", async () => {
    const out = await as(OWNER, async (c) => {
      await plantPart(c, { id: FILTER, name: "Filtre à gazole", quantity: 0, minQuantity: 2 });
      await buyBack(c, OWNER, { partId: FILTER, quantity: 2 });
      const res = await c.query(
        "select quantity, checked_at = current_date as checked_today from public.parts where id = $1",
        [FILTER],
      );
      return res.rows[0] as { quantity: string; checked_today: boolean };
    });
    expect(Number(out.quantity)).toBe(2);
    expect(out.checked_today).toBe(true);
  });

  it("gives them back when the purchase goes to the trash, and again on restore", async () => {
    const out = await as(OWNER, async (c) => {
      await plantPart(c, { id: FILTER, name: "Filtre à gazole", quantity: 1, minQuantity: 3 });
      await buyBack(c, OWNER, { partId: FILTER, quantity: 2 });
      const bought = await stockOf(c, FILTER);
      await c.query("update public.purchases set deleted_at = now() where id = $1", [BUY]);
      const trashed = await stockOf(c, FILTER);
      await c.query("update public.purchases set deleted_at = null where id = $1", [BUY]);
      const restored = await stockOf(c, FILTER);
      return { bought, trashed, restored };
    });
    expect(out).toEqual({ bought: 3, trashed: 1, restored: 3 });
  });

  it("moves only the difference when the line is re-counted or re-pointed", async () => {
    const out = await as(OWNER, async (c) => {
      await plantPart(c, { id: FILTER, name: "Filtre à gazole", quantity: 0, minQuantity: 2 });
      await plantPart(c, { id: ANODE, name: "Anode", quantity: 1, minQuantity: 4 });
      await buyBack(c, OWNER, { partId: FILTER, quantity: 2 });
      await c.query("update public.purchases set quantity = 5 where id = $1", [BUY]);
      const recounted = await stockOf(c, FILTER);
      await c.query("update public.purchases set part_id = $2 where id = $1", [BUY, ANODE]);
      return { recounted, filter: await stockOf(c, FILTER), anode: await stockOf(c, ANODE) };
    });
    // 2 written, then 5: three more, not five more. Re-pointed: the filter gives its five back.
    expect(out).toEqual({ recounted: 5, filter: 0, anode: 6 });
  });

  it("leaves the stock alone when the purchase names no part", async () => {
    const stock = await as(OWNER, async (c) => {
      await plantPart(c, { id: FILTER, name: "Filtre à gazole", quantity: 2, minQuantity: 4 });
      await c.query(
        `insert into public.purchases (id, boat_id, purchased_at, kind, designation, quantity, created_by)
         values ($1, $2, current_date, 'service', 'Carénage', 3, $3)`,
        [BUY, BOAT, OWNER.id],
      );
      return stockOf(c, FILTER);
    });
    expect(stock).toBe(2);
  });

  it("refuses a part that belongs to another boat (rule 4)", async () => {
    const error = await as(OWNER, async (c) => {
      // Planted outside the policies: the point is the boat check, not who may write where.
      await c.query("reset role");
      await plantPart(c, {
        id: FILTER,
        name: "Filtre à gazole",
        quantity: 0,
        minQuantity: 2,
        boatId: BOAT2,
      });
      await c.query("set local role authenticated");
      return buyBack(c, OWNER, { partId: FILTER, quantity: 1 }).then(
        () => null,
        (caught: { message: string }) => caught.message,
      );
    });
    expect(error).toContain("part_boat_mismatch");
  });

  // Why the movement is the database's own (`security definer`, as `sync_log_completion` in
  // D140): it must land or not happen at all. `purchases_insert` and `parts_update` both read
  // `can_write_boat` today, so nothing is widened here — what is refused is refused before the
  // trigger — but the stock must never silently miss a movement should the two ever part ways.
  it("lands the stock of a purchase written by an editor, and refuses one from a pro", async () => {
    const byEditor = await as(EDITOR, async (c) => {
      await plantPart(c, { id: FILTER, name: "Filtre à gazole", quantity: 0, minQuantity: 2 });
      await buyBack(c, EDITOR, { partId: FILTER, quantity: 3 });
      return stockOf(c, FILTER);
    });
    expect(byEditor).toBe(3);

    const byPro = await as(PRO, async (c) => {
      const seeded = await c.query(
        "select id from public.parts where boat_id = $1 and deleted_at is null order by name limit 1",
        [BOAT],
      );
      const partId = (seeded.rows[0] as { id: string }).id;
      return buyBack(c, PRO, { partId, quantity: 3 }).then(
        () => null,
        (caught: { message: string }) => caught.message,
      );
    });
    // A pro records their own work, not the boat's spending (`purchases_insert`).
    expect(byPro).toContain("row-level security");
  });

  it("is not an API: neither the movement nor its trigger can be called by a signed-in user", async () => {
    const grants = await as(PRO, async (c) => {
      const res = await c.query(
        `select has_function_privilege('public.apply_stock_movement(uuid, numeric)', 'execute') as movement,
                has_function_privilege('public.apply_purchase_to_stock()', 'execute') as applier,
                has_function_privilege('public.purchases_check_part_boat()', 'execute') as boat_check`,
      );
      return res.rows[0];
    });
    expect(grants).toEqual({ movement: false, applier: false, boat_check: false });
  });
});

describeWithDb("« à racheter » means missing (D143)", () => {
  it("lists what is short and leaves alone what holds exactly its threshold", async () => {
    const titles = await as(OWNER, async (c) => {
      await plantPart(c, { id: FILTER, name: "Filtre à gazole", quantity: 2, minQuantity: 2 });
      await plantPart(c, { id: ANODE, name: "Anode", quantity: 1, minQuantity: 4 });
      const res = await c.query(
        "select title from public.boat_todo_queue($1, 50) where kind = 'part' and id in ($2, $3)",
        [BOAT, FILTER, ANODE],
      );
      return res.rows.map((r) => (r as { title: string }).title);
    });
    expect(titles).toEqual(["Anode"]);
  });

  it("drops a line out of the queue as soon as the purchase lands", async () => {
    const out = await as(OWNER, async (c) => {
      await plantPart(c, { id: ANODE, name: "Anode", quantity: 1, minQuantity: 4 });
      const listed = async () => {
        const res = await c.query(
          "select count(*)::int as n from public.boat_todo_queue($1, 50) where kind = 'part' and id = $2",
          [BOAT, ANODE],
        );
        return (res.rows[0] as { n: number }).n;
      };
      const before = await listed();
      await buyBack(c, OWNER, { partId: ANODE, quantity: 3 });
      return { before, after: await listed() };
    });
    expect(out).toEqual({ before: 1, after: 0 });
  });
});
