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

/** Safe git ref for clone --branch (tags or main). Rejects shell metacharacters. */
export function sanitizeUpdateRef(raw: string | null | undefined): string | null {
  const ref = (raw ?? "").trim();
  if (!ref) return null;
  if (ref === "main") return "main";
  // Prefer release tags like v0.1.58 or 0.1.58
  if (!/^[A-Za-z0-9._/-]{1,64}$/.test(ref)) return null;
  if (ref.includes("..") || ref.startsWith("-") || ref.startsWith("/")) return null;
  return ref;
}

export type RemoteRelease = {
  tag: string;
  version: string;
  name: string;
  publishedAt: string | null;
  prerelease: boolean;
};

function releasesApiUrl(channel: UpdateChannel): string | null {
  if (channel === "github") {
    return "https://api.github.com/repos/McKrackenAU/VenInspect/releases?per_page=30";
  }
  const base =
    process.env.GITEA_API_BASE?.trim() ||
    process.env.GITEA_RAW_BASE?.trim()?.replace(/\/raw\/branch\/main\/?$/, "") ||
    "http://192.168.13.9:3000/McKraken/VenInspect";
  // Gitea API: /api/v1/repos/{owner}/{repo}/releases
  if (base.includes("/api/v1/")) return `${base.replace(/\/$/, "")}/releases?limit=30`;
  try {
    const u = new URL(base.includes("://") ? base : `http://${base}`);
    const parts = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    // pathname like /McKraken/VenInspect
    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts[1];
      return `${u.origin}/api/v1/repos/${owner}/${repo}/releases?limit=30`;
    }
  } catch {
    /* fall through */
  }
  return "http://192.168.13.9:3000/api/v1/repos/McKraken/VenInspect/releases?limit=30";
}

function tagsApiUrl(channel: UpdateChannel): string | null {
  if (channel === "github") {
    return "https://api.github.com/repos/McKrackenAU/VenInspect/tags?per_page=30";
  }
  return null;
}

function parseReleasesJson(text: string): RemoteRelease[] {
  try {
    const json = JSON.parse(text) as Array<{
      tag_name?: string;
      name?: string;
      published_at?: string;
      created_at?: string;
      prerelease?: boolean;
      draft?: boolean;
    }>;
    if (!Array.isArray(json)) return [];
    const out: RemoteRelease[] = [];
    for (const item of json) {
      if (item.draft) continue;
      const tag = (item.tag_name || item.name || "").trim();
      if (!tag) continue;
      const version = tag.replace(/^v/i, "");
      if (!/^\d+\.\d+/.test(version)) continue;
      out.push({
        tag: tag.startsWith("v") || tag.startsWith("V") ? tag : `v${version}`,
        version,
        name: (item.name || tag).trim(),
        publishedAt: item.published_at || item.created_at || null,
        prerelease: Boolean(item.prerelease),
      });
    }
    return out;
  } catch {
    return [];
  }
}

function parseTagsJson(text: string): RemoteRelease[] {
  try {
    const json = JSON.parse(text) as Array<{ name?: string }>;
    if (!Array.isArray(json)) return [];
    const out: RemoteRelease[] = [];
    for (const item of json) {
      const tag = (item.name || "").trim();
      if (!tag) continue;
      const version = tag.replace(/^v/i, "");
      if (!/^\d+\.\d+/.test(version)) continue;
      out.push({
        tag: tag.startsWith("v") || tag.startsWith("V") ? tag : `v${version}`,
        version,
        name: tag,
        publishedAt: null,
        prerelease: false,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** List published releases/tags for the version picker (newest first). */
export async function listRemoteReleases(
  channel: UpdateChannel,
): Promise<{ releases: RemoteRelease[]; repoLabel: string; error?: string }> {
  const urls = remoteVersionUrls(channel);
  const headers: HeadersInit = {
    "User-Agent": "VenInspect-UpdateCheck",
    Accept: "application/json",
    "Cache-Control": "no-cache",
  };

  const releaseUrl = releasesApiUrl(channel);
  if (releaseUrl) {
    try {
      const res = await fetch(
        releaseUrl.includes("?")
          ? `${releaseUrl}&_=${Date.now()}`
          : `${releaseUrl}?_=${Date.now()}`,
        { cache: "no-store", headers, signal: AbortSignal.timeout(15000) },
      );
      if (res.ok) {
        const releases = parseReleasesJson(await res.text());
        if (releases.length > 0) {
          return { releases, repoLabel: urls.repoLabel };
        }
      }
    } catch {
      /* try tags */
    }
  }

  const tagUrl = tagsApiUrl(channel);
  if (tagUrl) {
    try {
      const res = await fetch(`${tagUrl}&_=${Date.now()}`, {
        cache: "no-store",
        headers,
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const releases = parseTagsJson(await res.text());
        if (releases.length > 0) {
          return { releases, repoLabel: urls.repoLabel };
        }
      }
    } catch {
      /* fall through */
    }
  }

  return {
    releases: [],
    repoLabel: urls.repoLabel,
    error: `Could not list releases from ${urls.repoLabel}`,
  };
}
