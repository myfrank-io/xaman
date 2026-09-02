"use client";

import { useBoatRealtime } from "@/lib/realtime/use-boat-realtime";

export function RealtimeBridge({ boatId }: { boatId: string }) {
  useBoatRealtime(boatId);
  return null;
}
