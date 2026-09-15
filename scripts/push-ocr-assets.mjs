#!/usr/bin/env node
/**
 * Uploads the OCR language model to the project's `ocr-assets` bucket (D139, migration 0041).
 *
 *   pnpm ocr:push            # reads .env.local
 *   pnpm ocr:push --dry-run  # says what it would send
 *
 * The model is read by `src/lib/inbox/extract.ts` over `langPath`, so a deployment no longer
 * carries it. The copy in `src/lib/inbox/tessdata/` stays the source of truth: this script is
 * how it reaches Storage, and re-running it is harmless — the upload is an upsert on the path.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: the bucket is readable by
 * everyone and writable by no one but the service role, which never leaves the server (rule 2).
 * Run it once per project, and again only if the model is replaced.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const BUCKET = "ocr-assets";
/** Kept in the repository, served from Storage. `gzip: true` in extract.ts expects the `.gz`. */
export const ASSETS = [
  {
    from: path.join(root, "src", "lib", "inbox", "tessdata", "fra.traineddata.gz"),
    to: "fra.traineddata.gz",
    contentType: "application/gzip",
  },
];

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  for (const asset of ASSETS) {
    const body = readFileSync(asset.from);
    const target = `${url}/storage/v1/object/${BUCKET}/${asset.to}`;
    console.log(`${asset.to} — ${(body.length / 1024).toFixed(0)} Ko → ${target}`);
    if (dryRun) continue;

    const response = await fetch(target, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": asset.contentType,
        // Upsert: running this twice must not be an error, and replacing the model is a re-run.
        "x-upsert": "true",
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`upload failed (${response.status}): ${await response.text()}`);
    }
    console.log(`  ok — public at ${url}/storage/v1/object/public/${BUCKET}/${asset.to}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
