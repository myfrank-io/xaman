"use client";

import { useState } from "react";

import { SearchField } from "@/components/search/SearchField";

/**
 * Le champ, vivant, sans base derrière (recette visuelle).
 *
 * `SearchField` est contrôlé depuis `SearchScreen` dans l'application ; ici c'est cet état-là qui
 * tient lieu d'écran, pour que l'audit tactile mesure la croix d'effacement et la roue à leur
 * vraie taille plutôt que sur une capture.
 */
export function SearchFieldDemo({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  return <SearchField value={query} onChange={setQuery} busy={query !== ""} />;
}
