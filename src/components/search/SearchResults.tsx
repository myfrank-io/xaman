import type { Route } from "next";
import { getTranslations } from "next-intl/server";

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
 * Ce que le carnet sait de la question (E18-4, D134).
 *
 * Groupé par famille, jamais mélangé : « la dernière courroie » et « la courroie qu'il faudra
 * changer » sont deux réponses différentes à la même frappe, et les confondre dans une liste
 * unique obligerait à lire chaque ligne pour savoir laquelle on tient.
 */
export async function SearchResults({ boatId, groups }: { boatId: string; groups: SearchGroup[] }) {
  const t = await getTranslations("search");

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
                  title={hit.title}
                  meta={hit.subtitle}
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
