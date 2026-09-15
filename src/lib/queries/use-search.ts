"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { hasSupabaseEnv } from "@/lib/env";
import { boatKeys } from "@/lib/queries/keys";
import { loadSearch, type SearchGroup } from "@/lib/queries/search";
import { isSearchable } from "@/lib/search-terms";
import { createClient } from "@/lib/supabase/client";

/**
 * Cinq minutes : un carnet ne change pas pendant qu'on cherche dedans, et revenir sur une
 * question déjà posée doit être instantané plutôt que juste rapide.
 */
const STALE_MS = 5 * 60_000;

/**
 * Chercher pendant qu'on tape (E18-14).
 *
 * Avant, la question vivait dans l'URL et nulle part ailleurs : chaque frappe faisait un
 * `router.replace`, donc un aller-retour RSC qui re-rendait la page entière — en-tête, champ,
 * résultats — pour une lettre de plus. Sur l'iPad d'un bateau, la frappe et la réponse ne
 * tenaient pas ensemble.
 *
 * La question reste dans l'URL, parce qu'un résultat se partage et se met en favori ; mais elle
 * n'est plus ce qui déclenche la recherche. C'est ce hook qui la pose, sur le client Supabase du
 * navigateur, et il en garde le résultat.
 *
 * `keepPreviousData` est ce qui fait la différence à l'œil : tant que la nouvelle réponse n'est
 * pas là, l'ancienne reste affichée au lieu de laisser un trou. On voit la liste se resserrer
 * lettre après lettre, jamais clignoter.
 */
export function useSearch({
  boatId,
  query,
  limit,
  initial,
  initialQuery,
}: {
  boatId: string;
  query: string;
  limit: number;
  /** Ce que le serveur a déjà rendu, pour que l'arrivée sur un lien partagé ne reparte de rien. */
  initial?: SearchGroup[];
  /** La question à laquelle `initial` répond — toute autre repart de la base. */
  initialQuery?: string;
}) {
  const enabled = isSearchable(query) && hasSupabaseEnv();
  const seeded = initial !== undefined && initialQuery !== undefined && initialQuery === query;

  const result = useQuery({
    queryKey: boatKeys.search(boatId, query, limit),
    queryFn: () => loadSearch(createClient(), boatId, query, limit),
    enabled,
    initialData: seeded ? initial : undefined,
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
    // Une recherche qui échoue doit le dire vite : deux tentatives, pas six.
    retry: 1,
  });

  return {
    groups: enabled ? (result.data ?? []) : [],
    // `isFetching` et non `isLoading` : avec `keepPreviousData`, la requête suivante n'est jamais
    // « en chargement » puisqu'elle a déjà des données à montrer — c'est pourtant là qu'il faut
    // dire qu'on travaille.
    searching: enabled && result.isFetching,
    /** Vrai seulement quand la base a répondu pour *cette* question-là. */
    answered: enabled && !result.isFetching && result.isSuccess,
    error: result.error,
  };
}
