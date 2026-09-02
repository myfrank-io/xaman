/**
 * pnpm seed:xaman (scripts/seed.mts) — loads seed/*.json into a database (local, preview or production).
 *
 * Idempotent: every row is upserted on its external_ref (DATA-MODEL.md §8); running it twice
 * leaves the row counts unchanged (tests/unit/seed.test.ts).
 *
 * Environment:
 *   DATABASE_URL                 required — direct Postgres connection (local stack: the default below;
 *                                production: the Supabase session-pooler URL with the database password)
 *   NEXT_PUBLIC_SUPABASE_URL +   optional — when both are set, member accounts are created through the
 *   SUPABASE_SERVICE_ROLE_KEY    Auth admin API (inviteUserByEmail); otherwise (local database without
 *                                GoTrue) they are inserted directly into auth.users for development.
 *
 * Never embeds keys: run it locally / in CI / by the platform admin only.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";

// ---------------------------------------------------------------------------------------------
// Seed file schemas (light validation: shape + types)
// ---------------------------------------------------------------------------------------------
const nullableText = z.string().nullable().optional();

const templateFile = z.object({
  template: z.object({
    external_ref: z.string(),
    name: z.string(),
    builder: nullableText,
    model: nullableText,
    boat_type: z.string().nullable().optional(),
    version: z.number().int().optional(),
    is_public: z.boolean().optional(),
  }),
  categories: z.array(
    z.object({
      external_ref: z.string(),
      name: z.string(),
      color: z.string(),
      icon: nullableText,
      sort_order: z.number().int(),
      items: z.array(
        z.object({
          external_ref: z.string(),
          label: z.string(),
          description: nullableText,
          interval_months: z.number().int().positive().nullable().optional(),
          interval_hours: z.number().int().positive().nullable().optional(),
          engine_scope: z.enum(["none", "inboard", "outboard", "all"]).optional(),
          source: z.enum(["briefing", "proposal", "builder"]).optional(),
          actions: z.array(z.string()).optional(),
        }),
      ),
    }),
  ),
});

const boatFile = z.object({
  boat: z.object({
    external_ref: z.string(),
    name: z.string(),
    builder: nullableText,
    model: nullableText,
    hull_number: nullableText,
    year: z.number().int().nullable().optional(),
    type: z.string(),
    flag: nullableText,
    home_port: nullableText,
    sail_number: nullableText,
    length_m: z.number().nullable().optional(),
    beam_m: z.number().nullable().optional(),
    draft_m: z.number().nullable().optional(),
    checklist_template_ref: z.string().nullable().optional(),
    notes: nullableText,
  }),
  members: z.array(
    z.object({
      email: z.string(),
      role: z.enum(["owner", "editor", "pro", "viewer"]),
      display_name: nullableText,
      is_platform_admin: z.boolean().optional(),
    }),
  ),
  engines: z.array(
    z.object({
      external_ref: z.string(),
      label: z.string(),
      position: z.enum(["port", "starboard", "center", "outboard"]),
      brand: nullableText,
      model: nullableText,
      serial: nullableText,
      sort_order: z.number().int().optional(),
      notes: nullableText,
    }),
  ),
  equipment: z.array(
    z.object({
      external_ref: z.string(),
      category_ref: z.string().nullable().optional(),
      name: z.string(),
      brand: nullableText,
      model: nullableText,
      serial: nullableText,
      quantity: z.number().int().optional(),
      installed_at: nullableText,
      specs: z.record(z.string(), z.unknown()).optional(),
      notes: nullableText,
    }),
  ),
  contacts: z.array(
    z.object({
      external_ref: z.string(),
      name: z.string(),
      company: nullableText,
      specialty: z.string(),
      phone: nullableText,
      email: nullableText,
      address: nullableText,
      notes: nullableText,
    }),
  ),
  haul_outs: z
    .array(
      z.object({
        external_ref: z.string(),
        started_at: z.string(),
        ended_at: nullableText,
        yard_contact_ref: nullableText,
        yard_name: nullableText,
        works: nullableText,
        cost: z.number().nullable().optional(),
        notes: nullableText,
      }),
    )
    .optional(),
});

const historyFile = z.object({
  maintenance_logs: z.array(
    z.object({
      external_ref: z.string(),
      performed_at: z.string(),
      title: z.string(),
      category_ref: z.string().nullable().optional(),
      status: z.enum(["planned", "in_progress", "done", "urgent"]).optional(),
      priority: z.enum(["low", "normal", "high"]).optional(),
      engine_hours: z.record(z.string(), z.number()).optional(),
      contact_ref: nullableText,
      cost: z.number().nullable().optional(),
      notes: nullableText,
      needs_review: z.boolean().optional(),
    }),
  ),
  purchases: z.array(
    z.object({
      external_ref: z.string(),
      purchased_at: z.string(),
      kind: z.enum(["gas", "part", "consumable", "service", "other"]).optional(),
      designation: z.string(),
      bottle_type: nullableText,
      supplier_name: nullableText,
      supplier_ref: nullableText,
      amount: z.number().nullable().optional(),
      category_ref: z.string().nullable().optional(),
      notes: nullableText,
      needs_review: z.boolean().optional(),
    }),
  ),
});

export type SeedOptions = {
  seedDir: string;
  /** create auth users through the Supabase admin API (production) or directly (local dev) */
  auth?: { url: string; serviceRoleKey: string } | null;
  log?: (message: string) => void;
};

export type SeedReport = Record<string, number>;

// "TODO…" placeholders in the seed files are treated as unknown values.
function clean(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const v = value.trim();
  if (v === "" || /^TODO\b/i.test(v)) return null;
  return v;
}

function isPlaceholderEmail(email: string): boolean {
  return /^TODO/i.test(email) || /@example\.(com|org|net)$/i.test(email);
}

function readJson<T>(schema: z.ZodType<T>, file: string): T {
  const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
  return schema.parse(raw);
}

async function one<T>(client: PoolClient, sql: string, params: unknown[]): Promise<T> {
  const res = await client.query(sql, params);
  return res.rows[0] as T;
}

// ---------------------------------------------------------------------------------------------
// Users (members)
// ---------------------------------------------------------------------------------------------
async function ensureUser(
  client: PoolClient,
  options: SeedOptions,
  email: string,
  fullName: string | null,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const existing = await one<{ id: string } | undefined>(
    client,
    "select id from auth.users where lower(email) = $1",
    [normalized],
  );
  if (existing) return existing.id;

  if (options.auth) {
    if (isPlaceholderEmail(normalized)) {
      options.log?.(
        `  ! member ${email}: placeholder e-mail, skipped (complete seed/xaman-boat.json)`,
      );
      return null;
    }
    const admin = createClient(options.auth.url, options.auth.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.auth.admin.inviteUserByEmail(normalized, {
      data: fullName ? { full_name: fullName } : undefined,
    });
    if (error || !data.user)
      throw new Error(`inviteUserByEmail(${normalized}) failed: ${error?.message}`);
    // the profile row is created by the on_auth_user_created trigger; make sure it exists before we continue
    await client.query(
      "insert into public.profiles (id, email, full_name) values ($1, $2, $3) on conflict (id) do nothing",
      [data.user.id, normalized, fullName],
    );
    return data.user.id;
  }

  // Local development without GoTrue: insert the auth row directly (same shape as supabase/seed.sql)
  const row = await one<{ id: string }>(
    client,
    `insert into auth.users (
       id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
       raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, recovery_token, email_change_token_new, email_change
     ) values (
       gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $1, '', now(),
       '{"provider":"email","providers":["email"]}', $2::jsonb, now(), now(), '', '', '', ''
     ) returning id`,
    [normalized, JSON.stringify(fullName ? { full_name: fullName } : {})],
  );
  return row.id;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
export async function runSeed(pool: Pool, options: SeedOptions): Promise<SeedReport> {
  const log = options.log ?? (() => undefined);
  const tpl = readJson(templateFile, path.join(options.seedDir, "orc50-checklist.json"));
  const boatData = readJson(boatFile, path.join(options.seedDir, "xaman-boat.json"));
  const history = readJson(historyFile, path.join(options.seedDir, "xaman-history.json"));

  const client = await pool.connect();
  const report: SeedReport = {};
  try {
    await client.query("begin");

    // -- members / users first: we need the platform admin id to act as the author ---------------
    const memberIds = new Map<string, string>();
    let adminId: string | null = null;
    for (const m of boatData.members) {
      const id = await ensureUser(client, options, m.email, clean(m.display_name));
      if (!id) continue;
      memberIds.set(m.email, id);
      if (m.is_platform_admin) {
        await client.query("update public.profiles set is_platform_admin = true where id = $1", [
          id,
        ]);
        adminId = id;
      }
    }
    if (!adminId)
      throw new Error("seed/xaman-boat.json must declare one member with is_platform_admin: true");
    // security-definer functions (apply_checklist_template) check auth.uid(): act as the platform admin
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: adminId, role: "authenticated" }),
    ]);
    const by = adminId;

    // -- template --------------------------------------------------------------------------------
    const template = await one<{ id: string }>(
      client,
      `insert into public.checklist_templates (name, builder, model, boat_type, version, is_public, external_ref, created_by)
       values ($1, $2, $3, $4::public.boat_type, $5, $6, $7, $8)
       on conflict (external_ref) do update set name = excluded.name, builder = excluded.builder, model = excluded.model,
         boat_type = excluded.boat_type, version = excluded.version, is_public = excluded.is_public
       returning id`,
      [
        tpl.template.name,
        clean(tpl.template.builder),
        clean(tpl.template.model),
        tpl.template.boat_type ?? null,
        tpl.template.version ?? 1,
        tpl.template.is_public ?? true,
        tpl.template.external_ref,
        by,
      ],
    );
    let itemCount = 0;
    for (const cat of tpl.categories) {
      const category = await one<{ id: string }>(
        client,
        `insert into public.checklist_template_categories (template_id, name, color, icon, sort_order, external_ref)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (template_id, external_ref) do update set name = excluded.name, color = excluded.color,
           icon = excluded.icon, sort_order = excluded.sort_order
         returning id`,
        [template.id, cat.name, cat.color, clean(cat.icon), cat.sort_order, cat.external_ref],
      );
      let sort = 0;
      for (const item of cat.items) {
        sort += 1;
        await client.query(
          `insert into public.checklist_template_items
             (template_category_id, label, description, interval_months, interval_hours, engine_scope, actions, source, sort_order, external_ref)
           values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)
           on conflict (template_category_id, external_ref) do update set label = excluded.label,
             description = excluded.description, interval_months = excluded.interval_months,
             interval_hours = excluded.interval_hours, engine_scope = excluded.engine_scope,
             actions = excluded.actions, source = excluded.source, sort_order = excluded.sort_order`,
          [
            category.id,
            item.label,
            clean(item.description),
            item.interval_months ?? null,
            item.interval_hours ?? null,
            item.engine_scope ?? "none",
            JSON.stringify(item.actions ?? []),
            item.source ?? null,
            sort,
            item.external_ref,
          ],
        );
        itemCount += 1;
      }
    }
    report.template_categories = tpl.categories.length;
    report.template_items = itemCount;
    log(
      `template ${tpl.template.external_ref}: ${tpl.categories.length} categories, ${itemCount} items`,
    );

    // -- boat ------------------------------------------------------------------------------------
    const b = boatData.boat;
    const boat = await one<{ id: string }>(
      client,
      `insert into public.boats (name, builder, model, hull_number, year, type, flag, home_port, sail_number,
         length_m, beam_m, draft_m, notes, checklist_template_id, external_ref, created_by, updated_by)
       values ($1, $2, $3, $4, $5, $6::public.boat_type, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)
       on conflict (external_ref) do update set name = excluded.name, builder = excluded.builder, model = excluded.model,
         hull_number = excluded.hull_number, year = excluded.year, type = excluded.type,
         flag = coalesce(excluded.flag, public.boats.flag), home_port = coalesce(excluded.home_port, public.boats.home_port),
         sail_number = coalesce(excluded.sail_number, public.boats.sail_number),
         length_m = coalesce(excluded.length_m, public.boats.length_m), beam_m = coalesce(excluded.beam_m, public.boats.beam_m),
         draft_m = coalesce(excluded.draft_m, public.boats.draft_m), notes = coalesce(public.boats.notes, excluded.notes),
         checklist_template_id = excluded.checklist_template_id
       returning id`,
      [
        b.name,
        clean(b.builder),
        clean(b.model),
        clean(b.hull_number),
        b.year ?? null,
        b.type,
        clean(b.flag),
        clean(b.home_port),
        clean(b.sail_number),
        b.length_m ?? null,
        b.beam_m ?? null,
        b.draft_m ?? null,
        clean(b.notes),
        b.checklist_template_ref === tpl.template.external_ref ? template.id : null,
        b.external_ref,
        by,
      ],
    );
    log(`boat ${b.name} (${boat.id})`);

    // -- members ---------------------------------------------------------------------------------
    let memberCount = 0;
    for (const m of boatData.members) {
      const userId = memberIds.get(m.email);
      if (!userId) continue;
      await client.query(
        `insert into public.boat_members (boat_id, user_id, role, invited_by) values ($1, $2, $3::public.boat_role, $4)
         on conflict (boat_id, user_id) do update set role = excluded.role`,
        [boat.id, userId, m.role, by],
      );
      memberCount += 1;
    }
    report.members = memberCount;

    // -- engines ---------------------------------------------------------------------------------
    const engineIds = new Map<string, string>();
    for (const e of boatData.engines) {
      const row = await one<{ id: string }>(
        client,
        `insert into public.engines (boat_id, label, position, brand, model, serial, sort_order, notes, external_ref, created_by, updated_by)
         values ($1, $2, $3::public.engine_position, $4, $5, $6, $7, $8, $9, $10, $10)
         on conflict (boat_id, external_ref) do update set label = excluded.label, position = excluded.position,
           brand = coalesce(excluded.brand, public.engines.brand), model = coalesce(excluded.model, public.engines.model),
           serial = coalesce(excluded.serial, public.engines.serial), sort_order = excluded.sort_order,
           notes = coalesce(public.engines.notes, excluded.notes)
         returning id`,
        [
          boat.id,
          e.label,
          e.position,
          clean(e.brand),
          clean(e.model),
          clean(e.serial),
          e.sort_order ?? 0,
          clean(e.notes),
          e.external_ref,
          by,
        ],
      );
      engineIds.set(e.external_ref, row.id);
    }
    report.engines = engineIds.size;

    // -- checklist instantiation (idempotent SQL function) ----------------------------------------
    await client.query("select public.apply_checklist_template($1::uuid, $2::uuid)", [
      boat.id,
      template.id,
    ]);
    const categoryIds = new Map<string, string>();
    for (const row of (
      await client.query("select id, external_ref from public.boat_categories where boat_id = $1", [
        boat.id,
      ])
    ).rows as { id: string; external_ref: string | null }[]) {
      if (row.external_ref) categoryIds.set(row.external_ref, row.id);
    }
    report.boat_categories = categoryIds.size;
    report.checklist_items = Number(
      (
        await one<{ n: string }>(
          client,
          "select count(*) as n from public.checklist_items where boat_id = $1",
          [boat.id],
        )
      ).n,
    );
    log(`checklist: ${report.boat_categories} categories, ${report.checklist_items} items`);

    // -- equipment -------------------------------------------------------------------------------
    let sortEq = 0;
    for (const eq of boatData.equipment) {
      sortEq += 1;
      await client.query(
        `insert into public.equipment (boat_id, category_id, name, brand, model, serial, quantity, installed_at, specs, notes, sort_order, external_ref, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $13)
         on conflict (boat_id, external_ref) do update set category_id = excluded.category_id, name = excluded.name,
           brand = coalesce(excluded.brand, public.equipment.brand), model = coalesce(excluded.model, public.equipment.model),
           serial = coalesce(excluded.serial, public.equipment.serial), quantity = excluded.quantity,
           installed_at = coalesce(excluded.installed_at, public.equipment.installed_at),
           specs = public.equipment.specs || excluded.specs, sort_order = excluded.sort_order`,
        [
          boat.id,
          eq.category_ref ? (categoryIds.get(eq.category_ref) ?? null) : null,
          eq.name,
          clean(eq.brand),
          clean(eq.model),
          clean(eq.serial),
          eq.quantity ?? 1,
          clean(eq.installed_at),
          JSON.stringify(eq.specs ?? {}),
          clean(eq.notes),
          sortEq,
          eq.external_ref,
          by,
        ],
      );
    }
    report.equipment = boatData.equipment.length;

    // -- contacts --------------------------------------------------------------------------------
    const contactIds = new Map<string, string>();
    for (const c of boatData.contacts) {
      const name = clean(c.name) ?? `${c.specialty} (à compléter)`;
      const row = await one<{ id: string }>(
        client,
        `insert into public.contacts (boat_id, name, company, specialty, phone, email, address, notes, external_ref, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
         on conflict (boat_id, external_ref) do update set specialty = excluded.specialty,
           name = case when public.contacts.name like '%(à compléter)' then excluded.name else public.contacts.name end,
           phone = coalesce(public.contacts.phone, excluded.phone), email = coalesce(public.contacts.email, excluded.email)
         returning id`,
        [
          boat.id,
          name,
          clean(c.company),
          c.specialty,
          clean(c.phone),
          clean(c.email),
          clean(c.address),
          clean(c.notes),
          c.external_ref,
          by,
        ],
      );
      contactIds.set(c.external_ref, row.id);
    }
    report.contacts = contactIds.size;

    // -- haul-outs -------------------------------------------------------------------------------
    for (const h of boatData.haul_outs ?? []) {
      await client.query(
        `insert into public.haul_outs (boat_id, started_at, ended_at, yard_contact_id, yard_name, works, cost, notes, external_ref, created_by, updated_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
         on conflict (boat_id, external_ref) do update set started_at = excluded.started_at, ended_at = excluded.ended_at,
           yard_contact_id = excluded.yard_contact_id, yard_name = excluded.yard_name, works = excluded.works, cost = excluded.cost`,
        [
          boat.id,
          h.started_at,
          clean(h.ended_at),
          h.yard_contact_ref ? (contactIds.get(h.yard_contact_ref) ?? null) : null,
          clean(h.yard_name),
          clean(h.works),
          h.cost ?? null,
          clean(h.notes),
          h.external_ref,
          by,
        ],
      );
    }
    report.haul_outs = (boatData.haul_outs ?? []).length;

    // -- history: maintenance logs ---------------------------------------------------------------
    for (const l of history.maintenance_logs) {
      const needsReview = l.needs_review ?? false;
      const pending: Record<string, number> = {};
      for (const [engineRef, hours] of Object.entries(l.engine_hours ?? {})) {
        const engineId = engineIds.get(engineRef);
        if (!engineId) throw new Error(`history ${l.external_ref}: unknown engine ${engineRef}`);
        pending[engineId] = hours;
      }
      const logRow = await one<{ id: string }>(
        client,
        `insert into public.maintenance_logs (boat_id, title, category_id, status, priority, performed_at, cost, contact_id, notes, needs_review, pending_engine_hours, external_ref, created_by, updated_by)
         values ($1, $2, $3, $4::public.log_status, $5::public.log_priority, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $13)
         on conflict (boat_id, external_ref) do update set title = excluded.title, category_id = excluded.category_id,
           performed_at = excluded.performed_at, contact_id = coalesce(public.maintenance_logs.contact_id, excluded.contact_id),
           notes = coalesce(public.maintenance_logs.notes, excluded.notes)
         returning id`,
        [
          boat.id,
          l.title,
          l.category_ref ? (categoryIds.get(l.category_ref) ?? null) : null,
          l.status ?? "done",
          l.priority ?? "normal",
          l.performed_at,
          l.cost ?? null,
          l.contact_ref ? (contactIds.get(l.contact_ref) ?? null) : null,
          clean(l.notes),
          needsReview,
          needsReview && Object.keys(pending).length > 0 ? JSON.stringify(pending) : null,
          l.external_ref,
          by,
        ],
      );
      if (!needsReview) {
        for (const [engineId, hours] of Object.entries(pending)) {
          await client.query(
            `insert into public.engine_hour_readings (boat_id, engine_id, hours, read_at, source, maintenance_log_id, created_by, updated_by)
             values ($1, $2, $3, $4, 'import', $5, $6, $6)
             on conflict (maintenance_log_id, engine_id) do update set hours = excluded.hours, read_at = excluded.read_at`,
            [boat.id, engineId, hours, l.performed_at, logRow.id, by],
          );
        }
      }
    }
    report.maintenance_logs = history.maintenance_logs.length;

    // -- history: purchases ----------------------------------------------------------------------
    for (const p of history.purchases) {
      await client.query(
        `insert into public.purchases (boat_id, purchased_at, kind, designation, amount, supplier_contact_id, supplier_name, category_id, bottle_type, notes, needs_review, external_ref, created_by, updated_by)
         values ($1, $2, $3::public.purchase_kind, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
         on conflict (boat_id, external_ref) do update set designation = excluded.designation, purchased_at = excluded.purchased_at,
           kind = excluded.kind, category_id = excluded.category_id,
           amount = coalesce(public.purchases.amount, excluded.amount), notes = coalesce(public.purchases.notes, excluded.notes)`,
        [
          boat.id,
          p.purchased_at,
          p.kind ?? "other",
          p.designation,
          p.amount ?? null,
          p.supplier_ref ? (contactIds.get(p.supplier_ref) ?? null) : null,
          clean(p.supplier_name),
          p.category_ref ? (categoryIds.get(p.category_ref) ?? null) : null,
          clean(p.bottle_type),
          clean(p.notes),
          p.needs_review ?? false,
          p.external_ref,
          by,
        ],
      );
    }
    report.purchases = history.purchases.length;

    await client.query("commit");
    log("seed committed");
    return report;
  } catch (e) {
    await client.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

// CLI entry point ------------------------------------------------------------------------------
const isCli =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (isCli) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is required (see scripts/seed.ts header)");
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const auth = url && serviceRoleKey ? { url, serviceRoleKey } : null;
  console.log(auth ? "users: Supabase Auth admin API" : "users: direct insert (local development)");
  const pool = new Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const report = await runSeed(pool, {
      seedDir: path.resolve(import.meta.dirname, "../seed"),
      auth,
      log: (m) => console.log(m),
    });
    console.table(report);
  } finally {
    await pool.end();
  }
}
