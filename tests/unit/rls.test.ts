/**
 * RLS matrix tests (SPEC.md §4.3, DATA-MODEL.md §5, BACKLOG E1-6).
 *
 * Runs against a Postgres that has the migrations + supabase/seed.sql applied
 * (`supabase start && supabase db reset`, or the shim in tests/support for a vanilla Postgres).
 * Every case runs inside a transaction that is rolled back, impersonating a user exactly like
 * PostgREST does: `set local role authenticated` + `request.jwt.claims`.
 */
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

type User = { id: string; email: string };

const U = {
  admin: { id: "00000000-0000-0000-0000-000000000010", email: "admin@test.xaman" },
  owner: { id: "00000000-0000-0000-0000-000000000011", email: "owner@test.xaman" },
  editor: { id: "00000000-0000-0000-0000-000000000012", email: "editor@test.xaman" },
  pro: { id: "00000000-0000-0000-0000-000000000013", email: "pro@test.xaman" },
  viewer: { id: "00000000-0000-0000-0000-000000000014", email: "viewer@test.xaman" },
  stranger: { id: "00000000-0000-0000-0000-000000000015", email: "stranger@test.xaman" },
} satisfies Record<string, User>;
type Role = keyof typeof U;

const BOAT = "00000000-0000-0000-0000-00000000b001";
const BOAT2 = "00000000-0000-0000-0000-00000000b002";
const CATEGORY = "00000000-0000-0000-0000-00000000ca01";
const ENGINE = "00000000-0000-0000-0000-00000000e001";
const ITEM = "00000000-0000-0000-0000-000000003001";
const LOG_OWNER = "00000000-0000-0000-0000-000000002001";
const LOG_PRO = "00000000-0000-0000-0000-000000002002";
const INVITATION_TOKEN = "test-token-secret-000000000000000000000000001";

const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });

async function as<T>(user: User | null, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    if (user) {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" }),
      ]);
    } else {
      await client.query("set local role anon");
    }
    return await fn(client);
  } finally {
    await client.query("rollback").catch(() => undefined);
    client.release();
  }
}

type Outcome = { ok: true; rowCount: number } | { ok: false; code: string; message: string };

async function run(user: User | null, sql: string, params: unknown[] = []): Promise<Outcome> {
  return as(user, async (c) => {
    try {
      const res = await c.query(sql, params);
      return { ok: true, rowCount: res.rowCount ?? 0 };
    } catch (e) {
      const err = e as { code?: string; message: string };
      return { ok: false, code: err.code ?? "", message: err.message };
    }
  });
}

async function count(user: User | null, table: string, where = "true", params: unknown[] = []) {
  const out = await as(user, async (c) => {
    try {
      const res = await c.query(
        `select count(*)::int as n from public.${table} where ${where}`,
        params,
      );
      return Number(res.rows[0]?.n ?? 0);
    } catch {
      return -1; // permission denied (e.g. anon)
    }
  });
  return out;
}

const BUSINESS_TABLES = [
  "engines",
  "boat_categories",
  "equipment",
  "contacts",
  "haul_outs",
  "maintenance_logs",
  "checklist_items",
  "checklist_completions",
  "engine_hour_readings",
  "parts",
  "purchases",
  "attachments",
] as const;

const WRITE_ONLY_TABLES = [
  "engines",
  "boat_categories",
  "equipment",
  "contacts",
  "haul_outs",
  "parts",
  "purchases",
  "checklist_items",
] as const;

beforeAll(async () => {
  try {
    await pool.query("select 1");
  } catch (e) {
    throw new Error(
      `RLS tests need a database at DATABASE_URL (${DATABASE_URL}). Run \`supabase start && supabase db reset\` first. ${String(e)}`,
    );
  }
});

afterAll(async () => {
  await pool.end();
});

describe("read access (select)", () => {
  it.each(BUSINESS_TABLES)(
    "members of every role see %s of their boat, outsiders see nothing",
    async (table) => {
      for (const role of ["owner", "editor", "pro", "viewer", "admin"] as Role[]) {
        expect(
          await count(U[role], table, "boat_id = $1", [BOAT]),
          `${role} on ${table}`,
        ).toBeGreaterThan(0);
      }
      expect(await count(U.stranger, table, "boat_id = $1", [BOAT])).toBe(0);
      expect(await count(null, table)).toBe(-1);
    },
  );

  it("boats: members and admin see the boat; outsiders do not; tenant isolation holds", async () => {
    for (const role of ["owner", "editor", "pro", "viewer", "admin"] as Role[]) {
      expect(await count(U[role], "boats", "id = $1", [BOAT]), role).toBe(1);
    }
    expect(await count(U.stranger, "boats", "id = $1", [BOAT])).toBe(0);
    expect(await count(U.owner, "boats", "id = $1", [BOAT2])).toBe(0);
    expect(await count(U.owner, "maintenance_logs", "boat_id = $1", [BOAT2])).toBe(0);
    expect(await count(U.stranger, "boats", "id = $1", [BOAT2])).toBe(1);
  });

  it("boat_members: owner/editor/admin see the list, pro/viewer only their own row", async () => {
    expect(await count(U.owner, "boat_members", "boat_id = $1", [BOAT])).toBe(4);
    expect(await count(U.editor, "boat_members", "boat_id = $1", [BOAT])).toBe(4);
    expect(await count(U.admin, "boat_members", "boat_id = $1", [BOAT])).toBe(4);
    expect(await count(U.pro, "boat_members", "boat_id = $1", [BOAT])).toBe(1);
    expect(await count(U.viewer, "boat_members", "boat_id = $1", [BOAT])).toBe(1);
    expect(await count(U.stranger, "boat_members", "boat_id = $1", [BOAT])).toBe(0);
  });

  it("boat_invitations: only owners (and admin) see them; the token column is unreadable for everyone", async () => {
    expect(await count(U.owner, "boat_invitations", "boat_id = $1", [BOAT])).toBe(1);
    expect(await count(U.admin, "boat_invitations", "boat_id = $1", [BOAT])).toBe(1);
    for (const role of ["editor", "pro", "viewer", "stranger"] as Role[]) {
      expect(await count(U[role], "boat_invitations", "boat_id = $1", [BOAT]), role).toBe(0);
    }
    const owner = await run(U.owner, "select token from public.boat_invitations");
    expect(owner.ok).toBe(false);
    if (!owner.ok) expect(owner.code).toBe("42501");
    const star = await run(U.owner, "select * from public.boat_invitations");
    expect(star.ok).toBe(false);
  });

  it("profiles: a user sees themself and the people sharing a boat; the admin sees everyone", async () => {
    expect(await count(U.owner, "profiles")).toBe(4);
    expect(await count(U.pro, "profiles")).toBe(4);
    expect(await count(U.stranger, "profiles")).toBe(1);
    expect(await count(U.admin, "profiles")).toBe(6);
  });

  it("checklist templates are readable by any signed-in user", async () => {
    expect(await count(U.stranger, "checklist_templates")).toBe(1);
    expect(await count(U.viewer, "checklist_template_items")).toBe(1);
    expect(await count(null, "checklist_templates")).toBe(-1);
  });

  it("boat_role() reflects membership; the platform admin is a virtual owner", async () => {
    const roleOf = async (u: User) =>
      as(u, async (c) => {
        const res = await c.query("select public.boat_role($1::uuid) as role", [BOAT]);
        return res.rows[0]?.role as string | null;
      });
    expect(await roleOf(U.owner)).toBe("owner");
    expect(await roleOf(U.editor)).toBe("editor");
    expect(await roleOf(U.pro)).toBe("pro");
    expect(await roleOf(U.viewer)).toBe("viewer");
    expect(await roleOf(U.admin)).toBe("owner");
    expect(await roleOf(U.stranger)).toBeNull();
  });
});

describe("insert", () => {
  const insertLog = (u: User, createdBy: string) =>
    run(
      u,
      "insert into public.maintenance_logs (boat_id, title, category_id, performed_at, created_by) values ($1, 'Test', $2, '2026-06-01', $3)",
      [BOAT, CATEGORY, createdBy],
    );

  it("maintenance_logs: owner, editor and pro (own row) may insert; viewer and outsiders may not", async () => {
    expect((await insertLog(U.owner, U.owner.id)).ok).toBe(true);
    expect((await insertLog(U.editor, U.editor.id)).ok).toBe(true);
    expect((await insertLog(U.pro, U.pro.id)).ok).toBe(true);
    expect((await insertLog(U.pro, U.owner.id)).ok).toBe(false);
    expect((await insertLog(U.viewer, U.viewer.id)).ok).toBe(false);
    expect((await insertLog(U.stranger, U.stranger.id)).ok).toBe(false);
    expect((await insertLog(U.admin, U.admin.id)).ok).toBe(true);
  });

  it("checklist_completions / engine_hour_readings / attachments: contribute rules", async () => {
    const completion = (u: User, by: string) =>
      run(
        u,
        "insert into public.checklist_completions (boat_id, checklist_item_id, completed_at, engine_hours, created_by) values ($1, $2, '2026-06-01', 700, $3)",
        [BOAT, ITEM, by],
      );
    const reading = (u: User, by: string) =>
      run(
        u,
        "insert into public.engine_hour_readings (boat_id, engine_id, hours, read_at, created_by) values ($1, $2, 710, '2026-06-02', $3)",
        [BOAT, ENGINE, by],
      );
    const attachment = (u: User, by: string) =>
      run(
        u,
        "insert into public.attachments (boat_id, entity_type, entity_id, storage_path, file_name, mime_type, size_bytes, created_by) values ($1, 'boat', $1, $2, 'p.jpg', 'image/jpeg', 10, $3)",
        [BOAT, `boats/${BOAT}/boat/${BOAT}/p.jpg`, by],
      );
    for (const fn of [completion, reading, attachment]) {
      expect((await fn(U.owner, U.owner.id)).ok, fn.name).toBe(true);
      expect((await fn(U.editor, U.editor.id)).ok, fn.name).toBe(true);
      expect((await fn(U.pro, U.pro.id)).ok, fn.name).toBe(true);
      expect((await fn(U.pro, U.owner.id)).ok, fn.name).toBe(false);
      expect((await fn(U.viewer, U.viewer.id)).ok, fn.name).toBe(false);
      expect((await fn(U.stranger, U.stranger.id)).ok, fn.name).toBe(false);
    }
  });

  it.each(WRITE_ONLY_TABLES)("%s: only owner/editor (and admin) may insert", async (table) => {
    const sqlByTable: Record<(typeof WRITE_ONLY_TABLES)[number], string> = {
      engines:
        "insert into public.engines (boat_id, label, position, created_by) values ($1, 'E', 'port', $2)",
      boat_categories:
        "insert into public.boat_categories (boat_id, name, color, created_by) values ($1, 'Cat', '#123456', $2)",
      equipment: "insert into public.equipment (boat_id, name, created_by) values ($1, 'Eq', $2)",
      contacts:
        "insert into public.contacts (boat_id, name, specialty, created_by) values ($1, 'C', 'Autre', $2)",
      haul_outs:
        "insert into public.haul_outs (boat_id, started_at, created_by) values ($1, '2026-06-01', $2)",
      parts: "insert into public.parts (boat_id, name, created_by) values ($1, 'P', $2)",
      purchases:
        "insert into public.purchases (boat_id, purchased_at, designation, created_by) values ($1, '2026-06-01', 'D', $2)",
      checklist_items:
        "insert into public.checklist_items (boat_id, category_id, label, created_by) values ($1, $3, 'Point', $2)",
    };
    const sql = sqlByTable[table];
    const params = (u: User) =>
      table === "checklist_items" ? [BOAT, u.id, CATEGORY] : [BOAT, u.id];
    expect((await run(U.owner, sql, params(U.owner))).ok, "owner").toBe(true);
    expect((await run(U.editor, sql, params(U.editor))).ok, "editor").toBe(true);
    expect((await run(U.admin, sql, params(U.admin))).ok, "admin").toBe(true);
    expect((await run(U.pro, sql, params(U.pro))).ok, "pro").toBe(false);
    expect((await run(U.viewer, sql, params(U.viewer))).ok, "viewer").toBe(false);
    expect((await run(U.stranger, sql, params(U.stranger))).ok, "stranger").toBe(false);
  });

  it("boats: only the platform admin creates boats in V1", async () => {
    const sql = "insert into public.boats (name, type, created_by) values ('Nouveau', 'motor', $1)";
    expect((await run(U.admin, sql, [U.admin.id])).ok).toBe(true);
    expect((await run(U.owner, sql, [U.owner.id])).ok).toBe(false);
  });

  it("boat_members and boat_invitations: owner only", async () => {
    const member =
      "insert into public.boat_members (boat_id, user_id, role) values ($1, $2, 'viewer')";
    expect((await run(U.owner, member, [BOAT, U.stranger.id])).ok).toBe(true);
    expect((await run(U.admin, member, [BOAT, U.stranger.id])).ok).toBe(true);
    expect((await run(U.editor, member, [BOAT, U.stranger.id])).ok).toBe(false);
    const invite =
      "insert into public.boat_invitations (boat_id, email, role, token, invited_by) values ($1, 'new@test.xaman', 'editor', $2, $3)";
    expect((await run(U.owner, invite, [BOAT, "tok-1", U.owner.id])).ok).toBe(true);
    expect((await run(U.owner, invite, [BOAT, "tok-2", U.editor.id])).ok).toBe(false);
    expect((await run(U.editor, invite, [BOAT, "tok-3", U.editor.id])).ok).toBe(false);
  });

  it("checklist templates: platform admin only", async () => {
    const sql = "insert into public.checklist_templates (name, external_ref) values ('T', $1)";
    expect((await run(U.admin, sql, ["t-admin"])).ok).toBe(true);
    expect((await run(U.owner, sql, ["t-owner"])).ok).toBe(false);
  });
});

describe("update", () => {
  it("maintenance_logs: owner/editor edit everything; a pro edits only their own rows", async () => {
    const setTitle = (u: User, id: string) =>
      run(u, "update public.maintenance_logs set title = 'Modifié' where id = $1", [id]);
    expect(
      (await setTitle(U.owner, LOG_PRO)).ok &&
        ((await setTitle(U.owner, LOG_PRO)) as { rowCount: number }).rowCount,
    ).toBe(1);
    expect(await setTitle(U.editor, LOG_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await setTitle(U.pro, LOG_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await setTitle(U.pro, LOG_OWNER)).toEqual({ ok: true, rowCount: 0 });
    expect(await setTitle(U.viewer, LOG_OWNER)).toEqual({ ok: true, rowCount: 0 });
    expect(await setTitle(U.stranger, LOG_OWNER)).toEqual({ ok: true, rowCount: 0 });
  });

  it("maintenance_logs: a pro cannot move even their own row to the trash; owner/editor can", async () => {
    const trash = (u: User, id: string) =>
      run(u, "update public.maintenance_logs set deleted_at = now() where id = $1", [id]);
    const pro = await trash(U.pro, LOG_PRO);
    expect(pro.ok).toBe(false);
    if (!pro.ok) expect(pro.code).toBe("42501");
    expect(await trash(U.owner, LOG_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await trash(U.editor, LOG_OWNER)).toEqual({ ok: true, rowCount: 1 });
    expect(await trash(U.viewer, LOG_OWNER)).toEqual({ ok: true, rowCount: 0 });
  });

  it("a pro cannot hand their row over to someone else or to another boat", async () => {
    expect(
      (
        await run(U.pro, "update public.maintenance_logs set created_by = $2 where id = $1", [
          LOG_PRO,
          U.owner.id,
        ])
      ).ok,
    ).toBe(false);
    expect(
      (
        await run(U.pro, "update public.maintenance_logs set boat_id = $2 where id = $1", [
          LOG_PRO,
          BOAT2,
        ])
      ).ok,
    ).toBe(false);
  });

  it("boats: owner/editor update the boat, pro/viewer cannot", async () => {
    const sql = "update public.boats set notes = 'n' where id = $1";
    expect(await run(U.owner, sql, [BOAT])).toEqual({ ok: true, rowCount: 1 });
    expect(await run(U.editor, sql, [BOAT])).toEqual({ ok: true, rowCount: 1 });
    expect(await run(U.pro, sql, [BOAT])).toEqual({ ok: true, rowCount: 0 });
    expect(await run(U.viewer, sql, [BOAT])).toEqual({ ok: true, rowCount: 0 });
  });

  it("boat_members: only owners change roles, and the last owner is protected", async () => {
    const demote = (u: User, userId: string) =>
      run(u, "update public.boat_members set role = 'viewer' where boat_id = $1 and user_id = $2", [
        BOAT,
        userId,
      ]);
    expect(await demote(U.owner, U.editor.id)).toEqual({ ok: true, rowCount: 1 });
    expect(await demote(U.editor, U.viewer.id)).toEqual({ ok: true, rowCount: 0 });
    const last = await demote(U.owner, U.owner.id);
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.message).toContain("last_owner");
    const remove = await run(
      U.owner,
      "delete from public.boat_members where boat_id = $1 and user_id = $2",
      [BOAT, U.owner.id],
    );
    expect(remove.ok).toBe(false);
    // promoting a second owner first makes the demotion legal
    const twoOwners = await as(U.owner, async (c) => {
      await c.query(
        "update public.boat_members set role = 'owner' where boat_id = $1 and user_id = $2",
        [BOAT, U.editor.id],
      );
      const res = await c.query(
        "update public.boat_members set role = 'editor' where boat_id = $1 and user_id = $2",
        [BOAT, U.owner.id],
      );
      return res.rowCount;
    });
    expect(twoOwners).toBe(1);
  });

  it("boat_invitations: owner revokes; nothing else is updatable", async () => {
    expect(
      await run(
        U.owner,
        "update public.boat_invitations set revoked_at = now() where boat_id = $1",
        [BOAT],
      ),
    ).toEqual({ ok: true, rowCount: 1 });
    expect(
      (
        await run(
          U.owner,
          "update public.boat_invitations set email = 'x@test.xaman' where boat_id = $1",
          [BOAT],
        )
      ).ok,
    ).toBe(false);
    expect(
      await run(
        U.editor,
        "update public.boat_invitations set revoked_at = now() where boat_id = $1",
        [BOAT],
      ),
    ).toEqual({ ok: true, rowCount: 0 });
  });

  it("profiles: a user edits their own display data only, never is_platform_admin", async () => {
    expect(
      await run(U.owner, "update public.profiles set full_name = 'O' where id = $1", [U.owner.id]),
    ).toEqual({ ok: true, rowCount: 1 });
    expect(
      await run(U.owner, "update public.profiles set full_name = 'E' where id = $1", [U.editor.id]),
    ).toEqual({ ok: true, rowCount: 0 });
    const admin = await run(
      U.owner,
      "update public.profiles set is_platform_admin = true where id = $1",
      [U.owner.id],
    );
    expect(admin.ok).toBe(false);
    const email = await run(
      U.owner,
      "update public.profiles set email = 'x@test.xaman' where id = $1",
      [U.owner.id],
    );
    expect(email.ok).toBe(false);
  });
});

describe("delete", () => {
  it("maintenance_logs: owner/editor may delete, pro and viewer may not (even their own rows)", async () => {
    const del = (u: User, id: string) =>
      run(u, "delete from public.maintenance_logs where id = $1", [id]);
    expect(await del(U.owner, LOG_PRO)).toEqual({ ok: true, rowCount: 1 });
    expect(await del(U.editor, LOG_OWNER)).toEqual({ ok: true, rowCount: 1 });
    expect(await del(U.pro, LOG_PRO)).toEqual({ ok: true, rowCount: 0 });
    expect(await del(U.viewer, LOG_OWNER)).toEqual({ ok: true, rowCount: 0 });
  });

  it("boats: only the owner deletes the boat (cascade), editors cannot", async () => {
    expect(await run(U.editor, "delete from public.boats where id = $1", [BOAT])).toEqual({
      ok: true,
      rowCount: 0,
    });
    expect(await run(U.owner, "delete from public.boats where id = $1", [BOAT])).toEqual({
      ok: true,
      rowCount: 1,
    });
  });

  it("boat_members: the owner removes a member; a member cannot remove others", async () => {
    expect(
      await run(U.owner, "delete from public.boat_members where boat_id = $1 and user_id = $2", [
        BOAT,
        U.viewer.id,
      ]),
    ).toEqual({ ok: true, rowCount: 1 });
    expect(
      await run(U.editor, "delete from public.boat_members where boat_id = $1 and user_id = $2", [
        BOAT,
        U.viewer.id,
      ]),
    ).toEqual({ ok: true, rowCount: 0 });
  });
});

describe("invitation functions", () => {
  it("get_invitation_preview works anonymously and exposes only the preview", async () => {
    const preview = await as(null, async (c) => {
      const res = await c.query("select * from public.get_invitation_preview($1)", [
        INVITATION_TOKEN,
      ]);
      return res.rows[0] as Record<string, unknown> | undefined;
    });
    expect(preview).toMatchObject({
      boat_name: "Bateau test",
      email: "stranger@test.xaman",
      role: "viewer",
      status: "pending",
    });
    const unknown = await as(
      null,
      async (c) => (await c.query("select * from public.get_invitation_preview('nope')")).rowCount,
    );
    expect(unknown).toBe(0);
  });

  it("accept_invitation adds the member when the e-mail matches, and rejects everyone else", async () => {
    const accepted = await as(U.stranger, async (c) => {
      const res = await c.query("select public.accept_invitation($1) as boat_id", [
        INVITATION_TOKEN,
      ]);
      const visible = await c.query("select count(*)::int as n from public.boats where id = $1", [
        BOAT,
      ]);
      return { boatId: res.rows[0]?.boat_id as string, visible: Number(visible.rows[0]?.n) };
    });
    expect(accepted).toEqual({ boatId: BOAT, visible: 1 });

    const mismatch = await run(U.viewer, "select public.accept_invitation($1)", [INVITATION_TOKEN]);
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.message).toContain("invitation_email_mismatch");

    const anon = await run(null, "select public.accept_invitation($1)", [INVITATION_TOKEN]);
    expect(anon.ok).toBe(false);
  });
});

describe("storage bucket boat-files", () => {
  const OBJECT = `boats/${BOAT}/maintenance_log/${LOG_OWNER}/photo.jpg`;
  const insertObject = (u: User) =>
    run(u, "insert into storage.objects (bucket_id, name, owner) values ('boat-files', $1, $2)", [
      OBJECT,
      u.id,
    ]);

  it("contributors upload under their boat prefix; viewers and outsiders cannot", async () => {
    expect((await insertObject(U.owner)).ok).toBe(true);
    expect((await insertObject(U.pro)).ok).toBe(true);
    expect((await insertObject(U.viewer)).ok).toBe(false);
    expect((await insertObject(U.stranger)).ok).toBe(false);
    expect(
      (
        await run(
          U.owner,
          "insert into storage.objects (bucket_id, name) values ('boat-files', $1)",
          [`boats/${BOAT2}/x.jpg`],
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await run(
          U.owner,
          "insert into storage.objects (bucket_id, name) values ('boat-files', 'loose.jpg')",
        )
      ).ok,
    ).toBe(false);
  });

  it("members read objects of their boat; only owner/editor delete them", async () => {
    const seeded = await as(U.owner, async (c) => {
      await c.query(
        "insert into storage.objects (bucket_id, name, owner) values ('boat-files', $1, $2)",
        [OBJECT, U.owner.id],
      );
      return true;
    });
    expect(seeded).toBe(true);
    // each `as` call is its own rolled-back transaction: re-insert with the service role for reads
    const readAs = (u: User) =>
      as(u, async (c) => {
        await c.query("set local role service_role");
        await c.query("insert into storage.objects (bucket_id, name) values ('boat-files', $1)", [
          OBJECT,
        ]);
        await c.query("set local role authenticated");
        const res = await c.query(
          "select count(*)::int as n from storage.objects where name = $1",
          [OBJECT],
        );
        const del = await c.query("delete from storage.objects where name = $1", [OBJECT]);
        return { seen: Number(res.rows[0]?.n), deleted: del.rowCount };
      });
    expect(await readAs(U.viewer)).toEqual({ seen: 1, deleted: 0 });
    expect(await readAs(U.pro)).toEqual({ seen: 1, deleted: 0 });
    expect(await readAs(U.editor)).toEqual({ seen: 1, deleted: 1 });
    expect(await readAs(U.stranger)).toEqual({ seen: 0, deleted: 0 });
  });
});
