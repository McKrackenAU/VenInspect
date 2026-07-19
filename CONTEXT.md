# VenInspect — project context

This file is the human-readable twin of `.cursor/rules/veninspect.mdc`. Keep both in sync when product decisions change.

## Repo remotes

| Remote | URL | Use |
|--------|-----|-----|
| **`origin`** (dev) | `http://192.168.13.9:3000/McKraken/VenInspect.git` | Day-to-day push/pull (Gitea on LAN) |
| **`github`** (live) | `https://github.com/McKrackenAU/VenInspect.git` | Production / public backup |

```bash
git push -u origin main          # develop → Gitea
git push github main             # promote → GitHub when ready for live
```

## Purpose

Inspect **bridges**, **drainage/culverts**, and **noise walls** on site (web/mobile-friendly), with a web **management portal** for the asset registry and users, and a **user portal** for inspections and reports.

## Portals

1. **User portal** — inspections, defects + photos, scheduling, L2 verification, full report + **scope export** (select defects)
2. **Management portal** (`/manage`) — asset registry (by road → asset), Excel/CSV import, **photo storage path**, users/qualifications

## Mobile & apps

- **Primary UX:** mobile-first web UI — large buttons, bottom nav, search-to-select assets, camera capture for defects
- **Install on phones:** Progressive Web App (`/manifest.webmanifest`) — “Add to Home Screen” / Install prompt
- **Native stores later:** wrap the same Next app with **Capacitor** (or similar) for App Store / Play Store; do not fork a separate React Native app unless required
- Keep copy plain-language for non-technical field staff

## Storage (DB vs photos)

| | Default | Proxmox tip |
|-|---------|-------------|
| **DATA_DIR** | `./data` → SQLite | Small rootfs / main disk |
| **PHOTO_DIR** | `{DATA_DIR}/photos` | Optional large passthrough mount |

Priority for photo path: env `PHOTO_DIR` → Management UI (`data/settings.json`) → `{DATA_DIR}/photos`.

Photo folder layout:

```
{PHOTO_DIR}/{Road Name}/{AssetCode}/{DDMMYYYY}/SN1234-D001.webp
```

Same-day second inspection on an asset uses `{DDMMYYYY-HHmmss}`. Inspection `titleLabel` example: `Kororoit Creek Road - SN1234 - 19072026` (time added when needed).

## Assets

- Grouped by **roadName**, then **assetNumber** (Code)
- Asset Vision ID, lat/long optional
- Types: BRIDGE | DRAINAGE | NOISE_WALL

## Inspections

- Always store `submittedAt` (time) for same-day disambiguation
- `folderKey` + `titleLabel` link SQL ↔ photo folders
- Parent/child: `relationKind` + `parentInspectionId`; combine two reports from asset page
- Scope document: `/inspections/[id]/scope` — tick defects → Print/PDF

## Brand

Ventia greens/blue — see `globals.css`. Logos in `public/brand/` when licensed.

## Microsoft login (planned, not implemented)

Entra ID / work MFA — stubs in `.env.example`.

## Hosting

Proxmox LXC — see `README.md` / `deploy/`.

## Repo

| | |
|-|-|
| **Dev (Gitea)** | http://192.168.13.9:3000/McKraken/VenInspect — git remote `origin` |
| **Live (GitHub)** | https://github.com/McKrackenAU/VenInspect — git remote `github` |
