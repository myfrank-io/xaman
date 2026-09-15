"use client";

import { useRef } from "react";
import { Loader2Icon, SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";

/**
 * Le champ de recherche (E18-4, D134, E18-14).
 *
 * Il ne décide plus de rien : la question vit dans l'état de `SearchScreen`, qui la pose à la
 * base et la recopie dans l'URL. Le champ l'affiche, la modifie, et sait l'effacer.
 *
 * `autoFocus` est ce qui manquait pour que la barre de titre tienne sa promesse : la `TopBar` est
 * une porte (« la page de résultats porte de toute façon le sien, qui prend le clavier en
 * arrivant »), sauf que la page ne le passait jamais. On arrivait donc sur un champ vide qu'il
 * fallait viser une seconde fois — deux touchers pour chercher, sur un écran tenu d'une main.
 */
export function SearchField({
  value,
  onChange,
  busy = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  /** La base travaille : une roue discrète à droite, jamais un écran qui se vide. */
  busy?: boolean;
  autoFocus?: boolean;
}) {
  const t = useTranslations("search");
  const field = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <SearchIcon
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
      <Input
        ref={field}
        type="search"
        value={value}
        aria-label={t("label")}
        placeholder={t("placeholder")}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        autoFocus={autoFocus}
        /**
         * Le `×` natif de WebKit est masqué : il fait 14 px, il n'apparaît qu'au survol d'une
         * souris que l'iPad n'a pas, et il se superposerait au nôtre. Le bouton ci-dessous fait
         * 44 px et existe au doigt (règle 1).
         */
        className="pr-20 pl-10 [&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          // Échap efface la question sans quitter le champ — le clavier reste, la frappe
          // suivante part de zéro. Sur un clavier d'iPad c'est le geste le plus court ; au doigt
          // c'est le bouton.
          if (event.key === "Escape" && value !== "") {
            event.preventDefault();
            onChange("");
          }
        }}
      />
      {/* La roue et la croix se suivent dans la même gouttière, jamais l'une sur l'autre : les
          48 px de `pr-20` sont réservés pour les deux. */}
      <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
        <span className="flex size-4 items-center justify-center">
          {busy ? <Loader2Icon className="size-4 animate-spin text-ink-3" aria-hidden /> : null}
        </span>
        {value !== "" ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              field.current?.focus();
            }}
            className="inline-flex size-11 items-center justify-center rounded-lg tap-feedback text-ink-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <XIcon className="size-5" aria-hidden />
            <span className="sr-only">{t("clear")}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
