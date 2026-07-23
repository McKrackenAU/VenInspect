export type DashboardRange = "24h" | "7d" | "30d" | "90d" | "365d";

export const DASHBOARD_RANGES: { value: DashboardRange; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last 12 months" },
];

export function parseDashboardRange(raw: string | null | undefined): DashboardRange {
  const v = (raw ?? "7d") as DashboardRange;
  if (DASHBOARD_RANGES.some((r) => r.value === v)) return v;
  return "7d";
}

export type DashboardPayload = {
  generatedAt: string;
  range: DashboardRange;
  rangeLabel: string;
  stats: {
    completedInRange: number;
    submittedInRange: number;
    approvedInRange: number;
    pendingApproval: number;
    draftsOpen: number;
    overdueAssets: number;
    dueSoonAssets: number;
    byLevel: { level: string; label: string; count: number }[];
    byAuditor: { userId: string; name: string; count: number }[];
    byAssetType: { type: string; label: string; count: number }[];
  };
  recentlySubmitted: {
    id: string;
    titleLabel: string;
    assetNumber: string;
    roadName: string;
    level: string;
    levelLabel: string;
    status: string;
    auditorName: string;
    at: string;
    defectCount: number;
  }[];
  inProgress: {
    id: string;
    titleLabel: string;
    assetNumber: string;
    roadName: string;
    level: string;
    levelLabel: string;
    status: string;
    auditorName: string;
    updatedAt: string;
  }[];
  dueSoon: {
    assetId: string;
    assetNumber: string;
    roadName: string;
    level: string;
    levelLabel: string;
    nextDueAt: string;
    daysUntilDue: number;
  }[];
  overdue: {
    assetId: string;
    assetNumber: string;
    roadName: string;
    level: string;
    levelLabel: string;
    nextDueAt: string;
    daysOverdue: number;
    existingAssignmentId: string | null;
    existingAssigneeName: string | null;
  }[];
  inspectors: { id: string; name: string }[];
};

export function formatDashWhen(iso: string) {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const mon = months[d.getMonth()];
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${dd} ${mon} ${yyyy} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

export function formatDashDay(iso: string) {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${dd} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return iso;
  }
}
