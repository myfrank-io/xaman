"use client";

import type { Route } from "next";
import { useTranslations } from "next-intl";

import { ListRow } from "@/components/common/ListRow";
import { SectionCard } from "@/components/common/SectionCard";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  categoryPath,
  contactPath,
  equipmentPath,
  inboxPath,
  logPath,
  stockPath,
  suppliesPath,
  checklistPath,
} from "@/lib/queries/boat-routes";
import type { SearchGroup, SearchHit, SearchKind } from "@/lib/queries/search";
import { highlightSegments } from "@/lib/search-terms";

/**
 * Le titre de chaque famille. `satisfies` rend la clé typée : ajouter une famille en SQL sans lui
 * donner de mots fait échouer le typecheck plutôt que d'afficher une clé brute à l'écran.
 */
const GROUP_KEY = {
  log: "logs",
  item: "items",
  purchase: "purchases",
  equipment: "equipment",
  part: "parts",
  contact: "contacts",
  document: "documents",
} as const satisfies Record<SearchKind, string>;

/**
 * Où mène une ligne.
 *
 * Chaque famille a déjà son écran : une recherche n'en invente aucun, elle y conduit. Un point de
 * checklist n'a pas d'écran à lui — c'est sa catégorie qui le porte —, d'où `parentId` ; sans
 * elle, la ligne mène à la liste complète plutôt qu'à une page qui n'existe pas.
 */
function hrefFor(boatId: string, hit: SearchHit): string {
  switch (hit.kind) {
    case "log":
      return logPath(boatId, hit.id);
    case "item":
      return hit.parentId ? categoryPath(boatId, hit.parentId) : checklistPath(boatId);
    case "purchase":
      return suppliesPath(boatId);
    case "equipment":
      return equipmentPath(boatId, hit.id);
    case "part":
      return stockPath(boatId);
    case "contact":
      return contactPath(boatId, hit.id);
    case "document":
      return inboxPath(boatId);
  }
}

/**
 * Le texte, avec ce qui a répondu en évidence.
 *
 * `bg-accent` / `text-accent-foreground` : une paire remplissage + texte, jamais une couleur de
 * texte seule (règle 12), et définie des deux côtés du thème. Le surlignage n'est pas la seule
 * chose qui distingue la ligne — il s'ajoute au titre, qui reste lisible sans lui.
 */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  const segments = highlightSegments(text, terms);
  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          <mark key={index} className="rounded-[3px] bg-accent px-0.5 text-accent-foreground">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}

/**
 * Ce que le carnet sait de la question (E18-4, D134, E18-14).
 *
 * Groupé par famille, jamais mélangé : « la dernière courroie » et « la courroie qu'il faudra
 * changer » sont deux réponses différentes à la même frappe, et les confondre dans une liste
 * unique obligerait à lire chaque ligne pour savoir laquelle on tient.
 *
 * Chaque ligne dit maintenant **pourquoi** elle est là. Une intervention trouvée par ses notes
 * n'affichait que son titre, où le mot cherché n'était pas : « courroie » rendait « Vidange
 * moteur bâbord » et on ne pouvait pas distinguer une bonne réponse d'un bug. Le fragment rendu
 * par `search_excerpt()` le dit, et le surlignage le montre.
 */
export function SearchResults({
  boatId,
  groups,
  terms,
}: {
  boatId: string;
  groups: SearchGroup[];
  /** Les mots de la question, pour le surlignage — `searchTerms()` les a déjà découpés. */
  terms: string[];
}) {
  const t = useTranslations("search");

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <SectionCard
          key={group.kind}
          title={t(`families.${GROUP_KEY[group.kind]}`, { count: group.hits.length })}
        >
          <ul>
            {group.hits.map((hit) => (
              <li key={`${hit.kind}:${hit.id}`}>
                <ListRow
                  size={hit.context ? "lg" : "md"}
                  title={<Marked text={hit.title} terms={terms} />}
                  meta={
                    hit.subtitle || hit.context ? (
                      <span className="flex min-w-0 flex-col gap-0.5">
                        {hit.subtitle ? (
                          <span className="truncate">
                            <Marked text={hit.subtitle} terms={terms} />
                          </span>
                        ) : null}
                        {hit.context ? (
                          <span className="truncate text-ink-3">
                            <Marked text={hit.context} terms={terms} />
                          </span>
                        ) : null}
                      </span>
                    ) : null
                  }
                  trailing={
                    <span className="flex flex-col items-end gap-0.5">
                      {hit.amount !== null ? (
                        <span className="num text-body">{formatCurrency(hit.amount)}</span>
                      ) : null}
                      {hit.happenedAt ? (
                        <span className="num text-caption text-ink-2">
                          {formatDate(hit.happenedAt)}
                        </span>
                      ) : null}
                    </span>
                  }
                  href={hrefFor(boatId, hit) as Route}
                />
              </li>
            ))}
          </ul>
        </SectionCard>
      ))}
    </div>
  );
}
