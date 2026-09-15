import { normaliseForMatch } from "@/lib/equipment-kinds";

/**
 * Six mots au plus, comme `public.search_terms()` (migration `0040`) : au-delà, la question n'en
 * est plus une, et chaque mot supplémentaire est une condition de plus sur chacune des sept
 * familles.
 */
export const MAX_SEARCH_TERMS = 6;

/**
 * Deux caractères sur le mot le plus long, comme la fonction SQL.
 *
 * Ce n'est pas la longueur de ce qui est tapé : « a. » fait deux caractères et ne cherche rien,
 * « 4L » en fait deux et cherche un modèle de moteur. C'est le mot qui décide, pas la frappe.
 */
export const MIN_TERM_LENGTH = 2;

/**
 * La question découpée en mots, du plus long au plus court.
 *
 * Jumeau de `public.search_terms()`. Il sert deux fois côté écran : à savoir si la question est
 * posée (`isSearchable`), et à surligner ce qui a répondu (`highlightSegments`) — deux réponses
 * que la base ne peut pas donner, l'une parce qu'elle arrive avant l'appel, l'autre parce qu'elle
 * porte sur du texte déjà rendu.
 *
 * `normaliseForMatch` est le repliage du dépôt (migrations `0035`, `0036`) : le réécrire ici en
 * ferait un second, et `0036` existe précisément parce que deux tables d'accents finissent par
 * diverger. Sa contrepartie est que ce qui n'est ni latin ni chiffre ne fait pas un mot — une
 * frappe en cyrillique reste un « continuez à taper » à l'écran alors que la base, elle, saurait
 * la chercher. L'écran se tait plutôt que de promettre : c'est le sens sûr de l'écart.
 *
 * `tests/unit/search-sql.test.ts` fait répondre les deux aux mêmes frappes.
 */
export function searchTerms(query: string): string[] {
  const seen = new Set(
    normaliseForMatch(query)
      .split(/[^a-z0-9]+/)
      .filter((word) => word !== ""),
  );
  return (
    [...seen]
      // Le plus long d'abord : c'est celui que le SQL donne à l'index, et celui que le surlignage
      // doit essayer en premier pour ne pas couper un mot long sur le début d'un mot court.
      .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0))
      .slice(0, MAX_SEARCH_TERMS)
  );
}

/**
 * La question est-elle posée ?
 *
 * « Continuez à taper » et « aucun résultat » ne disent pas la même chose à quelqu'un qui vient
 * d'appuyer sur une touche. La règle est celle de la base, au mot près, sinon l'écran annonce un
 * vide que la base n'a jamais constaté.
 */
export function isSearchable(query: string): boolean {
  const terms = searchTerms(query);
  return terms.length > 0 && terms[0]!.length >= MIN_TERM_LENGTH;
}

/**
 * Les variantes accentuées d'une lettre repliée.
 *
 * Le surlignage se fait sur le texte **tel qu'il s'affiche**, accents et majuscules compris, donc
 * on ne peut pas replier puis reporter les positions : « œ » → « oe » déplace tout ce qui suit
 * d'un caractère. On fait l'inverse — le motif se dé-replie — et les positions restent celles du
 * texte d'origine, par construction.
 */
const ACCENTED: Record<string, string> = {
  a: "aàáâãäå",
  c: "cç",
  e: "eèéêë",
  i: "iìíîï",
  n: "nñ",
  o: "oòóôõöø",
  u: "uùúûü",
  y: "yýÿ",
};

function termPattern(term: string): string {
  return Array.from(term)
    .map((letter) =>
      ACCENTED[letter] ? `[${ACCENTED[letter]}]` : letter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
}

/** Un morceau de texte, et s'il répond à la question. */
export type Segment = { text: string; match: boolean };

/**
 * Le texte coupé en morceaux, ceux qui ont répondu marqués.
 *
 * Sans lui, une ligne trouvée par ses notes montre un titre où le mot cherché n'est pas, et rien
 * ne distingue une bonne réponse d'un bug — c'est la même raison qui fait exister
 * `search_excerpt()` en base, appliquée à ce que l'écran affiche déjà.
 */
export function highlightSegments(text: string, terms: string[]): Segment[] {
  if (text === "" || terms.length === 0) return [{ text, match: false }];
  // Les mots sont déjà du plus long au plus court, et l'alternance d'une regex prend la première
  // qui accroche : « courroie » l'emporte donc sur « cour » quand les deux sont demandés.
  const pattern = new RegExp(terms.map(termPattern).join("|"), "gi");
  const segments: Segment[] = [];
  let cursor = 0;
  for (const found of text.matchAll(pattern)) {
    const at = found.index;
    if (at > cursor) segments.push({ text: text.slice(cursor, at), match: false });
    segments.push({ text: found[0], match: true });
    cursor = at + found[0].length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments;
}
