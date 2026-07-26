/** Shared admin navigation — keep ribbon primary, drawer for the rest. */

export type AdminNavLink = {
  href: string;
  label: string;
  description?: string;
};

/** Primary ribbon / mobile tabs */
export const adminPrimaryLinks: AdminNavLink[] = [
  { href: "/manage", label: "Dashboard" },
  { href: "/manage/assets", label: "Assets" },
  { href: "/manage/reports", label: "Reports" },
  { href: "/manage/schedule", label: "Schedule" },
  { href: "/manage/users", label: "People" },
];

export type AdminNavGroup = {
  title: string;
  links: AdminNavLink[];
};

/** Burger / side drawer — everything else that used to crowd the ribbon */
export const adminMenuGroups: AdminNavGroup[] = [
  {
    title: "Registry",
    links: [
      {
        href: "/manage/assets",
        label: "Assets",
        description: "Browse and edit the structure register",
      },
      {
        href: "/manage/reports",
        label: "Reports",
        description: "All inspections — filter, export, bulk trash/purge",
      },
      {
        href: "/manage/assets/import",
        label: "Import Excel / CSV",
        description: "Bulk load or update assets",
      },
      {
        href: "/manage/storage",
        label: "Photo storage",
        description: "Where inspection photos are stored",
      },
      {
        href: "/manage/schedule",
        label: "Schedule board",
        description: "Assignments and due dates",
      },
    ],
  },
  {
    title: "Catalogues",
    links: [
      {
        href: "/manage/severities",
        label: "Condition states",
        description: "Severity / CS labels",
      },
      {
        href: "/manage/inspection-types",
        label: "Inspection types",
        description: "L1, L2, and custom types",
      },
      {
        href: "/manage/asset-types",
        label: "Asset types",
        description: "Bridge, drainage, noise wall…",
      },
      {
        href: "/manage/document-tags",
        label: "Document tags",
        description: "Labels for asset documents",
      },
      {
        href: "/manage/inspection-templates",
        label: "Inspection templates",
        description: "Form pages and fields",
      },
      {
        href: "/manage/task-types",
        label: "Defect task types",
        description: "RM, Investigate, Monitor…",
      },
      {
        href: "/manage/export-config",
        label: "Export configurator",
        description: "PDF / client export defaults",
      },
    ],
  },
  {
    title: "System",
    links: [
      {
        href: "/manage/system",
        label: "System & updates",
        description: "Version, maps, date/time prefs",
      },
      {
        href: "/manage/trash",
        label: "Trash",
        description: "Restore or purge soft-deleted reports",
      },
      {
        href: "/manage/system/assetvision",
        label: "Assetvision",
        description: "API connection for sync",
      },
      {
        href: "/manage/system/tunnel",
        label: "Cloudflare Tunnel",
        description: "Remote HTTPS (root)",
      },
      {
        href: "/manage/users",
        label: "People",
        description: "Users and qualifications",
      },
    ],
  },
];

export function adminLinkActive(pathname: string, href: string): boolean {
  if (href === "/manage") return pathname === "/manage";
  // Keep Assets highlight off the Import sub-route (separate menu item)
  if (href === "/manage/assets") {
    if (pathname.startsWith("/manage/assets/import")) return false;
    return (
      pathname === "/manage/assets" || pathname.startsWith("/manage/assets/")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
