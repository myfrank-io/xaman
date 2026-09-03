import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A Server Component may import a *component* from a `"use client"` module — that is what the
 * client boundary is for — but never a plain value. At build time the other exports of such a
 * module become client-reference proxies, so an array arrives as an object: production throws
 * `BOAT_TABS.includes is not a function` where development worked. It cost one broken screen
 * on the boat tab; this test makes the mistake impossible to ship twice.
 *
 * Types are free to cross (they are erased), and so are components: the rule below only fires
 * on a value import whose name is not PascalCase.
 */
const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

function isClientModule(source: string): boolean {
  return /^\s*(["'])use client\1/.test(source);
}

const files = walk(SRC).map((path) => ({ path, source: readFileSync(path, "utf8") }));
const clientModules = new Map(
  files
    .filter((file) => isClientModule(file.source))
    .map((file) => [
      `@/${relative(SRC, file.path)
        .split(sep)
        .join("/")
        .replace(/\.tsx?$/, "")}`,
      file.path,
    ]),
);

const IMPORT = /import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g;

describe("client boundary", () => {
  it("has client modules to check", () => {
    expect(clientModules.size).toBeGreaterThan(10);
  });

  it('no server module imports a value from a "use client" module', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (isClientModule(file.source)) continue;
      for (const match of file.source.matchAll(IMPORT)) {
        const [, names, specifier] = match;
        if (!specifier || !clientModules.has(specifier)) continue;
        for (const raw of (names ?? "").split(",")) {
          const spec = raw.trim();
          if (!spec || spec.startsWith("type ")) continue;
          const name = (spec.split(" as ")[0] ?? "").trim();
          // A React component is a legitimate client reference; anything else is a value.
          const isComponent = /^[A-Z][a-zA-Z0-9]*$/.test(name) && name !== name.toUpperCase();
          if (name && !isComponent) {
            offenders.push(`${relative(SRC, file.path)} imports ${name} from ${specifier}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
