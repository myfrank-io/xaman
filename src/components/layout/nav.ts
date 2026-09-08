import {
  AnchorIcon,
  CircleUserIcon,
  ContactIcon,
  InboxIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  NotebookPenIcon,
  PackageIcon,
  SailboatIcon,
  SettingsIcon,
  Trash2Icon,
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
  | "inbox"
  | "boat"
  | "trash"
  | "members"
  | "settings"
  | "profile";

// Serializable (Server → Client Components): icons are resolved from the key on the client.
export type NavItem = {
  key: NavKey;
  href: string;
  label: string;
  /** Tab label (< 1024 px): « Bord », « Journal »… falls back to `label`. */
  shortLabel?: string;
  /**
   * The red dot: what is to be done TODAY on that screen — late, or due within the day (D88).
   * Never a section total; nothing is rendered when it is 0 or undefined.
   */
  badge?: number;
  /** Context value shown on the right of a « Plus » sheet row. */
  hint?: string;
  /** Kept in the list but not rendered (empty trash, role without access…). */
  hidden?: boolean;
};

export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  logs: NotebookPenIcon,
  checklist: ListChecksIcon,
  supplies: PackageIcon,
  haulOuts: AnchorIcon,
  contacts: ContactIcon,
  inbox: InboxIcon,
  boat: SailboatIcon,
  trash: Trash2Icon,
  members: UsersIcon,
  settings: SettingsIcon,
  profile: CircleUserIcon,
};

// The four questions of the product (ux-flows §1.1): bottom tabs + sidebar group 1.
// Checklist sits second: it is the differentiator and the spring peak of usage.
export const PRIMARY_NAV_KEYS: NavKey[] = ["dashboard", "checklist", "logs", "boat"];

// Management screens: top of the « Plus » sheet + sidebar group 2.
// Haul-outs left the navigation: they become a tab of the log book.
// « À valider » (D91) opens the sheet: what arrived on its own is the first thing to look at.
export const SECONDARY_NAV_KEYS: NavKey[] = ["inbox", "supplies", "contacts", "trash"];

// Account menu: sidebar footer (≥ lg) and bottom of the « Plus » sheet.
export const ACCOUNT_NAV_KEYS: NavKey[] = ["settings", "members", "profile"];

function navItem(items: NavItem[], key: NavKey): NavItem | undefined {
  const item = items.find((i) => i.key === key);
  return item && !item.hidden ? item : undefined;
}

export function navGroup(items: NavItem[], keys: NavKey[]): NavItem[] {
  return keys.map((key) => navItem(items, key)).filter((item): item is NavItem => Boolean(item));
}
