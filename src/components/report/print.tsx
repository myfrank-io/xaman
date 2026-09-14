/**
 * Ce qui fait qu'une page s'imprime (E9-2b, puis E18-5).
 *
 * Le rapport d'état et la liste qu'on emmène au bateau sont deux documents pour deux lecteurs —
 * un assureur, un acheteur ou un expert d'un côté, soi-même ou le chantier de l'autre. Ils n'ont
 * ni le même contenu ni le même titre, mais **une seule mise en page** : même colonne, mêmes
 * titres de section, mêmes tableaux, même comportement au moment d'imprimer.
 *
 * D'où ce fichier : E18-5 demandait de réutiliser le rapport plutôt que d'en dessiner un second,
 * et ces quatre primitives sont exactement ce qu'il y avait à partager.
 */

export const table = "w-full border-collapse text-sm";
export const th =
  "border-b border-border py-2 pr-3 text-left text-caption font-semibold text-ink-2 uppercase";
export const td = "border-b border-border py-2 pr-3 align-top";
export const num = "num text-right whitespace-nowrap";

/**
 * A table wide enough to be a table cannot also fit a 320 px phone. It scrolls inside its own
 * box rather than dragging the whole page sideways, and `print:overflow-visible` keeps the
 * paper version whole — printing is what these screens are for.
 */
export function Scroller({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 print:mx-0 print:overflow-visible print:px-0">
      {children}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 break-inside-avoid flex-col gap-3">
      <h2 className="text-h2">{title}</h2>
      {children}
    </section>
  );
}
