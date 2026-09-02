import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // RLS tests need a database: DATABASE_URL (supabase start → postgresql://postgres:postgres@127.0.0.1:54322/postgres)
    testTimeout: 20_000,
    // the database-backed suites (RLS, seed) share one Postgres: run files one at a time
    fileParallelism: false,
  },
});
