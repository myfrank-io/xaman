import type { NavKey } from "@/components/layout/nav";

export const BOAT_ROUTES: Record<NavKey, string> = {
  dashboard: "dashboard",
  logs: "logs",
  checklist: "checklist",
  supplies: "supplies",
  haulOuts: "haul-outs",
  contacts: "contacts",
  boat: "boat",
  members: "members",
  settings: "settings",
};

export function boatPath(boatId: string, key: NavKey): string {
  return `/boats/${boatId}/${BOAT_ROUTES[key]}`;
}
