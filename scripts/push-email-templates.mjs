#!/usr/bin/env node
/**
 * Applies supabase/templates/*.html to the hosted Supabase project.
 *
 * `supabase config push` would do it — and would also push `site_url = "http://localhost:3000"`
 * and the local rate limits along with them, which is a good way to break production auth on a
 * Tuesday. This script PATCHes the twelve `mailer_*` fields and nothing else.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_… SUPABASE_PROJECT_REF=… node scripts/push-email-templates.mjs
 *
 * The token is a personal access token (Supabase → Account → Access Tokens); it never lands in
 * the repository. `--dry-run` prints what would be sent. Re-running is harmless: the payload is
 * the same as the files on disk, so the command is the way to redeploy after `pnpm gen:emails`.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TEMPLATE_DIR, TEMPLATES } from "./gen-email-templates.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = path.join(root, "supabase", "config.toml");
const API = "https://api.supabase.com";

/** The subject lives in config.toml so local and hosted read the same line. */
export function subjectsFromConfig(toml) {
  const subjects = {};
  for (const { key } of TEMPLATES) {
    const block = toml.match(
      new RegExp(`\\[auth\\.email\\.template\\.${key}\\][^[]*?subject\\s*=\\s*"([^"]*)"`),
    );
    if (!block) throw new Error(`config.toml has no subject for [auth.email.template.${key}]`);
    subjects[key] = block[1];
  }
  return subjects;
}

export function payload(toml, read) {
  const subjects = subjectsFromConfig(toml);
  const body = {};
  for (const template of TEMPLATES) {
    body[`mailer_subjects_${template.key}`] = subjects[template.key];
    body[`mailer_templates_${template.key}_content`] = read(template.file);
  }
  return body;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const ref = process.env.SUPABASE_PROJECT_REF;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const body = payload(readFileSync(CONFIG, "utf8"), (file) =>
    readFileSync(path.join(TEMPLATE_DIR, file), "utf8"),
  );

  if (dryRun) {
    for (const [field, value] of Object.entries(body)) {
      console.log(
        `${field}: ${value.length} chars${field.includes("subjects") ? ` — ${value}` : ""}`,
      );
    }
    return;
  }
  if (!ref || !token) {
    console.error("set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN (or pass --dry-run)");
    process.exit(1);
  }

  const res = await fetch(`${API}/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`PATCH config/auth ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  console.log(`${TEMPLATES.length} templates applied to ${ref}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
