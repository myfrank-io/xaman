// Query key factory. Every key of a boat starts with ["boat", boatId] so realtime can invalidate
// the whole boat with one prefix.
export const boatKeys = {
  all: (boatId: string) => ["boat", boatId] as const,
  dashboard: (boatId: string) => ["boat", boatId, "dashboard"] as const,
  engines: (boatId: string) => ["boat", boatId, "engines"] as const,
  categories: (boatId: string) => ["boat", boatId, "categories"] as const,
  checklistProgress: (boatId: string) => ["boat", boatId, "checklist", "progress"] as const,
  checklistItems: (boatId: string, categoryId: string) =>
    ["boat", boatId, "checklist", "items", categoryId] as const,
  logs: (boatId: string, filters: Record<string, unknown> = {}) =>
    ["boat", boatId, "logs", filters] as const,
  log: (boatId: string, logId: string) => ["boat", boatId, "logs", "detail", logId] as const,
  trash: (boatId: string) => ["boat", boatId, "trash"] as const,
  attachments: (boatId: string, ownerType: string, ownerId: string) =>
    ["boat", boatId, "attachments", ownerType, ownerId] as const,
  purchases: (boatId: string, filters: Record<string, unknown> = {}) =>
    ["boat", boatId, "purchases", filters] as const,
  parts: (boatId: string) => ["boat", boatId, "parts"] as const,
  expenses: (boatId: string, period: Record<string, unknown> = {}) =>
    ["boat", boatId, "expenses", period] as const,
  haulOuts: (boatId: string) => ["boat", boatId, "haul-outs"] as const,
  contacts: (boatId: string) => ["boat", boatId, "contacts"] as const,
  equipment: (boatId: string) => ["boat", boatId, "equipment"] as const,
  members: (boatId: string) => ["boat", boatId, "members"] as const,
  invitations: (boatId: string) => ["boat", boatId, "invitations"] as const,
};
