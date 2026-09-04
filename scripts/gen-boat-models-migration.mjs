#!/usr/bin/env node
/**
 * Regenerates supabase/migrations/0020_boat_models_catalogue.sql from seed/boat-models.json.
 *
 * Same reasoning as scripts/gen-template-migration.mjs: the catalogue has to reach production, and
 * production never runs `pnpm seed:xaman` — that script carries Xaman's own data and needs a
 * database password. So the catalogue ships as a migration, and the JSON stays the file a human
 * edits. `tests/unit/boat-models-migration.test.ts` fails if the committed SQL no longer matches
 * it, so the two cannot drift.
 *
 * Usage: node scripts/gen-boat-models-migration.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE = path.join(root, "seed", "boat-models.json");
export const TARGET = path.join(root, "supabase", "migrations", "0020_boat_models_catalogue.sql");

const BOAT_TYPES = ["catamaran", "trimaran", "monohull_sail", "motor", "rib", "other"];

/** 'Bénéteau' + 'Oceanis 40.1' → 'beneteau-oceanis-40-1'. Stable: it is the upsert key. */
export function externalRef(builder, model) {
  return `${builder} ${model}`
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Everything the table's constraints would catch, caught here instead — a migration that fails
 * halfway through a production deploy is a much worse place to learn that two rows collide.
 */
export function validate(models) {
  const refs = new Set();
  const identities = new Set();
  for (const [i, m] of models.entries()) {
    const where = `models[${i}] (${m.builder} ${m.model})`;
    if (!m.builder?.trim()) throw new Error(`${where}: builder is required`);
    if (!m.model?.trim()) throw new Error(`${where}: model is required`);
    if (!BOAT_TYPES.includes(m.boatType)) throw new Error(`${where}: boatType ${m.boatType}`);
    if (m.model.toLowerCase().startsWith(m.builder.toLowerCase())) {
      throw new Error(`${where}: model repeats the builder`);
    }
    const ref = externalRef(m.builder, m.model);
    if (refs.has(ref)) throw new Error(`${where}: duplicate external_ref ${ref}`);
    refs.add(ref);
    const identity = `${m.builder.trim()}|${m.model.trim()}`;
    if (identities.has(identity)) throw new Error(`${where}: duplicate (builder, model)`);
    identities.add(identity);
    if (m.yearFrom && m.yearTo && m.yearTo < m.yearFrom)
      throw new Error(`${where}: years reversed`);
    for (const field of ["lengthM", "beamM", "draftM"]) {
      const value = m[field];
      if (value === null || value === undefined) continue;
      if (typeof value !== "number" || value <= 0 || value > 999) {
        throw new Error(`${where}: ${field} = ${value}`);
      }
    }
  }
  return models;
}

const HEADER = `-- 0020_boat_models_catalogue.sql — the models themselves.
--
-- Generated from seed/boat-models.json by scripts/gen-boat-models-migration.mjs.
-- Do not edit by hand: edit the JSON and re-run the script (tests/unit/boat-models-migration.test.ts
-- fails if the two drift).
--
-- 0019 explains why this catalogue is ours to keep. This is its first load: production models one
-- actually meets in the Mediterranean, so that someone typing « Ocea » is offered « Oceanis 40.1 »
-- instead of typing the whole thing and its dimensions by hand.
--
-- On the numbers: they are indicative and often absent on purpose. Each row was written twice,
-- independently, and a dimension the two passes did not agree on to within 25 to 35 cm was left
-- null rather than averaged into a plausible lie. A null here costs one field someone fills in
-- themselves; a wrong value silently pre-fills the wrong hull.
--
-- Idempotent on external_ref: re-running corrects a row in place. A model removed from the JSON is
-- deactivated, never deleted — \`boats\` copies these values rather than referencing them, so a
-- retired row has no dependents, but keeping it makes the history of the catalogue readable.
`;

const BODY = `
do $migration$
declare
  v_payload jsonb := $json$__PAYLOAD__$json$;
  v_model jsonb;
  v_refs text[] := '{}';
begin
  for v_model in select * from jsonb_array_elements(v_payload -> 'models')
  loop
    v_refs := v_refs || (v_model ->> 'external_ref');
    insert into public.boat_models (
      external_ref, builder, model, boat_type, year_from, year_to, length_m, beam_m, draft_m, is_active
    )
    values (
      v_model ->> 'external_ref',
      v_model ->> 'builder',
      v_model ->> 'model',
      (v_model ->> 'boat_type')::public.boat_type,
      (v_model ->> 'year_from')::int,
      (v_model ->> 'year_to')::int,
      (v_model ->> 'length_m')::numeric,
      (v_model ->> 'beam_m')::numeric,
      (v_model ->> 'draft_m')::numeric,
      true
    )
    on conflict (external_ref) do update
      set builder = excluded.builder,
          model = excluded.model,
          boat_type = excluded.boat_type,
          year_from = excluded.year_from,
          year_to = excluded.year_to,
          length_m = excluded.length_m,
          beam_m = excluded.beam_m,
          draft_m = excluded.draft_m,
          is_active = true;
  end loop;

  update public.boat_models set is_active = false
  where is_active and not (external_ref = any (v_refs));
end;
$migration$;
`;

/** The SQL text for a given payload — the single source both the CLI and the test go through. */
export function buildCatalogueMigration(json) {
  const models = validate(json.models ?? []);
  const rows = models.map((m) => ({
    external_ref: externalRef(m.builder, m.model),
    builder: m.builder.trim(),
    model: m.model.trim(),
    boat_type: m.boatType,
    year_from: m.yearFrom ?? null,
    year_to: m.yearTo ?? null,
    length_m: m.lengthM ?? null,
    beam_m: m.beamM ?? null,
    draft_m: m.draftM ?? null,
  }));
  const payload = JSON.stringify({ models: rows }, null, 2);
  if (payload.includes("$json$") || payload.includes("$migration$")) {
    throw new Error("payload collides with a dollar-quote tag");
  }
  return HEADER + BODY.replace("__PAYLOAD__", `\n${payload}\n`);
}

export function readSource() {
  return JSON.parse(readFileSync(SOURCE, "utf8"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sql = buildCatalogueMigration(readSource());
  if (process.argv.includes("--check")) {
    const current = readFileSync(TARGET, "utf8");
    if (current !== sql) {
      console.error(`${TARGET} is stale — run: node scripts/gen-boat-models-migration.mjs`);
      process.exit(1);
    }
    console.log("up to date");
  } else {
    writeFileSync(TARGET, sql);
    console.log(`wrote ${TARGET} (${readSource().models.length} models)`);
  }
}
