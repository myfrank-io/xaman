#!/usr/bin/env node
/**
 * Drops from the build's trace files what no Node runtime ever opens (D139).
 *
 * Vercel assembles each serverless function from `.next/server/**\/*.nft.json`: every path
 * listed there is copied into the function, and every copy is stored again on every deployment.
 * The tracer is deliberately generous — it follows a `sourceMappingURL`, and it keeps every
 * branch of a `require` it cannot decide — so two kinds of file travel for nothing:
 *
 *   * `node_modules/**\/*.map` — pdf.js alone ships a 5,2 Mo source map, larger than the 2,3 Mo
 *     of code it maps. Node does not read one unless it is started with `--enable-source-maps`,
 *     which no serverless runtime does. Our own maps are left alone.
 *   * `tesseract-core-*.wasm.js` — 3,7 Mo each, the browser's single-file build of the OCR
 *     engine. In Node, `tesseract.js-core`'s loader requires the small `.js` beside them, which
 *     reads the `.wasm` from the file system; these are only *named* by tesseract.js when it
 *     builds a URL for a browser, which is enough for the tracer to keep them.
 *
 * `outputFileTracingExcludes` would be the place for this, but Turbopack's own implementation of
 * it leaves both files in the trace (the includes it honours, the excludes it ignores), so the
 * trace is trimmed here instead — after `next build`, before Vercel reads it.
 *
 * Nothing is deleted from disk: only the list of what gets copied into a function changes.
 */
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_DIR = path.join(root, ".next", "server");

/** What is dropped, matched on the resolved path. */
export const DEAD_WEIGHT = [
  (file) => file.includes(`${path.sep}node_modules${path.sep}`) && file.endsWith(".map"),
  (file) => /tesseract-core[\w-]*\.wasm\.js$/.test(file),
];

export const isDeadWeight = (file) => DEAD_WEIGHT.some((rule) => rule(file));

async function traceFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await traceFiles(full)));
    else if (entry.name.endsWith(".nft.json")) out.push(full);
  }
  return out;
}

async function main() {
  const traces = await traceFiles(SERVER_DIR).catch(() => []);
  if (traces.length === 0) {
    throw new Error(`no trace file under ${SERVER_DIR} — run \`next build\` first`);
  }

  let dropped = 0;
  let freed = 0;
  const sizes = new Map();

  for (const trace of traces) {
    const content = JSON.parse(await readFile(trace, "utf8"));
    const base = path.dirname(trace);
    const kept = [];
    for (const file of content.files) {
      const resolved = path.resolve(base, file);
      if (!isDeadWeight(resolved)) {
        kept.push(file);
        continue;
      }
      if (!sizes.has(resolved)) {
        sizes.set(
          resolved,
          await stat(resolved)
            .then((s) => s.size)
            .catch(() => 0),
        );
      }
      freed += sizes.get(resolved);
      dropped += 1;
    }
    if (kept.length !== content.files.length) {
      await writeFile(trace, JSON.stringify({ ...content, files: kept }));
    }
  }

  console.log(
    `trace: ${dropped} copies retirées des ${traces.length} fonctions — ${(freed / 1048576).toFixed(1)} Mo de moins par déploiement`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
