export type PermitKey =
  | "CONFINED_SPACE"
  | "TRAFFIC_MANAGEMENT"
  | "WORKING_AT_HEIGHTS";

/** Site permit flags — safe for client components (no Node fs). */
export const ASSET_PERMIT_FLAGS: {
  key: PermitKey;
  assetField:
    | "requireConfinedSpace"
    | "requireTrafficManagement"
    | "requireWorkingAtHeights";
  label: string;
  hint: string;
}[] = [
  {
    key: "CONFINED_SPACE",
    assetField: "requireConfinedSpace",
    label: "Confined spaces permit",
    hint: "Entry into confined spaces",
  },
  {
    key: "TRAFFIC_MANAGEMENT",
    assetField: "requireTrafficManagement",
    label: "Traffic management",
    hint: "Lane closures / TMP on site",
  },
  {
    key: "WORKING_AT_HEIGHTS",
    assetField: "requireWorkingAtHeights",
    label: "Working at heights / EWP",
    hint: "Elevated work platform or heights permit",
  },
];
