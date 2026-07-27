import fs from "node:fs";
import path from "node:path";

/** App semver — keep VERSION and package.json in sync. */
export function getAppVersion(): string {
  try {
    const fromFile = fs
      .readFileSync(path.join(process.cwd(), "VERSION"), "utf8")
      .trim();
    if (fromFile) return fromFile.replace(/^v/i, "");
  } catch {
    /* fall through */
  }
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { version?: string };
    if (pkg.version) return pkg.version.replace(/^v/i, "");
  } catch {
    /* fall through */
  }
  return "0.0.0";
}

export function formatAppVersion(version = getAppVersion()): string {
  return `v${version.replace(/^v/i, "")}`;
}

export type UpdateChannel = "gitea" | "github";

/**
 * Default update channel. Live / internet installs use GitHub; set
 * UPDATE_CHANNEL=gitea for LAN-only Gitea deployments.
 */
export function getConfiguredUpdateChannel(): UpdateChannel {
  const raw = (process.env.UPDATE_CHANNEL || process.env.VENINSPECT_UPDATE_SOURCE || "")
    .trim()
    .toLowerCase();
  if (raw === "gitea") return "gitea";
  if (raw === "github" || raw === "gh") return "github";
  // Live repo is GitHub — prefer it when unset
  return "github";
}

export function remoteVersionUrls(channel: UpdateChannel): {
  packageJson: string;
  versionFile: string;
  /** Extra VERSION URLs to try if the primary fails */
  versionFileFallbacks?: string[];
  repoLabel: string;
} {
  if (channel === "github") {
    return {
      packageJson:
        "https://raw.githubusercontent.com/McKrackenAU/VenInspect/main/package.json",
      // Prefer Releases API first — raw.githubusercontent.com can CDN-cache VERSION
      // for minutes/hours after a push, which hides brand-new tags from the updater.
      versionFile:
        "https://api.github.com/repos/McKrackenAU/VenInspect/releases/latest",
      versionFileFallbacks: [
        "https://api.github.com/repos/McKrackenAU/VenInspect/tags",
        "https://api.github.com/repos/McKrackenAU/VenInspect/contents/VERSION?ref=main",
        "https://github.com/McKrackenAU/VenInspect/raw/main/VERSION",
        "https://raw.githubusercontent.com/McKrackenAU/VenInspect/main/VERSION",
      ],
      repoLabel: "GitHub (McKrackenAU/VenInspect)",
    };
  }
  const base =
    process.env.GITEA_RAW_BASE?.trim() ||
    "http://192.168.13.9:3000/McKraken/VenInspect/raw/branch/main";
  return {
    packageJson: `${base}/package.json`,
    versionFile: `${base}/VERSION`,
    repoLabel: "Gitea (McKraken/VenInspect)",
  };
}

export function parseRemoteVersion(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed) as
        | {
            version?: string;
            tag_name?: string;
            name?: string;
          }
        | Array<{ name?: string; tag_name?: string }>;

      // GitHub /tags list — take the first (newest) tag
      if (Array.isArray(json)) {
        const tag = (json[0]?.name || json[0]?.tag_name || "").replace(/^v/i, "");
        return tag || null;
      }

      // package.json → version; GitHub release → tag_name
      const fromPkg = json.version?.replace(/^v/i, "");
      if (fromPkg) return fromPkg;
      const fromTag = (json.tag_name || json.name || "").replace(/^v/i, "");
      return fromTag || null;
    } catch {
      return null;
    }
  }
  return trimmed.replace(/^v/i, "").split(/\s/)[0] || null;
}

/** Compare semver-ish a vs b: 1 if a>b, -1 if a<b, 0 if equal. */
export function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((n) => Number.parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}
