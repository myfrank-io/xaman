"use client";

import { useEffect } from "react";
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

// One channel per boat: any change on the boat's tables invalidates the boat's queries, so every
// open screen refreshes live (SPEC M9). RLS applies to the events themselves.
export function useBoatRealtime(boatId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    const supabase = createClient();
    const channel = supabase.channel(`boat:${boatId}`);

    for (const table of REALTIME_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `boat_id=eq.${boatId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: boatKeys.all(boatId) });
        },
      );
    }
    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [boatId, queryClient]);
}
