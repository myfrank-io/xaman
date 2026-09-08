import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Le point rouge, un seul objet, du premier onglet jusqu'à la ligne (D88).
 *
 * Il ne dit qu'une chose — « il y a quelque chose à faire aujourd'hui » — et il la dit de la
 * même façon partout : onglet de navigation, feuille « Plus », tuile d'un système, onglet
 * « À traiter », onglet « Prévu ». Suivre les points rouges d'écran en écran doit mener à la
 * ligne qui les allume ; un point rouge qui s'arrête à la navigation laisse chercher.
 *
 * La couleur ne travaille jamais seule : avec un compte, le nombre est écrit ; sans compte, un
 * libellé pour lecteur d'écran l'accompagne, et le mot qui le suit (« À traiter », « Prévu »,
 * le nom du système) porte le sens à l'œil.
 */
export function AttentionDot({
  count = 0,
  bare = false,
  label,
  size = "md",
  className,
}: {
  /** Rien n'est rendu à zéro : un compteur à 0 n'est pas une notification. */
  count?: number;
  /** Pastille sans chiffre, posée sur une icône : le compte est déjà dit à côté. */
  bare?: boolean;
  /** Remplace « N à faire aujourd'hui » quand le contexte dit mieux. */
  label?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = useTranslations("common");
  if (!bare && count <= 0) return null;

  const text = label ?? (bare ? t("attentionDot") : t("attention", { count }));

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-status-urgent font-bold text-white",
        bare
          ? size === "sm"
            ? "size-2"
            : "size-2.5"
          : size === "sm"
            ? "min-w-4 px-1 num text-[10px] leading-4"
            : "min-w-5 px-1.5 num text-[11px] leading-5",
        className,
      )}
    >
      {bare ? null : <span aria-hidden>{count > 99 ? "99+" : count}</span>}
      <span className="sr-only">{text}</span>
    </span>
  );
}
