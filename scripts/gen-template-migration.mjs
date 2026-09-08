#!/usr/bin/env node
/**
 * Regenerates supabase/migrations/0025_generic_templates_v2.sql from seed/generic-checklists.json.
 *
 * 0016 was the first edition of the same registry and has run in production: it is frozen, and a
 * content change lands as a fresh migration carrying the whole payload (the upsert makes that
 * safe — same external_ref keys, wording updated in place, nothing duplicated). When the content
 * changes again, bump TARGET to the next free number rather than rewriting a migration that has
 * already been applied.
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
export const TARGET = path.join(root, "supabase", "migrations", "0025_generic_templates_v2.sql");

const HEADER = `-- 0025_generic_templates_v2.sql — the model registry, second edition (D83).
--
-- Generated from seed/generic-checklists.json by scripts/gen-template-migration.mjs.
-- Do not edit by hand: edit the JSON and re-run the script (tests/unit/template-migration.test.ts
-- fails if the two drift). 0016 carried the first edition and stays as it ran.
--
-- What changed since 0016, all of it asked for by the first motor-boat owner to try the app:
--
--   * a fourth model, « Semi-rigide — modèle générique »: six systems, sixty-odd points, and
--     nothing a boat you tow on a trailer does not have — no shaft line, no generator, no
--     toilets; a « Remorque » system instead;
--   * the drive-specific points say which drive (engine_scope shaft / saildrive / sterndrive /
--     jet, matched on engines.propulsion by 0024), so a Z-drive's bellows never land on a shaft
--     line and a saildrive boot never on an outboard;
--   * detailed outboard points (gear oil, plugs, impeller, anodes…) on the motor and semi-rigide
--     models, where a single « révision du hors-bord » was hiding a real list;
--   * zone_scope = offshore on liferaft, EPIRB, AIS, radar, watermaker and the MMSI licence: a
--     coastal boat (boats.navigation_zone) is not asked about them.
--
-- Idempotent, on the same external_ref keys 0016 and scripts/seed.mts upsert on: rows already
-- there are updated in place, new ones added, none duplicated. A boat already instantiated from
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
          engine_scope, zone_scope, actions, source, sort_order, external_ref
        )
        values (
          v_category_id,
          v_item ->> 'label',
          v_item ->> 'description',
          (v_item ->> 'interval_months')::int,
          (v_item ->> 'interval_hours')::int,
          coalesce(v_item ->> 'engine_scope', 'none'),
          coalesce(v_item ->> 'zone_scope', 'all'),
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
              zone_scope = excluded.zone_scope,
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
