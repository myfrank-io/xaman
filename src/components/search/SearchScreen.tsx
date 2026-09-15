"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangleIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/common/EmptyState";
import { SearchField } from "@/components/search/SearchField";
import { SearchResults } from "@/components/search/SearchResults";
import { searchPath } from "@/lib/queries/boat-routes";
import { countSearchHits, type SearchGroup } from "@/lib/queries/search";
import { useSearch } from "@/lib/queries/use-search";
import { isSearchable, searchTerms } from "@/lib/search-terms";

/**
 * Le temps qu'on laisse à la frappe avant d'interroger la base.
 *
 * 300 ms était le réglage de `0039`, et il s'ajoutait à un aller-retour RSC complet : la réponse
 * arrivait une demi-seconde après la lettre. La question ne coûte plus qu'un appel RPC, donc le
 * délai n'a plus à couvrir le rendu — 120 ms suffisent à ne pas interroger la base à chaque
 * touche, et c'est sous le seuil où une frappe et sa réponse cessent d'être le même geste.
 */
const QUERY_DEBOUNCE_MS = 120;

/**
 * L'URL, elle, peut attendre : elle ne sert qu'à partager et à revenir.
 *
 * Elle est réécrite par `history.replaceState` et non par `router.replace` — le guide « Shallow
 * routing on the client » de Next : les deux `history` natifs sont intégrés au routeur, donc
 * `usePathname` et `useSearchParams` restent justes, mais **sans** re-rendu serveur. C'était tout
 * le coût de l'ancienne version : chaque lettre re-demandait la page entière au serveur.
 */
const URL_DEBOUNCE_MS = 500;

function useDebounced<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * Chercher dans le carnet, pendant qu'on tape (E18-14).
 *
 * L'écran tient la question ; la base répond à la frappe stabilisée ; l'URL suit derrière pour
 * que le résultat reste partageable. Les trois n'ont plus le même rythme, et c'est ce qui rend
 * la recherche instantanée sans lui retirer son adresse.
 */
export function SearchScreen({
  boatId,
  initialQuery,
  initialGroups,
  perFamily,
}: {
  boatId: string;
  initialQuery: string;
  /** Ce que le serveur a rendu pour `initialQuery` ; `null` s'il n'a pas pu répondre. */
  initialGroups: SearchGroup[] | null;
  perFamily: number;
}) {
  const t = useTranslations("search");
  const [query, setQuery] = useState(initialQuery);
  const asked = useDebounced(query, QUERY_DEBOUNCE_MS);
  const forUrl = useDebounced(query, URL_DEBOUNCE_MS);
  const typed = useRef(false);

  const { groups, searching, answered, error } = useSearch({
    boatId,
    query: asked,
    limit: perFamily,
    initial: initialGroups ?? undefined,
    initialQuery,
  });

  useEffect(() => {
    if (!typed.current) return;
    // `replaceState` et non `pushState` : sinon chaque lettre laisserait une entrée dans
    // l'historique et « précédent » remonterait la frappe caractère par caractère.
    window.history.replaceState(null, "", searchPath(boatId, forUrl));
  }, [forUrl, boatId]);

  // Les mots de la question **posée**, pas de celle en train d'être tapée : surligner « vidang »
  // sur des résultats obtenus pour « vidan » ferait clignoter le surlignage en avance sur la
  // liste.
  const terms = useMemo(() => searchTerms(asked), [asked]);
  const count = countSearchHits(groups);

  return (
    <>
      <SearchField
        value={query}
        busy={searching}
        autoFocus={initialQuery === ""}
        onChange={(next) => {
          typed.current = true;
          setQuery(next);
        }}
      />

      {/* Ce que la base a répondu, annoncé aussi aux lecteurs d'écran : sans cela, une liste qui
          se resserre sous les doigts ne dit rien à qui ne la voit pas. */}
      <p aria-live="polite" className="sr-only">
        {answered ? t("count", { count }) : ""}
      </p>

      {error ? (
        // Une panne doit avoir l'air d'une panne. L'ancienne version avalait l'erreur du RPC et
        // affichait « aucun résultat » : le carnet paraissait vide alors qu'il était injoignable.
        <EmptyState
          icon={<AlertTriangleIcon aria-hidden />}
          title={t("failed")}
          description={t("failedDescription")}
        />
      ) : !isSearchable(query) ? (
        // « Continuez à taper » et « aucun résultat » ne disent pas la même chose à quelqu'un qui
        // vient d'appuyer sur une touche : sous deux caractères, la question n'a pas été posée.
        <EmptyState
          icon={<SearchIcon aria-hidden />}
          title={t("prompt")}
          description={t("promptDescription")}
        />
      ) : groups.length > 0 ? (
        <SearchResults boatId={boatId} groups={groups} terms={terms} />
      ) : searching ? (
        // Le premier résultat n'est pas encore là : ne rien dire vaut mieux que dire « aucun ».
        <EmptyState
          icon={<SearchIcon aria-hidden />}
          title={t("searching")}
          description={t("promptDescription")}
        />
      ) : (
        <EmptyState
          icon={<SearchIcon aria-hidden />}
          title={t("empty", { query: asked })}
          description={t("emptyDescription")}
          variant="filtered"
        />
      )}
    </>
  );
}
