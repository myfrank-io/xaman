import { drivenByHours } from "@/components/dashboard/next-due";

/**
 * Quand une chose est à faire, dite comme on la dit à bord (E20-1).
 *
 * L'ancienne ligne écrivait « dans 365 j ». Personne ne pense en jours au-delà de la quinzaine :
 * on dit « dans trois semaines », « dans cinq mois », « l'an prochain ». Un nombre de jours exact
 * ne se lit que tant qu'il reste comptable sur les doigts — passé ça, il oblige le lecteur à
 * diviser par trente pour savoir s'il doit s'en occuper, ce qui est exactement le travail que cet
 * écran existe pour supprimer.
 *
 * La fonction ne rend pas de texte : elle rend **la clé et ses arguments**, et `fr.json` écrit la
 * phrase (règle 7). Elle est pure et sans traduction, donc testable ligne à ligne.
 */
export type DueSentence = {
  /** Sous `checklist.due.*` dans `fr.json`. */
  key:
    | "overdueDays"
    | "overdueHours"
    | "today"
    | "tomorrow"
    | "inDays"
    | "inWeeks"
    | "inMonths"
    | "inYears"
    | "inHours"
    | "never"
    | "unknownCounter"
    | "punctual";
  values?: Record<string, number>;
  /** L'urgence que la ligne doit porter à l'œil : le trait de couleur la lit. */
  tone: "overdue" | "today" | "soon" | "calm";
};

export type DueInput = {
  status: "overdue" | "soon" | "ok" | "never";
  daysRemaining: number | null;
  hoursRemaining: number | null;
  /** false quand le moteur lié n'a jamais été relevé : aucune heure n'est dicible. */
  hasCounter: boolean;
  /** Ni mois ni heures : la chose ne revient pas, elle se fait une fois. */
  punctual: boolean;
  hasCompletion: boolean;
};

/**
 * Les paliers. Ils ne sont pas ronds par hasard : quatorze jours parce qu'une quinzaine se
 * compte encore, soixante parce qu'au-delà de deux mois le nombre de semaines ne dit plus rien,
 * trois cent trente parce qu'« onze mois » est une façon compliquée de dire « l'an prochain ».
 */
const TWO_WEEKS = 14;
const TWO_MONTHS = 60;
const ELEVEN_MONTHS = 330;

export function dueSentence(input: DueInput): DueSentence {
  if (input.punctual) {
    return input.hasCompletion ? { key: "punctual", tone: "calm" } : { key: "never", tone: "calm" };
  }
  if (input.status === "never" && !input.hasCompletion) {
    return { key: "never", tone: "calm" };
  }

  const days = input.daysRemaining;
  const hours = input.hasCounter ? input.hoursRemaining : null;
  if (days === null && hours === null) {
    return { key: input.hasCounter ? "never" : "unknownCounter", tone: "calm" };
  }

  // La plus serrée des deux échéances mène la phrase — la même règle que les paliers de la file.
  const byHours = drivenByHours(days, hours);
  const value = byHours ? hours : days;
  if (value === null || !Number.isFinite(value)) return { key: "never", tone: "calm" };

  const rounded = Math.round(value);
  if (rounded < 0) {
    const count = Math.abs(rounded);
    return byHours
      ? { key: "overdueHours", values: { count }, tone: "overdue" }
      : { key: "overdueDays", values: { count }, tone: "overdue" };
  }

  // Les heures restent des heures : un compteur ne se convertit pas en semaines, il tourne au
  // rythme du moteur et non du calendrier.
  if (byHours) return { key: "inHours", values: { count: rounded }, tone: soonTone(input.status) };

  if (rounded === 0) return { key: "today", tone: "today" };
  if (rounded === 1) return { key: "tomorrow", tone: "soon" };
  if (rounded < TWO_WEEKS) return { key: "inDays", values: { count: rounded }, tone: "soon" };
  if (rounded < TWO_MONTHS) {
    return {
      key: "inWeeks",
      values: { count: Math.round(rounded / 7) },
      tone: soonTone(input.status),
    };
  }
  if (rounded < ELEVEN_MONTHS) {
    return { key: "inMonths", values: { count: Math.round(rounded / 30) }, tone: "calm" };
  }
  return { key: "inYears", values: { count: Math.round(rounded / 365) }, tone: "calm" };
}

function soonTone(status: DueInput["status"]): DueSentence["tone"] {
  return status === "soon" ? "soon" : "calm";
}

/**
 * La phrase d'un point que quelqu'un a en main (D140, D141) : une intervention prévue, en cours
 * ou urgente le porte. Elle remplace la phrase d'échéance sur la ligne — « En retard de 12
 * jours » sous une vidange confiée au chantier pour la semaine prochaine dit vrai et n'apprend
 * rien ; « Confié à Marsaudon · prévu le 24/09 » dit ce qui va se passer. Le trait de couleur,
 * lui, garde l'urgence de l'échéance : c'est la phrase qui rassure, pas la couleur qui ment.
 *
 * Même contrat que `dueSentence` : une clé sous `checklist.handed.*`, ses arguments, et
 * `fr.json` écrit la phrase (règle 7).
 */
export type HandedSentence = {
  key: "plannedWith" | "planned" | "inProgressWith" | "inProgress" | "urgentWith" | "urgent";
  values: Record<string, string>;
};

export type HandedInput = {
  status: "planned" | "in_progress" | "urgent";
  /** La date prévue, déjà écrite comme on l'affiche (« 24/09/2026 »). */
  date: string;
  contactName: string | null;
};

export function handedSentence(input: HandedInput): HandedSentence {
  const name = input.contactName?.trim() ?? "";
  const keys: Record<
    HandedInput["status"],
    { alone: HandedSentence["key"]; withName: HandedSentence["key"] }
  > = {
    planned: { alone: "planned", withName: "plannedWith" },
    in_progress: { alone: "inProgress", withName: "inProgressWith" },
    urgent: { alone: "urgent", withName: "urgentWith" },
  };
  const key = keys[input.status];
  if (name === "") return { key: key.alone, values: { date: input.date } };
  return { key: key.withName, values: { date: input.date, name } };
}
