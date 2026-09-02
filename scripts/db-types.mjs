#!/usr/bin/env node
// Generates src/types/database.ts from a live Postgres WITHOUT Docker, using postgres-meta —
// the same generator the Supabase CLI runs inside its container (`pnpm db:types`).
// Usage: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm db:types:url
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error(
    "DATABASE_URL is required (e.g. postgresql://postgres:postgres@127.0.0.1:54322/postgres)",
  );
  process.exit(1);
}

function resolveServer() {
  try {
    return require.resolve("@supabase/postgres-meta/dist/server/server.js");
  } catch {
    const local = path.resolve("node_modules/@supabase/postgres-meta/dist/server/server.js");
    if (existsSync(local)) return local;
    throw new Error(
      "@supabase/postgres-meta is not installed (pnpm add -D @supabase/postgres-meta)",
    );
  }
}

async function waitFor(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`postgres-meta did not start (${url})`);
}

const port = 1337 + Math.floor(Math.random() * 1000);
const child = spawn(process.execPath, [resolveServer()], {
  env: {
    ...process.env,
    PG_META_DB_URL: dbUrl,
    PG_META_PORT: String(port),
    PG_META_HOST: "127.0.0.1",
  },
  stdio: "ignore",
});

try {
  await waitFor(`http://127.0.0.1:${port}/health`);
  const res = await fetch(
    `http://127.0.0.1:${port}/generators/typescript?included_schemas=public&detect_one_to_one_relationships=true`,
  );
  if (!res.ok) throw new Error(`postgres-meta responded ${res.status}`);
  const out = path.resolve("src/types/database.ts");
  await writeFile(out, await res.text());
  console.log(`wrote ${out}`);
} finally {
  child.kill();
}
