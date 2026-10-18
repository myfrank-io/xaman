/**
 * Où atterrit quelqu'un qui arrive sur « ses bateaux » (D64, étendu D155).
 *
 * D64 posait : un bateau → son tableau de bord, plusieurs → le sélecteur. Mais quelqu'un qui gère
 * plusieurs bateaux (l'admin plateforme, un propriétaire de flotte) retombait sur ce sélecteur à
 * **chaque** connexion, obligé de choisir avant de rien voir — « une grosse erreur » côté usage.
 *
 * D155 : on n'impose plus de choix. Avec plusieurs bateaux on va droit au **dernier ouvert** (gardé
 * dans un cookie posé par `src/proxy.ts` à chaque visite d'un bateau), à défaut le premier de la
 * liste. Le sélecteur ne s'affiche plus que lorsqu'on le demande explicitement — le « Changer de
 * bateau » du menu compte, qui passe `?switch=1`. Personne n'est jamais coincé : l'écran reste
 * accessible, il n'est juste plus le passage obligé.
 *
 * Fonction pure, séparée de la page, pour que la décision soit testable sans redirection ni RLS.
 */
export const LAST_BOAT_COOKIE = "xaman.boat";

export type BoatLanding = { kind: "new" } | { kind: "picker" } | { kind: "boat"; boatId: string };

export function boatLandingTarget(
  /** Les ids des bateaux accessibles, déjà filtrés par la RLS, dans l'ordre d'affichage. */
  boatIds: string[],
  /** Le dernier bateau ouvert (cookie), s'il y en a un. */
  lastBoatId: string | null | undefined,
  /** Vrai quand le sélecteur est demandé explicitement (« Changer de bateau »). */
  forcePicker: boolean,
): BoatLanding {
  if (boatIds.length === 0) return { kind: "new" };
  if (boatIds.length === 1) return { kind: "boat", boatId: boatIds[0]! };
  if (forcePicker) return { kind: "picker" };
  // Le cookie ne décide que s'il désigne un bateau encore accessible : un accès retiré ne doit
  // pas renvoyer vers un bateau qu'on ne peut plus ouvrir.
  if (lastBoatId && boatIds.includes(lastBoatId)) return { kind: "boat", boatId: lastBoatId };
  return { kind: "boat", boatId: boatIds[0]! };
}
