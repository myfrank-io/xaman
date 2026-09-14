import { getTranslations } from "next-intl/server";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SectionCard } from "@/components/common/SectionCard";
import type { CategoryTotal } from "@/lib/expenses";
import { formatCurrency } from "@/lib/format";
import { suppliesPath } from "@/lib/queries/boat-routes";

/** Trois systèmes : de quoi reconnaître où part l'argent, pas de quoi faire un tableau. */
const TOP = 3;

/**
 * « Ce que le bateau a coûté » (E18-13, D133) : le bloc qui donne envie d'ouvrir Dépenses.
 *
 * E18-1 avait retiré la ligne « Dépenses, 12 derniers mois » du récapitulatif — un lien de
 * sommaire de plus. Elle revient, mais comme une **découverte** : un montant qu'on regarde, et
 * les trois systèmes qui le composent. Un chiffre qui se regarde n'est pas une ligne qui se lit.
 *
 * Pas de graphique (règle 10) : trois barres de part, la couleur du système jamais seule
 * (pastille + libellé, règle 12).
 */
export async function ExpensesTeaser({
  boatId,
  total,
  categories,
}: {
  boatId: string;
  total: number;
  categories: CategoryTotal[];
}) {
  const t = await getTranslations("dashboard.expenses");
  const top = categories.slice(0, TOP);

  return (
    <SectionCard title={t("title")} actionHref={suppliesPath(boatId)} actionLabel={t("all")}>
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="num text-num-lg font-semibold">{formatCurrency(total)}</span>
          <span className="text-caption text-ink-2">{t("window")}</span>
        </div>
        {top.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {top.map((category) => (
              <li key={category.id || category.name} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-body">
                    <CategoryDot color={category.color} />
                    <span className="truncate">{category.name}</span>
                  </span>
                  <span className="shrink-0 num text-caption text-ink-2">
                    {formatCurrency(category.amount)}
                  </span>
                </div>
                {/* La part du **total**, jamais du plus gros système : `ProgressBar` écrit le
                    pourcentage à côté de la barre, et « 100 % » sur le premier système aurait dit
                    qu'il porte toute la dépense (D111 — un chiffre faux coûte plus cher). */}
                <ProgressBar
                  ratio={total > 0 ? category.amount / total : 0}
                  color={category.color}
                  label={category.name}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-ink-2">{t("empty")}</p>
        )}
      </div>
    </SectionCard>
  );
}
