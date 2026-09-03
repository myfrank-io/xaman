import type { NavKey } from "@/components/layout/nav";

export const BOAT_ROUTES: Record<NavKey, string> = {
  dashboard: "dashboard",
  logs: "logs",
  checklist: "checklist",
  supplies: "supplies",
  haulOuts: "haul-outs",
  contacts: "contacts",
  boat: "boat",
  trash: "trash",
  members: "members",
  settings: "settings",
  profile: "settings/profile",
};

/**
 * The profile screen is account-level, not boat-level: it lives outside the
 * boat tree (ux-flows §1.2) even though the account menu opens it.
 */
export const PROFILE_PATH = "/settings/profile";

export function boatPath(boatId: string, key: NavKey): string {
  if (key === "profile") return PROFILE_PATH;
  return `/boats/${boatId}/${BOAT_ROUTES[key]}`;
}

function withQuery(path: string, query?: Record<string, string | number | undefined>): string {
  if (!query) return path;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

// Every route string of the app is built here — never concatenated at the call site.

export function logPath(boatId: string, logId: string): string {
  return `${boatPath(boatId, "logs")}/${logId}`;
}

export function editLogPath(boatId: string, logId: string): string {
  return `${logPath(boatId, logId)}/edit`;
}

export function newLogPath(
  boatId: string,
  query?: Record<string, string | number | undefined>,
): string {
  return withQuery(`${boatPath(boatId, "logs")}/new`, query);
}

export function logsPath(
  boatId: string,
  query?: Record<string, string | number | undefined>,
): string {
  return withQuery(boatPath(boatId, "logs"), query);
}

/**
 * « Importer des documents » (E10-1): a batch of invoices and photos dropped at once, each
 * attached to an intervention or turned into one.
 */
export function importDocumentsPath(boatId: string): string {
  return `${boatPath(boatId, "logs")}/documents`;
}

/** « Reprise du carnet » (E3-7): the guided review of the imported rows. */
export function logsReviewPath(
  boatId: string,
  query?: Record<string, string | number | undefined>,
): string {
  return withQuery(`${boatPath(boatId, "logs")}/review`, query);
}

export function categoryPath(boatId: string, categoryId: string): string {
  return `${boatPath(boatId, "checklist")}/${categoryId}`;
}

export function newChecklistItemPath(boatId: string, categoryId: string): string {
  return `${categoryPath(boatId, categoryId)}/new`;
}

export function checklistPath(
  boatId: string,
  query?: Record<string, string | number | undefined>,
): string {
  return withQuery(boatPath(boatId, "checklist"), query);
}

export function enginePath(boatId: string, engineId: string): string {
  return `${boatPath(boatId, "boat")}/engines/${engineId}`;
}

export function equipmentPath(boatId: string, equipmentId: string): string {
  return `${boatPath(boatId, "boat")}/equipment/${equipmentId}`;
}

export function contactPath(boatId: string, contactId: string): string {
  return `${boatPath(boatId, "contacts")}/${contactId}`;
}

export function newContactPath(boatId: string): string {
  return `${boatPath(boatId, "contacts")}/new`;
}

export function editContactPath(boatId: string, contactId: string): string {
  return `${contactPath(boatId, contactId)}/edit`;
}

// Printable state report (E9-2b), outside the tab navigation.
export function reportPath(boatId: string, costs = true): string {
  return withQuery(`/boats/${boatId}/report`, costs ? undefined : { costs: 0 });
}

export function haulOutPath(boatId: string, haulOutId: string): string {
  return `${boatPath(boatId, "haulOuts")}/${haulOutId}`;
}

export function newHaulOutPath(boatId: string): string {
  return `${boatPath(boatId, "haulOuts")}/new`;
}

export function editHaulOutPath(boatId: string, haulOutId: string): string {
  return `${haulOutPath(boatId, haulOutId)}/edit`;
}

/**
 * Dépenses is one list (D33): interventions, purchases and haul-outs together. `gas` is not
 * a tab but the bottle shortcut — the same list filtered on `kind=gas`, dialog open.
 */
export type SuppliesTab = "gas";

export function suppliesPath(
  boatId: string,
  tab?: SuppliesTab,
  query?: Record<string, string | number | undefined>,
): string {
  return withQuery(boatPath(boatId, "supplies"), { ...query, tab });
}

export function newPurchasePath(
  boatId: string,
  query?: Record<string, string | number | undefined>,
): string {
  return withQuery(`${boatPath(boatId, "supplies")}/purchases/new`, query);
}

export function editPurchasePath(boatId: string, purchaseId: string): string {
  return `${boatPath(boatId, "supplies")}/purchases/${purchaseId}/edit`;
}

/**
 * Stock of spare parts (D34): an inventory of things aboard, so it lives inside the
 * Équipements tab of Bateau — not under Dépenses, which holds money only.
 */
export function stockPath(
  boatId: string,
  query?: Record<string, string | number | undefined>,
): string {
  return boatTabPath(boatId, "equipment", query);
}

export function newPartPath(boatId: string): string {
  return `${boatPath(boatId, "boat")}/parts/new`;
}

export function editPartPath(boatId: string, partId: string): string {
  return `${boatPath(boatId, "boat")}/parts/${partId}/edit`;
}

/** Import screen of a list (E12-2): one screen, the entity in the query. */
export function importPath(
  boatId: string,
  entity: "logs" | "purchases" | "contacts" | "equipment" | "parts",
): string {
  return withQuery(`/boats/${boatId}/import`, { entity });
}

export function boatTabPath(
  boatId: string,
  tab?: "identity" | "engines" | "equipment",
  query?: Record<string, string | number | undefined>,
): string {
  return withQuery(boatPath(boatId, "boat"), { ...query, tab });
}

export function newEnginePath(boatId: string): string {
  return `${boatPath(boatId, "boat")}/engines/new`;
}

export function editEnginePath(boatId: string, engineId: string): string {
  return `${enginePath(boatId, engineId)}/edit`;
}

// Engines tab with the hour reading dialog already open (« + » sheet entry).
export function hourReadingPath(boatId: string): string {
  return withQuery(boatPath(boatId, "boat"), { tab: "engines", reading: 1 });
}

export function newEquipmentPath(boatId: string, categoryId?: string): string {
  return withQuery(`${boatPath(boatId, "boat")}/equipment/new`, { category: categoryId });
}

export function editEquipmentPath(boatId: string, equipmentId: string): string {
  return `${equipmentPath(boatId, equipmentId)}/edit`;
}

export function editChecklistItemPath(boatId: string, categoryId: string, itemId: string): string {
  return `${categoryPath(boatId, categoryId)}/${itemId}/edit`;
}

export function checklistSetupPath(boatId: string): string {
  return `${boatPath(boatId, "checklist")}/setup`;
}
