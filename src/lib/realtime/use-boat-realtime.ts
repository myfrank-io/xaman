"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { hasSupabaseEnv } from "@/lib/env";
import { boatKeys } from "@/lib/queries/keys";
import { createClient } from "@/lib/supabase/client";

// Tables published on supabase_realtime (DATA-MODEL.md §7). engines and boat_categories are here
// because checklist_item_status reads them: a lone counter reset (D12), engine disable (D14) or
// category toggle must reach a second device live, not only when some other table also changes.
//
// inbox_items is listed for the same reason and one more: a document arrives on its own (D91), so
// nobody is holding a button when it does. The count beside « À valider », the banner on the
// dashboard and the screen itself all read the same three statuses, and this subscription is what
// makes them move together — on the device that validated, and on the one that did not.
// inbox_items joined the publication in 0028; the capped polling fallback in InboxScreen stays as
// a safety net for a project whose Realtime service is off, where no event ever arrives.
export const REALTIME_TABLES = [
  "maintenance_logs",
  "checklist_items",
  "checklist_completions",
  "engine_hour_readings",
  "purchases",
  "parts",
  "haul_outs",
  "contacts",
  "engines",
  "boat_categories",
  "inbox_items",
] as const;

export type RealtimeTable = (typeof REALTIME_TABLES)[number];

/**
 * Les tables dont un changement peut modifier le **cadre** : les points rouges de la navigation
 * et le compte « À valider », que le layout de `[boatId]` calcule à chaque rendu
 * (`loadBoatAttention`, `pendingInboxCount`). Un événement sur l'une d'elles doit rejouer layout
 * **et** page, où que soit le lecteur — sinon le point rouge ment jusqu'à la prochaine
 * navigation, ce qui est précisément la chose qu'un carnet partagé ne doit pas faire.
 */
const FRAME_TABLES: ReadonlySet<string> = new Set<RealtimeTable>([
  "maintenance_logs",
  "checklist_items",
  "checklist_completions",
  "engine_hour_readings",
  "engines",
  "boat_categories",
  "inbox_items",
]);

/**
 * Pour les quatre tables restantes, les sections dont le rendu serveur peut les montrer —
 * premier segment après `/boats/<id>/`.
 *
 * La liste est **volontairement large** : au moindre doute la section y est. Le carnet est un
 * objet très lié — un contact nomme une ligne de dépense, un achat nourrit le stock, une sortie
 * de l'eau porte des interventions — et une liste trop courte se paierait en écran qui ment.
 * Elle n'évite donc que les cas nets : une pièce ajoutée au stock ne rejoue plus le Journal,
 * une sortie de l'eau ne rejoue plus la fiche Bateau, un achat ne rejoue plus les contacts.
 * Chaque cas évité est un aller-retour serveur complet — layout + page — de moins.
 */
const SECTIONS: Partial<Record<RealtimeTable, readonly string[]>> = {
  // Une dépense : le total du tableau de bord, la liste des dépenses, le filtre « Stock » du
  // journal, le stock lui-même, la corbeille, l'import et la validation d'un document.
  purchases: [
    "dashboard",
    "supplies",
    "logs",
    "checklist",
    "boat",
    "trash",
    "report",
    "import",
    "inbox",
  ],
  // Une pièce détachée : le récapitulatif du tableau de bord, « À racheter », l'onglet
  // Équipements, le détail d'une dépense, la corbeille, l'import.
  parts: ["dashboard", "checklist", "boat", "supplies", "trash", "import"],
  // Une sortie de l'eau : le récapitulatif, son propre onglet, le formulaire d'intervention,
  // la source « sortie de l'eau » des dépenses, le rapport, la corbeille.
  haul_outs: ["dashboard", "haul-outs", "logs", "supplies", "report", "trash"],
  // Un contact nomme une ligne à peu près partout ; seuls les écrans de gestion l'ignorent.
  contacts: [
    "dashboard",
    "logs",
    "checklist",
    "supplies",
    "haul-outs",
    "contacts",
    "boat",
    "trash",
    "report",
    "import",
    "inbox",
  ],
};

/** `/boats/<uuid>/checklist/xyz` → `checklist`. Rien d'autre = pas de section connue. */
export function sectionOf(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "boats" && parts.length >= 3 ? (parts[2] ?? null) : null;
}

/**
 * Ce changement peut-il modifier ce que la personne a sous les yeux (cadre compris) ?
 *
 * Pur, donc testable sans base ni navigateur. En cas de doute — table inconnue, section
 * inconnue — la réponse est oui : un écran de retard coûte plus cher qu'une lecture de trop.
 */
export function affectsScreen(table: string, section: string | null): boolean {
  if (FRAME_TABLES.has(table)) return true;
  const sections = SECTIONS[table as RealtimeTable];
  if (!sections || section === null) return true;
  return sections.includes(section);
}

// One channel per boat: any change on the boat's tables invalidates the boat's queries and
// re-renders the server components of the current screen, so every open screen refreshes live
// (SPEC M9). RLS applies to the events themselves. Bursts (a seed, an import) are coalesced.
export function useBoatRealtime(boatId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `usePathname` change à chaque navigation ; l'abonnement, lui, ne doit pas être refait pour
  // autant (une resouscription perd les événements de l'intervalle). La ref porte la valeur
  // courante dans un effet qui ne dépend que du bateau.
  const section = useRef<string | null>(null);
  useEffect(() => {
    section.current = sectionOf(pathname);
  }, [pathname]);

  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const supabase = createClient();
    const channel = supabase.channel(`boat:${boatId}`);
    /** Un rafraîchissement dû mais reporté : l'onglet est en arrière-plan, ou la voie a sauté. */
    let pending = false;

    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void queryClient.invalidateQueries({ queryKey: boatKeys.all(boatId) });
        // Personne ne regarde : rejouer layout + page pour un écran qui n'est pas à l'écran est
        // le seul rafraîchissement dont on est sûr qu'il ne sert à rien. Il est repris au
        // retour, entier — c'est le même chemin que la reprise après une coupure.
        if (document.visibilityState === "hidden") {
          pending = true;
          return;
        }
        router.refresh();
      }, 300);
    };

    /** Une invalidation seule : le cache client suit, le serveur n'est pas rejoué. */
    const invalidateOnly = () => {
      void queryClient.invalidateQueries({ queryKey: boatKeys.all(boatId) });
    };

    for (const table of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `boat_id=eq.${boatId}` },
        () => {
          if (affectsScreen(table, section.current)) refresh();
          else invalidateOnly();
        },
      );
    }
    // Any gap (channel error, timeout, network loss) may have hidden changes: the recovery is a
    // full refresh of the boat, not a replay (ux-flows §5.7).
    let dropped = false;
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        if (dropped) {
          dropped = false;
          refresh();
        }
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        dropped = true;
      }
    });

    const onVisible = () => {
      if (document.visibilityState !== "visible" || !pending) return;
      pending = false;
      router.refresh();
    };
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [boatId, queryClient, router]);
}
