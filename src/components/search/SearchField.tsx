"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { searchPath } from "@/lib/queries/boat-routes";

/** Comme le Journal (E3-2) : la frappe s'arrête, l'URL suit. Jamais de soumission. */
const DEBOUNCE_MS = 300;

/**
 * Le champ de recherche (E18-4, D134).
 *
 * L'état vit dans l'URL et nulle part ailleurs : un résultat se partage, se met en favori et
 * survit au retour arrière. `replace` plutôt que `push`, sinon chaque lettre tapée laisserait une
 * entrée dans l'historique et le bouton « précédent » remonterait la frappe caractère par
 * caractère.
 */
export function SearchField({
  boatId,
  initialQuery,
  autoFocus = false,
}: {
  boatId: string;
  initialQuery: string;
  autoFocus?: boolean;
}) {
  const t = useTranslations("search");
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const typed = useRef(false);

  useEffect(() => {
    if (!typed.current || query === initialQuery) return;
    const timer = setTimeout(
      () => router.replace(searchPath(boatId, query) as Parameters<typeof router.replace>[0]),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query, initialQuery, boatId, router]);

  return (
    <div className="relative">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
      <Input
        type="search"
        value={query}
        aria-label={t("label")}
        placeholder={t("placeholder")}
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
        className="pl-10"
        onChange={(event) => {
          typed.current = true;
          setQuery(event.target.value);
        }}
      />
    </div>
  );
}
