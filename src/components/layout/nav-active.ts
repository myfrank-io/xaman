import { importSection } from "@/components/layout/breadcrumb-trail";
import { BOAT_ROUTES } from "@/lib/queries/boat-routes";

/**
 * Does a menu entry own the screen at `pathname`? Pure, so the rule is testable without a
 * router — it decides which of the four tabs lights up, and « où suis-je » has no other answer.
 *
 * Two screens have no entry of their own and must still light one up:
 *
 * - « Sorties de l'eau » is the third tab of the Journal (D9). It left the menu but kept a path
 *   of its own, so without this the whole bar goes dark on a screen people reach from the
 *   Journal — the tab strip says « Sorties de l'eau », the bar says nothing, and the screen
 *   reads as having left the section it belongs to.
 * - The import screen names its list in `?entity=`, not in the path (see IMPORT_SECTIONS).
 */
export function isNavActive(pathname: string, href: string, entity?: string | null): boolean {
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;

  const logs = `/${BOAT_ROUTES.logs}`;
  if (href.endsWith(logs)) {
    const haulOuts = `${href.slice(0, -logs.length)}/${BOAT_ROUTES.haulOuts}`;
    if (pathname === haulOuts || pathname.startsWith(`${haulOuts}/`)) return true;
  }

  if (!pathname.endsWith("/import")) return false;
  const owner = importSection(entity);
  return owner ? href.endsWith(`/${BOAT_ROUTES[owner.nav]}`) : false;
}
