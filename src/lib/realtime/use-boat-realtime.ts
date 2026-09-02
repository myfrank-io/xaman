"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { hasSupabaseEnv } from "@/lib/env";
import { boatKeys } from "@/lib/queries/keys";
import { createClient } from "@/lib/supabase/client";

// Tables published on supabase_realtime (DATA-MODEL.md §7)
export const REALTIME_TABLES = [
  "maintenance_logs",
  "checklist_items",
  "checklist_completions",
  "engine_hour_readings",
  "purchases",
  "parts",
  "haul_outs",
  "contacts",
] as const;

// One channel per boat: any change on the boat's tables invalidates the boat's queries and
// re-renders the server components of the current screen, so every open screen refreshes live
// (SPEC M9). RLS applies to the events themselves. Bursts (a seed, an import) are coalesced.
export function useBoatRealtime(boatId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const supabase = createClient();
    const channel = supabase.channel(`boat:${boatId}`);
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        void queryClient.invalidateQueries({ queryKey: boatKeys.all(boatId) });
        router.refresh();
      }, 300);
    };

    for (const table of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `boat_id=eq.${boatId}` },
        refresh,
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
    window.addEventListener("online", refresh);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("online", refresh);
      void supabase.removeChannel(channel);
    };
  }, [boatId, queryClient, router]);
}
