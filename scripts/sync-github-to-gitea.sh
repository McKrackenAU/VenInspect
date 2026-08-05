#!/usr/bin/env bash
# Mirror GitHub (live) tags + main onto Gitea (LAN dev).
#
# Run this from a machine that can reach BOTH:
#   - https://github.com/McKrackenAU/VenInspect
#   - http://192.168.13.9:3000/McKraken/VenInspect
#
# Examples (on Proxmox host or a LAN workstation):
#   bash scripts/sync-github-to-gitea.sh
#   GITEA_URL=http://192.168.13.9:3000/McKraken/VenInspect.git \
#   GITEA_TOKEN=xxxxx bash scripts/sync-github-to-gitea.sh
#
# Optional auth for private Gitea:
#   GITEA_TOKEN  — personal access token (preferred)
#   GITEA_USER   — username (default: git)
set -euo pipefail

GITHUB_URL="${GITHUB_URL:-https://github.com/McKrackenAU/VenInspect.git}"
GITEA_URL="${GITEA_URL:-http://192.168.13.9:3000/McKraken/VenInspect.git}"
GITEA_USER="${GITEA_USER:-git}"
WORKDIR="${WORKDIR:-$(mktemp -d /tmp/veninspect-gitea-sync-XXXXXX)}"
KEEP_WORKDIR="${KEEP_WORKDIR:-0}"

cleanup() {
  if [[ "$KEEP_WORKDIR" != "1" ]]; then
    rm -rf "$WORKDIR"
  else
    echo "Kept workdir: $WORKDIR"
  fi
}
trap cleanup EXIT

echo "==> Workdir: $WORKDIR"
echo "==> GitHub:  $GITHUB_URL"
echo "==> Gitea:   $GITEA_URL"

gitea_push_url="$GITEA_URL"
if [[ -n "${GITEA_TOKEN:-}" ]]; then
  # http://user:token@host/owner/repo.git
  gitea_push_url="$(
    python3 - <<'PY' "$GITEA_URL" "$GITEA_USER" "$GITEA_TOKEN"
import sys, urllib.parse
url, user, token = sys.argv[1], sys.argv[2], sys.argv[3]
p = urllib.parse.urlparse(url)
netloc = f"{urllib.parse.quote(user, safe='')}:{urllib.parse.quote(token, safe='')}@{p.hostname}"
if p.port:
    netloc += f":{p.port}"
print(urllib.parse.urlunparse((p.scheme, netloc, p.path, "", "", "")))
PY
  )"
fi

git clone --mirror "$GITHUB_URL" "$WORKDIR/repo.git"
cd "$WORKDIR/repo.git"

echo "==> GitHub tags (sample):"
git tag -l 'v0.*' | tail -20

echo "==> Pushing all refs to Gitea (tags + branches)…"
# Mirror push: branches + tags. Force-updates Gitea to match GitHub.
if ! git push --mirror "$gitea_push_url"; then
  echo "Mirror push failed — trying main + tags only…"
  git push "$gitea_push_url" refs/heads/main:refs/heads/main --force
  git push "$gitea_push_url" --tags --force
fi

echo "==> Done. Gitea should now have the same tags as GitHub."
echo "    Verify: git ls-remote --tags $GITEA_URL | tail"
