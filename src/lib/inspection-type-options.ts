/** Shared inspection-type shape — safe for client bundles (no Node fs). */
export type InspectionTypeOption = {
  value: string;
  label: string;
  description: string;
  /** When true, non–Level-2-qualified inspectors need L2 approval on submit */
  requiresLevel2Approval?: boolean;
};

export const DEFAULT_INSPECTION_TYPES: InspectionTypeOption[] = [
  {
    value: "LEVEL_1",
    label: "Level 1",
    description: "Routine check (about every 3 years)",
  },
  {
    value: "LEVEL_2",
    label: "Level 2",
    description: "Detailed check — may need a Level 2 person to approve",
    requiresLevel2Approval: true,
  },
];
