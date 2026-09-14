import { getTranslations } from "next-intl/server";

import { num, Scroller, Section, table, td, th } from "@/components/report/print";
import { formatDate, formatHours, formatNumber } from "@/lib/format";
import type { Database } from "@/types/database";

/**
 * Une ligne de `boat_todo_queue`, réduite à ce qu'une feuille de papier porte.
 *
 * Les colonnes nullables le sont vraiment — une pièce n'a pas de statut, un point sans date n'a
 * pas d'échéance —, mais `postgres-meta` type chaque colonne d'un `returns table (…)` comme
 * non-nulle. On garde donc le lien avec le type généré, en lui rendant ses `null` : c'est la même
 * correction que `SearchRow` (E18-4), et le tableau ci-dessous en dépend pour choisir sa raison.
 */
type QueueReturn = Database["public"]["Functions"]["boat_todo_queue"]["Returns"][number];

export type QueueRow = {
  [
    K in
      | "rank"
      | "kind"
      | "id"
      | "title"
      | "category_name"
      | "status"
      | "due_at"
      | "due_hours"
      | "days_remaining"
      | "hours_remaining"
      | "severity"
  ]: QueueReturn[K] | null;
};

/**
 * La case à cocher au stylo.
 *
 * Le carré est dessiné, pas coché : c'est la seule chose que cette page ajoute à la file, et
 * c'est ce qui en fait une liste qu'on emmène. `print-color-adjust` garde le trait sur une
 * imprimante qui, autrement, « économiserait » les bordures claires.
 */
function Box() {
  return (
    <span
      aria-hidden
      className="mt-0.5 inline-block size-4 shrink-0 rounded-[3px] border-2 border-ink-2 print:[print-color-adjust:exact]"
    />
  );
}

/**
 * La liste qu'on emmène au bateau (E18-5, D131).
 *
 * La file du tableau de bord ne sort pas de l'écran : au ponton on a les mains prises, le
 * réseau est mauvais et l'iPad reste dans son sac. Ce document est la même file, sur une
 * feuille — ce qui est dû, et ce qu'il faut racheter.
 *
 * Deux blocs, pas cinq paliers : sur papier, les rangs de la file (aujourd'hui, cette semaine,
 * ce mois-ci) n'ont plus d'objet — la feuille sera dans une poche jusqu'à ce que le travail
 * soit fait, et ce qui compte alors est *pourquoi* chaque ligne y est. L'ordre de la file, lui,
 * est conservé tel quel : le plus urgent en premier.
 */
export async function QueueDocument({
  boatName,
  today,
  rows,
  actions,
}: {
  boatName: string;
  today: string;
  rows: QueueRow[];
  /** Le bouton d'impression — il a besoin des routes du bateau. */
  actions?: React.ReactNode;
}) {
  const [t, tc] = await Promise.all([getTranslations("report"), getTranslations("common")]);

  // Le rang 5 est celui des pièces sous leur seuil (E18-2) : c'est la seule ligne du document
  // qu'on ne fait pas, qu'on achète. Les documents en attente (rang 2) restent à l'écran : on
  // ne valide pas une facture debout dans un coffre moteur.
  const todo = rows.filter((row) => row.kind !== "part" && row.kind !== "inbox");
  const restock = rows.filter((row) => row.kind === "part");

  /** Pourquoi cette ligne est là : la même raison que la file affiche, en toutes lettres. */
  function reason(row: QueueRow): string {
    if (row.kind === "part") {
      return t("queue.missing", { count: formatNumber(row.severity ?? 0) });
    }
    if (row.due_at) {
      const days = row.days_remaining;
      if (days !== null && days < 0) return t("queue.late", { count: Math.abs(days) });
      if (days !== null) return t("queue.inDays", { count: days });
      return formatDate(row.due_at);
    }
    if (row.due_hours !== null && row.due_hours !== undefined) {
      const hours = row.hours_remaining;
      if (hours !== null && hours < 0) {
        return t("queue.lateHours", { count: formatHours(Math.abs(hours)) });
      }
      if (hours !== null) return t("queue.inHours", { count: formatHours(hours) });
    }
    return t("queue.noDate");
  }

  return (
    <div className="flex min-w-0 flex-col gap-8 print:gap-6 print:text-[11pt]">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-h1 break-words">
          {t("queue.title")} · {boatName}
        </h1>
        <p className="text-body text-ink-2">{t("subtitle", { date: formatDate(today) })}</p>
        {actions ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">{actions}</div>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 print:hidden">
        <p className="text-caption text-ink-3">{t("printHint")}</p>
        <p className="text-caption text-ink-3 sm:hidden">{tc("scrollTable")}</p>
      </div>

      <Section title={t("queue.todo")}>
        {todo.length === 0 ? (
          <p className="text-body text-ink-2">{t("queue.todoEmpty")}</p>
        ) : (
          <Scroller>
            <table className={table}>
              <thead>
                <tr>
                  <th className={`${th} w-8`}>
                    <span className="sr-only">{t("queue.done")}</span>
                  </th>
                  <th className={th}>{t("queue.what")}</th>
                  <th className={th}>{t("queue.system")}</th>
                  <th className={th}>{t("queue.why")}</th>
                </tr>
              </thead>
              <tbody>
                {todo.map((row) => (
                  <tr key={`${row.kind}:${row.id}`}>
                    <td className={td}>
                      <Box />
                    </td>
                    <td className={`${td} font-medium`}>{row.title}</td>
                    <td className={`${td} text-ink-2`}>{row.category_name ?? "—"}</td>
                    <td className={`${td} whitespace-nowrap`}>{reason(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        )}
      </Section>

      <Section title={t("queue.restock")}>
        {restock.length === 0 ? (
          <p className="text-body text-ink-2">{t("queue.restockEmpty")}</p>
        ) : (
          <Scroller>
            <table className={table}>
              <thead>
                <tr>
                  <th className={`${th} w-8`}>
                    <span className="sr-only">{t("queue.bought")}</span>
                  </th>
                  <th className={th}>{t("queue.what")}</th>
                  <th className={th}>{t("queue.system")}</th>
                  <th className={`${th} text-right`}>{t("queue.quantity")}</th>
                </tr>
              </thead>
              <tbody>
                {restock.map((row) => (
                  <tr key={`part:${row.id}`}>
                    <td className={td}>
                      <Box />
                    </td>
                    <td className={`${td} font-medium`}>{row.title}</td>
                    <td className={`${td} text-ink-2`}>{row.category_name ?? "—"}</td>
                    <td className={`${td} ${num}`}>{formatNumber(row.severity ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        )}
      </Section>

      <p className="text-caption text-ink-3">
        {t("queue.footer", { todo: todo.length, restock: restock.length })}
      </p>
    </div>
  );
}
