#!/usr/bin/env node
/**
 * Guards the numbering of docs/DECISIONS.md.
 *
 * Why this exists: three decisions had to be renumbered in one day, and D43, D73 and D74 each
 * ended up naming two different decisions on `main`. The cause was structural — the number was
 * chosen by scanning a 1 500-line document on a branch, against a `main` that kept moving, so two
 * branches read the same « next free » number and only found out when both had merged. By then
 * the number was quoted in migrations, tests and Server Actions, and `// D73` in permissions.ts
 * pointed at a different decision than `// D73` in EnginesTab.tsx.
 *
 * The fix is the counter line at the top of DECISIONS.md: one line, so two branches taking the
 * same number both rewrite it and the second merge stops on a git conflict. This file is what
 * makes the line trustworthy — a counter nobody checks drifts on the first commit that forgets it.
 *
 * Two rules, and deliberately no more:
 *
 *   1. No number is defined twice. A definition is a `## <date> — D<n> : <title>` heading in
 *      DECISIONS.md or a `| D<n> |` leading cell in AUDIT.md, the two notations that open an
 *      entry. (Some older decisions are numbered mid-sentence inside a table row; those cannot be
 *      told apart from a citation, which is exactly why rule 2 does not read notation at all.)
 *
 *   2. The counter leads the whole series: every `D<n>` written anywhere in the repository is
 *      below it. This is what catches a number taken without bumping the line, whatever notation
 *      it was written in — the new number has to appear *somewhere* to be worth anything.
 *
 * What it deliberately does not check: that a cited number resolves to a decision. Nothing here
 * could have caught boat-onboarding.ts quoting « D74 » for a sentence that belongs to D76 — that
 * number was defined, it just meant something else. Only reading catches that.
 *
 * Usage: node scripts/check-decisions.mjs   (exit 1 and a report on failure)
 * `tests/unit/decisions.test.ts` runs the same functions.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DECISIONS = path.join("docs", "DECISIONS.md");
export const AUDIT = path.join("docs", "AUDIT.md");

/** The counter, as written at the top of DECISIONS.md. */
const COUNTER = /\*\*Prochain numéro : D(\d+)\.\*\*/g;

/** `## 2026-09-07 — D73 : un moteur peut…` — how DECISIONS.md opens an entry. */
const HEADING = /^## (\d{4}-\d{2}-\d{2}) — D(\d+) : (.+)$/gm;

/** `| D19 | **Un seul « + »…` — how AUDIT.md opens one. */
const AUDIT_ROW = /^\| D(\d+) \| (.+?) \|/gm;

/**
 * Any mention of a decision number.
 *
 * The leading `[^"'\w]` guard skips a number inside a string literal: `model: "D100"` in
 * src/app/dev/ui/boat/sample.ts is a boat model, not decision 100, and without the guard the
 * counter would be held hostage above it. A citation is never quoted — it lives in prose or in a
 * comment, which is also why this very sentence may not write one out in full.
 */
const MENTION = /(?:^|[^"'\w])D(\d{1,3})\b/gm;

/** Files worth scanning: everything git tracks except lockfiles, binaries and screenshots. */
const SCANNED = /\.(md|ts|tsx|mts|mjs|js|sql|json|yml|yaml|css)$/;
const SKIPPED = /^(pnpm-lock\.yaml|docs\/audit\/|public\/|\.next\/)/;

export function scannedFiles(root = ROOT) {
  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  return tracked
    .split("\0")
    .filter(Boolean)
    .filter((file) => SCANNED.test(file) && !SKIPPED.test(file));
}

const matches = (re, text) => [...text.matchAll(re)];

/** The number the next decision must take, from the single line that carries it. */
export function counter(root = ROOT) {
  const text = readFileSync(path.join(root, DECISIONS), "utf8");
  const found = matches(COUNTER, text);
  if (found.length !== 1) {
    throw new Error(
      `${DECISIONS} doit porter exactement une ligne « **Prochain numéro : Dxx.** » (${found.length} trouvée(s)).`,
    );
  }
  return Number(found[0][1]);
}

/** Every number that opens an entry, with where it opens it. */
export function definitions(root = ROOT) {
  const decisions = readFileSync(path.join(root, DECISIONS), "utf8");
  const audit = readFileSync(path.join(root, AUDIT), "utf8");
  return [
    ...matches(HEADING, decisions).map(([, date, n, title]) => ({
      number: Number(n),
      where: `${DECISIONS} — ${date}`,
      title,
    })),
    ...matches(AUDIT_ROW, audit).map(([, n, title]) => ({
      number: Number(n),
      where: AUDIT,
      title: title.trim(),
    })),
  ];
}

/** Every number written anywhere, so the counter can be compared to reality. */
export function mentions(root = ROOT) {
  const found = new Map();
  for (const file of scannedFiles(root)) {
    // The counter announces the number nobody has taken yet: it is the one mention that must not
    // count against itself.
    const text = readFileSync(path.join(root, file), "utf8").replace(COUNTER, "");
    for (const [, n] of matches(MENTION, text)) {
      const number = Number(n);
      if (!found.has(number)) found.set(number, new Set());
      found.get(number).add(file);
    }
  }
  return found;
}

/** Rule 1, over the entries alone, so a test can feed it a collision without staging one. */
export function duplicateFailures(entries) {
  const byNumber = new Map();
  for (const entry of entries) {
    if (!byNumber.has(entry.number)) byNumber.set(entry.number, []);
    byNumber.get(entry.number).push(entry);
  }
  return [...byNumber]
    .sort((a, b) => a[0] - b[0])
    .filter(([, found]) => found.length > 1)
    .map(([number, found]) => {
      const list = found.map((e) => `« ${e.title} » (${e.where})`).join(" et ");
      return `D${number} nomme ${found.length} décisions : ${list}.`;
    });
}

/** Rule 2, over the mentions alone. */
export function counterFailures(next, written) {
  return [...written.keys()]
    .filter((number) => number >= next)
    .sort((a, b) => a - b)
    .map(
      (number) =>
        `D${number} est écrit dans ${[...written.get(number)].sort().join(", ")}, mais le compteur ` +
        `de ${DECISIONS} en est encore à D${next} : prendre un numéro, c'est aussi incrémenter cette ligne.`,
    );
}

/** Both rules against the working tree. One sentence per failure, so a report lists them all. */
export function check(root = ROOT) {
  return [
    ...duplicateFailures(definitions(root)),
    ...counterFailures(counter(root), mentions(root)),
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = check();
  if (failures.length > 0) {
    console.error(`${failures.length} problème(s) de numérotation :\n`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`Numérotation des décisions : rien à signaler (prochain numéro D${counter()}).`);
}
