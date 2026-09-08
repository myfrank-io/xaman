// Which message namespaces a route actually needs on the client.
//
// `NextIntlClientProvider` serialises whatever it is given into the RSC payload of every page
// under it. Given nothing, it inherits the whole of `fr.json` — 88 KB of JSON, most of it for
// screens the reader is not on. Slicing it by hand is easy to get wrong in the dangerous
// direction: a namespace forgotten here does not fail the build, it throws `MISSING_MESSAGE`
// on a screen someone opens at sea.
//
// So the slices are declared in the code and *verified* against this scan, which walks the
// import graph from each route's entry files, crosses the client boundary, and collects the
// namespaces the client modules ask for. `tests/unit/i18n-slices.test.ts` fails when a slice
// no longer covers its route.

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EXTENSIONS = [".ts", ".tsx"];

/** `useTranslations("logs.form")` — the namespace is a literal, which is the normal case. */
const SCOPED = /useTranslations\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
/** `useTranslations()` or `useTranslations(entity.namespace)`: the scope is not a literal. */
const UNSCOPED = /useTranslations\(\s*(?:\)|[^"'`)])/;
/** A dotted key as it is written in a call: `common.save`, `errors.unknown`, `parts.delete`. */
const DOTTED = /["'`]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)["'`]/g;
const IMPORT =
  /(?:from\s*["']([^"']+)["'])|(?:\bimport\s*\(\s*["']([^"']+)["']\s*\))|(?:\brequire\(\s*["']([^"']+)["']\s*\))/g;

function isClientModule(source) {
  return /^\s*(["'])use client\1/.test(source);
}

export function messageNamespaces(root = ROOT) {
  return new Set(
    Object.keys(JSON.parse(readFileSync(path.join(root, "src/messages/fr.json"), "utf8"))),
  );
}

/** Resolve a local specifier to a file on disk; anything else (a package) resolves to null. */
function resolve(specifier, fromFile, src) {
  let base;
  if (specifier.startsWith("@/")) base = path.join(src, specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  for (const extension of EXTENSIONS) {
    const candidate = `${base}${extension}`;
    if (exists(candidate)) return candidate;
  }
  for (const extension of EXTENSIONS) {
    const candidate = path.join(base, `index${extension}`);
    if (exists(candidate)) return candidate;
  }
  return exists(base) && statSync(base).isFile() ? base : null;
}

function exists(candidate) {
  try {
    statSync(candidate);
    return true;
  } catch {
    return false;
  }
}

/** The namespaces one module asks for, given the set of namespaces that exist. */
function namespacesIn(source, known) {
  const found = new Set();
  for (const [, scope] of source.matchAll(SCOPED)) {
    const root = scope.split(".")[0];
    if (known.has(root)) found.add(root);
  }
  // An unscoped or computed `useTranslations` resolves keys this scan cannot follow, so every
  // dotted literal in the module counts. It over-collects on purpose: a slice that is too wide
  // costs bytes, one that is too narrow costs a broken screen.
  if (UNSCOPED.test(source)) {
    for (const [, key] of source.matchAll(DOTTED)) {
      const root = key.split(".")[0];
      if (known.has(root)) found.add(root);
    }
  }
  return found;
}

/**
 * Walk the import graph from `entries` and collect the namespaces every client module needs.
 * A module is client code once a `"use client"` file has been crossed: from there down, its
 * translations are read from the provider rather than from the server config.
 */
export function namespacesFrom(entries, { root = ROOT, known = messageNamespaces(root) } = {}) {
  const src = path.join(root, "src");
  const found = new Set();
  // A file can be reached both as server code and as client code; only the second collects.
  const seen = new Set();
  const stack = entries.map((entry) => ({ file: path.resolve(root, entry), client: false }));

  while (stack.length > 0) {
    const { file, client } = stack.pop();
    const key = `${client ? "c" : "s"}:${file}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let source;
    try {
      source = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const isClient = client || isClientModule(source);
    if (isClient) for (const namespace of namespacesIn(source, known)) found.add(namespace);

    for (const match of source.matchAll(IMPORT)) {
      const specifier = match[1] ?? match[2] ?? match[3];
      if (!specifier) continue;
      const target = resolve(specifier, file, src);
      if (target) stack.push({ file: target, client: isClient });
    }
  }
  return found;
}

/** Every route file under a directory: the pages, layouts and boundaries Next renders. */
export function routeEntries(directory, root = ROOT) {
  const base = path.join(root, directory);
  if (!exists(base)) return [];
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return walk(full);
      return /^(page|layout|loading|template|error|not-found|global-error|default)\.tsx?$/.test(
        name,
      )
        ? [path.relative(root, full)]
        : [];
    });
  return walk(base);
}
