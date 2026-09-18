import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Le retour d'un « copier » (D146).
 *
 * Le presse-papiers ne dit rien : un tap qui a copié et un tap qui n'a rien fait se ressemblent.
 * `CopyButton` répond sous le doigt — la coche remplace le copieur, le bouton prend la teinte
 * verte, un anneau part une fois — et le toast dit la phrase. Rien de tout cela n'est visible à
 * la lecture d'un appel : un cinquième bouton écrit à la main passerait les revues sans que
 * personne remarque qu'il est muet. C'est ce que ces cas empêchent.
 *
 * Deux règles, donc : toute écriture dans le presse-papiers passe par le composant, et
 * l'animation reste neutralisée sous `prefers-reduced-motion` — un anneau qui part à chaque tap
 * est exactement ce que ce réglage demande de retirer.
 */
const SRC = join(process.cwd(), "src");
const COMPONENT = join(SRC, "components", "ui", "copy-button.tsx");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = walk(SRC).map((path) => ({
  path: relative(SRC, path).split(sep).join("/"),
  source: readFileSync(path, "utf8"),
}));

const component = readFileSync(COMPONENT, "utf8");
const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");

describe("retour visuel du copier", () => {
  it("ne laisse aucune écriture dans le presse-papiers hors de CopyButton", () => {
    const offenders = files
      .filter((file) => file.path !== "components/ui/copy-button.tsx")
      .filter((file) => /clipboard\s*\??\.\s*writeText/.test(file.source))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("se sert bien du composant quelque part", () => {
    const users = files.filter((file) => file.source.includes("<CopyButton"));
    expect(users.length).toBeGreaterThanOrEqual(4);
  });

  it("n'écrit jamais data-copied={false}, qui resterait sélectionné", () => {
    // `[data-copied]` matche l'attribut, pas sa valeur : `data-copied="false"` laisserait la
    // coche à l'écran pour toujours. React n'omet l'attribut que sur `undefined`.
    expect(component).toMatch(/data-copied=\{copied \|\| undefined\}/);
  });

  it("remet le bouton au repos, plutôt que d'en faire un état", () => {
    expect(component).toMatch(/setTimeout\(\(\) => setCopied\(false\), COPIED_MS\)/);
    expect(component).toMatch(/clearTimeout/);
  });

  it("neutralise l'animation sous prefers-reduced-motion", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    // L'échange devient instantané — deux icônes en fondu croisé dans la même cellule se
    // brouillent — et l'anneau ne part plus.
    expect(reduced).toMatch(/\.copy-swap\s*\{\s*--copy-swap-away:\s*1;/);
    expect(reduced).toMatch(/\.copy-swap\s*>\s*\*\s*\{\s*transition:\s*none;/);
    expect(reduced).toMatch(/\.copy-halo\s*\{\s*animation:\s*none;/);
  });
});
