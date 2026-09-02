import {
  AnchorIcon,
  ContactIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  NotebookPenIcon,
  PackageIcon,
  SailboatIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "dashboard"
  | "logs"
  | "checklist"
  | "supplies"
  | "haulOuts"
  | "contacts"
  | "boat"
  | "members"
  | "settings";

// Serializable (Server → Client Components): icons are resolved from the key on the client.
export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
};

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  logs: NotebookPenIcon,
  checklist: ListChecksIcon,
  supplies: PackageIcon,
  haulOuts: AnchorIcon,
  contacts: ContactIcon,
  boat: SailboatIcon,
  members: UsersIcon,
  settings: SettingsIcon,
};

// Keys shown as bottom tabs on iPhone / iPad portrait; the rest opens in the « Plus » sheet.
export const PRIMARY_NAV_KEYS: NavKey[] = ["dashboard", "logs", "checklist", "supplies"];
