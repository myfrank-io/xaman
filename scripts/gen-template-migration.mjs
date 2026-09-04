#!/usr/bin/env node
/**
 * Regenerates supabase/migrations/0016_generic_templates.sql from seed/generic-checklists.json.
 *
 * The generic models have to reach production, and production never runs `pnpm seed:xaman` — the
 * seed carries Xaman's own data and needs a database password. So the registry ships as a
 * migration. Writing 200 inserts by hand would be a quoting accident waiting to happen (the
 * content is French prose full of apostrophes), so the JSON travels as one dollar-quoted literal
 * and a plpgsql loop unpacks it, upserting on the same external_ref keys the seed script uses.
 *
 * The JSON stays the file a human edits. `tests/unit/template-migration.test.ts` fails if the
 * committed SQL no longer matches it, so the two cannot drift.
 *
 * Usage: node scripts/gen-template-migration.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE = path.join(root, "seed", "generic-checklists.json");
export const TARGET = path.join(root, "supabase", "migrations", "0016_generic_templates.sql");

const HEADER = `-- 0016_generic_templates.sql — the model registry, so that no boat is ever turned away.
--
-- Generated from seed/generic-checklists.json by scripts/gen-template-migration.mjs.
-- Do not edit by hand: edit the JSON and re-run the script (tests/unit/template-migration.test.ts
-- fails if the two drift).
--
-- 0015 made the model compulsory when a boat is created: it is what makes the carnet arrive
-- already filled, and « création libre de bateaux sans modèle » is on the audit's do-not list
-- (§2). That only works if there is always a model to choose. Until now there was exactly one —
-- « ORC 50 — Marsaudon Composites » — and it is loaded by \`pnpm seed:xaman\`, which carries
-- Xaman's own data and never runs against production. A production database therefore had an
-- empty registry, and anyone who was not Xavier had nothing to pick.
--
-- These three are the floor the audit deferred (« modèle générique (reporté) », §3.4), now that
-- the deferral has become the thing standing between a new owner and their carnet. They are not
-- placeholders: same eight systems and same colours as the ORC 50 model, 60 to 70 points each
-- drawn from what any boat of that kind actually needs, and step-by-step actions on the dozen
-- jobs where the steps are the point (oil, impeller, anodes, seacocks, liferaft, gas).
--
-- An exact model always beats a generic one and the picker ranks it first; these exist so that a
-- boat whose builder has published nothing still opens on a real maintenance plan.
--
-- Idempotent, on the same external_ref keys scripts/seed.mts upserts on: re-running updates the
-- wording in place and never duplicates a category or a point. A boat already instantiated from
-- one of these keeps its own rows — \`apply_checklist_template\` copies, it does not track.
`;

const BODY = `
do $migration$
declare
  v_payload jsonb := $json$__PAYLOAD__$json$;
  v_template jsonb;
  v_category jsonb;
  v_item jsonb;
  v_template_id uuid;
  v_category_id uuid;
  v_category_order int;
  v_item_order int;
begin
  for v_template in select * from jsonb_array_elements(v_payload -> 'templates')
  loop
    insert into public.checklist_templates (name, builder, model, boat_type, version, is_public, external_ref)
    values (
      v_template -> 'template' ->> 'name',
      v_template -> 'template' ->> 'builder',
      v_template -> 'template' ->> 'model',
      (v_template -> 'template' ->> 'boat_type')::public.boat_type,
      (v_template -> 'template' ->> 'version')::int,
      (v_template -> 'template' ->> 'is_public')::boolean,
      v_template -> 'template' ->> 'external_ref'
    )
    on conflict (external_ref) do update
      set name = excluded.name,
          builder = excluded.builder,
          model = excluded.model,
          boat_type = excluded.boat_type,
          version = excluded.version,
          is_public = excluded.is_public
    returning id into v_template_id;

    v_category_order := 0;
    for v_category in select * from jsonb_array_elements(v_template -> 'categories')
    loop
      v_category_order := v_category_order + 1;
      insert into public.checklist_template_categories (template_id, name, color, icon, sort_order, external_ref)
      values (
        v_template_id,
        v_category ->> 'name',
        v_category ->> 'color',
        v_category ->> 'icon',
        coalesce((v_category ->> 'sort_order')::int, v_category_order),
        v_category ->> 'external_ref'
      )
      on conflict (template_id, external_ref) do update
        set name = excluded.name,
            color = excluded.color,
            icon = excluded.icon,
            sort_order = excluded.sort_order
      returning id into v_category_id;

      v_item_order := 0;
      for v_item in select * from jsonb_array_elements(v_category -> 'items')
      loop
        v_item_order := v_item_order + 1;
        insert into public.checklist_template_items (
          template_category_id, label, description, interval_months, interval_hours,
          engine_scope, actions, source, sort_order, external_ref
        )
        values (
          v_category_id,
          v_item ->> 'label',
          v_item ->> 'description',
          (v_item ->> 'interval_months')::int,
          (v_item ->> 'interval_hours')::int,
          coalesce(v_item ->> 'engine_scope', 'none'),
          coalesce(v_item -> 'actions', '[]'::jsonb),
          coalesce(v_item ->> 'source', 'proposal'),
          v_item_order,
          v_item ->> 'external_ref'
        )
        on conflict (template_category_id, external_ref) do update
          set label = excluded.label,
              description = excluded.description,
              interval_months = excluded.interval_months,
              interval_hours = excluded.interval_hours,
              engine_scope = excluded.engine_scope,
              actions = excluded.actions,
              source = excluded.source,
              sort_order = excluded.sort_order;
      end loop;
    end loop;
  end loop;
end;
$migration$;
`;

/** The SQL text for a given payload — the single source both the CLI and the test go through. */
export function buildTemplateMigration(json) {
  const payload = JSON.stringify(json, null, 2);
  if (payload.includes("$json$") || payload.includes("$migration$")) {
    throw new Error("payload collides with a dollar-quote tag");
  }
  return HEADER + BODY.replace("__PAYLOAD__", `\n${payload}\n`);
}

export function readSource() {
  return JSON.parse(readFileSync(SOURCE, "utf8"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sql = buildTemplateMigration(readSource());
  if (process.argv.includes("--check")) {
    const current = readFileSync(TARGET, "utf8");
    if (current !== sql) {
      console.error(`${TARGET} is stale — run: node scripts/gen-template-migration.mjs`);
      process.exit(1);
    }
    console.log("up to date");
  } else {
    writeFileSync(TARGET, sql);
    console.log(`wrote ${TARGET}`);
  }
}
