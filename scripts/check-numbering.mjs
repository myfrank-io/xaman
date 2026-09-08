#!/usr/bin/env node
/**
 * Guards the hand-assigned numbers of docs/DECISIONS.md and docs/BACKLOG.md.
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
 * Three rules, and deliberately no more:
 *
 *   1. No number is defined twice. A definition is a `## <date> — D<n> : <title>` heading in
 *      DECISIONS.md or a `| D<n> |` leading cell in AUDIT.md, the two notations that open an
 *      entry. (Some older decisions are numbered mid-sentence inside a table row; those cannot be
 *      told apart from a citation, which is exactly why rules 2 and 3 read no notation at all.)
 *
 *   2. The counter leads the whole series: every `D<n>` written anywhere in the repository is
 *      below it. This is what catches a number taken without bumping the line, whatever notation
 *      it was written in — the new number has to appear *somewhere* to be worth anything.
 *
 *   3. Nothing dated on or after the day the counter appeared carries a number below the value it
 *      started at. Rule 2 guards the top of the series; this guards the bottom, where a number is
 *      not raced for but *re-taken*. That is not hypothetical: a branch opened before the counter
 *      existed took D81 for a new heading while D81 already named a table row, and merged —
 *      neither of the first two rules sees it, and the counter line cannot help, being an addition
 *      on one side only that git merges without a word. A branch that predates the rule cannot
 *      follow it; this is what makes it answer for it anyway.
 *
 * What it deliberately does not check: that a cited number resolves to a decision. Nothing here
 * could have caught boat-onboarding.ts quoting « D74 » for a sentence that belongs to D76 — that
 * number was defined, it just meant something else. Only reading catches that.
 *
 * Ticket numbers in BACKLOG.md have the same disease and get the same cure, with one difference:
 * they are numbered per epic, so the counter is a table with one row per epic rather than a single
 * line. Two branches adding a ticket to the same epic write the same row and collide; two branches
 * working different epics do not, which is right — they were never going to collide. Two rules
 * there, and rule 1 is complete on its own because a ticket has exactly one notation: the
 * `- [x] **E13-10** …` list item. There is no legacy notation to be ambiguous about, so no third
 * rule is needed.
 *
 * Usage: node scripts/check-numbering.mjs   (exit 1 and a report on failure)
 * `tests/unit/numbering.test.ts` runs the same functions.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DECISIONS = path.join("docs", "DECISIONS.md");
export const AUDIT = path.join("docs", "AUDIT.md");
export const BACKLOG = path.join("docs", "BACKLOG.md");

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
      date,
      where: `${DECISIONS} — ${date}`,
      title,
    })),
    // AUDIT.md rows are the 2 September consolidation and carry no date of their own. An empty
    // one sorts below every real date, so rule 3 never looks at them.
    ...matches(AUDIT_ROW, audit).map(([, n, title]) => ({
      number: Number(n),
      date: "",
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

/**
 * The day the counter line appeared, and the value it started at. Every decision written from
 * that day on takes its number from the line, and the line only ever grows — so a lower number on
 * a later entry means the line was not read.
 */
export const SERIES_START = { date: "2026-09-08", number: 85 };

/** Rule 3, over the entries alone. */
export function reuseFailures(entries, start = SERIES_START) {
  return entries
    .filter((entry) => entry.date >= start.date && entry.number < start.number)
    .sort((a, b) => a.number - b.number)
    .map(
      (entry) =>
        `D${entry.number} ouvre « ${entry.title} », datée du ${entry.date}, alors que la série est ` +
        `passée au compteur le ${start.date} à D${start.number} : ce numéro appartient déjà à une ` +
        `entrée plus ancienne. Prendre celui qu'annonce la ligne « Prochain numéro ».`,
    );
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

/**
 * `- [x] **E13-10** Moteur sans compteur…` — the one and only way BACKLOG.md opens a ticket. The
 * « Retirés » list writes `- E4-8 …` without a checkbox, and the milestone table names lots, not
 * tickets; neither is a definition and neither matches this.
 */
const TICKET = /^- \[[ x~]\] \*\*(E(\d+)-\d+[a-z]?)(?:\s*\([^)]*\))?\*{0,2}\s*(.{0,60})/gm;

/** `| E13 | E13-17 |` — one row per epic, so only branches touching the same epic collide. */
const TICKET_COUNTER = /^\| (E\d+) \| (E\d+-\d+) \|$/gm;

/** Every ticket the backlog defines, with the epic it belongs to. */
export function tickets(root = ROOT) {
  const text = readFileSync(path.join(root, BACKLOG), "utf8");
  return matches(TICKET, text).map(([, id, epic, title]) => ({
    id,
    epic: `E${epic}`,
    number: Number(id.split("-")[1].replace(/[a-z]$/, "")),
    title: title.replace(/\*+/g, "").trim(),
  }));
}

/** The per-epic counter table, as a map of epic → the number the next ticket must take. */
export function ticketCounters(root = ROOT) {
  const text = readFileSync(path.join(root, BACKLOG), "utf8");
  const rows = new Map();
  for (const [, epic, next] of matches(TICKET_COUNTER, text)) {
    if (rows.has(epic)) {
      throw new Error(`${BACKLOG} porte deux lignes de compteur pour ${epic}.`);
    }
    rows.set(epic, Number(next.split("-")[1]));
  }
  if (rows.size === 0) {
    throw new Error(`${BACKLOG} ne porte aucune ligne « | Exx | Exx-n | » de compteur.`);
  }
  return rows;
}

/** Ticket rule 1: an identifier opens one ticket, never two. */
export function ticketDuplicateFailures(all) {
  const byId = new Map();
  for (const ticket of all) {
    if (!byId.has(ticket.id)) byId.set(ticket.id, []);
    byId.get(ticket.id).push(ticket);
  }
  return [...byId]
    .filter(([, found]) => found.length > 1)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([id, found]) => {
      const list = found.map((t) => `« ${t.title}… »`).join(" et ");
      return `${id} nomme ${found.length} tickets dans ${BACKLOG} : ${list}.`;
    });
}

/**
 * Ticket rule 2: every epic that has tickets has a counter row, and that row leads it. The first
 * half is what keeps the table complete — open a new epic and the check asks for its row, which is
 * exactly the moment to think about it.
 */
export function ticketCounterFailures(all, counters) {
  const highest = new Map();
  for (const ticket of all) {
    if (!(highest.get(ticket.epic) >= ticket.number)) highest.set(ticket.epic, ticket.number);
  }
  const failures = [];
  for (const [epic, max] of [...highest].sort((a, b) => a[0].localeCompare(b[0]))) {
    const next = counters.get(epic);
    if (next === undefined) {
      failures.push(
        `L'épique ${epic} a des tickets mais aucune ligne « | ${epic} | ${epic}-${max + 1} | » ` +
          `dans le tableau des prochains numéros de ${BACKLOG}.`,
      );
    } else if (next <= max) {
      failures.push(
        `${epic} annonce ${epic}-${next} comme prochain numéro alors que ${epic}-${max} est déjà ` +
          `pris : prendre un numéro, c'est aussi incrémenter sa ligne.`,
      );
    }
  }
  return failures;
}

/** Every rule against the working tree. One sentence per failure, so a report lists them all. */
export function check(root = ROOT) {
  const entries = definitions(root);
  const all = tickets(root);
  return [
    ...duplicateFailures(entries),
    ...reuseFailures(entries),
    ...counterFailures(counter(root), mentions(root)),
    ...ticketDuplicateFailures(all),
    ...ticketCounterFailures(all, ticketCounters(root)),
  ];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const failures = check();
  if (failures.length > 0) {
    console.error(`${failures.length} problème(s) de numérotation :\n`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  const epics = ticketCounters().size;
  console.log(
    `Numérotation : rien à signaler (prochaine décision D${counter()}, ${epics} épiques suivies).`,
  );
}
