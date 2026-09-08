"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { daysLate, isOpenLog, type AttentionLog } from "@/lib/attention";

/**
 * Ce qu'une intervention ouverte doit à aujourd'hui (D88).
 *
 * « Prévu » et une date ne disent pas si la date est passée : sur un écran lu en diagonale,
 * une intervention datée d'avant-hier ressemblait à une intervention prévue le mois prochain.
 * La puce nomme le retard — « aujourd'hui », « 3 j de retard » — et ne s'affiche que sur les
 * lignes qui allument le point rouge de l'onglet Journal, jamais sur l'historique.
 */
export function LogDueLabel({
  status,
  performedAt,
  today,
  className,
}: AttentionLog & { today: string; className?: string }) {
  const t = useTranslations("logs.due");
  if (!isOpenLog(status)) return null;
  const late = daysLate(performedAt, today);
  if (late === null) return null;

  return (
    <Badge variant="danger" size="sm" className={className}>
      {late === 0 ? t("today") : t("late", { count: late })}
    </Badge>
  );
}
