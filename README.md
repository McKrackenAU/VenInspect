# VenInspect

Web app for **bridge and drainage asset inspections** — field capture, compressed defect photos, scheduling, and management.

**Production target:** Proxmox **LXC** as the main server (native Node + systemd). Local `npm run dev` is for development only.

**One-liner (Proxmox host shell, whiptail GUI):**

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/McKrackenAU/VenInspect/main/ct/veninspect.sh)"
```

LAN / Gitea: `http://192.168.13.9:3000/McKraken/VenInspect/raw/branch/main/ct/veninspect.sh`

**Full guide:** [docs/LXC-INSTALL.md](docs/LXC-INSTALL.md)

## Git remotes

| Remote | Where | When to use |
|--------|--------|-------------|
| `origin` | Gitea `http://192.168.13.9:3000/McKraken/VenInspect` | Day-to-day push/pull (dev) |
| `github` | `https://github.com/McKrackenAU/VenInspect` | Live releases / public |

After shipping tags on GitHub, sync them to Gitea from a LAN machine:

```bash
# On Proxmox host or any host that can reach both GitHub and Gitea:
bash scripts/sync-github-to-gitea.sh
# or with a Gitea token:
GITEA_TOKEN=xxxxx bash scripts/sync-github-to-gitea.sh
```
| `github` | `https://github.com/McKrackenAU/VenInspect` | Promote to live / public |

```bash
git push -u origin main
git push github main
```

## Two portals

| Portal | URL | Purpose |
|--------|-----|---------|
| Inspection (user) | `/` | Inspections, defects, approvals, reports |
| Management | `/manage` | Asset registry, Excel/CSV import, users & qualifications |

## Brand & context

- Style: Ventia greens/blue from [Our brand](https://www.ventia.com/who-we-are/our-brand) — see CSS tokens in `src/app/globals.css`
- Agent context: `CONTEXT.md` and `.cursor/rules/veninspect.mdc`
- Licensed logos: drop into `public/brand/` when approved

## Microsoft login (planned — not built)

Entra ID / work accounts so corporate MFA applies. Stubs in `.env.example`. Do not implement until requested.

## Storage model (lightweight)

| What | Where | Why |
|------|--------|-----|
| Assets, inspections, defects, users | **SQLite** today (`{DATA_DIR}/veninspect.db`); **PostgreSQL** on the LXC for cutover | See [docs/POSTGRES-MIGRATION.md](docs/POSTGRES-MIGRATION.md) |
| Defect photos | **Filesystem** (`{PHOTO_DIR}/…`, default `{DATA_DIR}/photos`) | Never in the DB |
| Photo format | **WebP**, ≤1600px, quality ~75 | Phone originals shrink before write |

On Proxmox, set `DATA_DIR=/var/lib/veninspect` and optionally `PHOTO_DIR` on a **separate disk**. See [docs/LXC-INSTALL.md](docs/LXC-INSTALL.md).

## Production: Proxmox LXC (main server)

See the step-by-step guide: **[docs/LXC-INSTALL.md](docs/LXC-INSTALL.md)** (CT create, storage mounts, install script, updates, troubleshooting).

### CT sizing (starting point)

| Resource | Suggestion |
|----------|------------|
| OS | Debian 12, unprivileged |
| CPU | 2 vCPU |
| RAM | 2–4 GB |
| Rootfs | 8–16 GB (app + Node only) |
| Data disk | 50–200+ GB at `/var/lib/veninspect` (photos) |

### Host: attach data storage

On the Proxmox host, bind-mount durable storage into the CT (see `deploy/proxmox-ct.conf.example`):

```
mp0: /tank/veninspect-data,mp=/var/lib/veninspect
```

### Inside the CT: install

After the CT is up and the data mount exists:

```bash
# Option A — from Gitea (LAN / day-to-day):
bash deploy/install-lxc.sh http://192.168.13.9:3000/McKraken/VenInspect.git

# Option B — from GitHub (live / external):
bash deploy/install-lxc.sh https://github.com/McKrackenAU/VenInspect.git

# Option C — copy this project in (scp/rsync), then:
cd /path/to/VenInspect
sudo bash deploy/install-lxc.sh
```

That installs Node 22, builds the app under `/opt/veninspect`, stores data in `/var/lib/veninspect`, and enables the `veninspect` systemd service on port **8181**.

```bash
systemctl status veninspect
curl -I http://127.0.0.1:8181
```

Reach it on the LAN at `http://<ct-ip>:8181`. Add Caddy/nginx later for HTTPS if needed.

Optional demo data (not for real production):

```bash
sudo -u veninspect env DATA_DIR=/var/lib/veninspect npm --prefix /opt/veninspect run db:seed
```

### Updates

```bash
cd /opt/veninspect
sudo -u veninspect git pull
sudo -u veninspect npm ci
sudo -u veninspect npx prisma generate
sudo -u veninspect env DATA_DIR=/var/lib/veninspect npm run build
sudo -u veninspect env DATA_DIR=/var/lib/veninspect npx prisma migrate deploy
systemctl restart veninspect
```

## Local development

```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:8181](http://localhost:8181) → sign in.

### Default login

| Username | Password | Role |
|----------|----------|------|
| `root` | `calvin` | Admin (user + management portals) |

After `npm run db:seed`, additional demo accounts (password `calvin`):

| Username | Role |
|----------|------|
| `l1` | Inspector (L1) |
| `l2` | Inspector (L1 + L2) |

Demo asset: **SN2656 Forsyth Road Bridge**.

Use the **User / Admin** switch in the header to move between field and management portals (Admin requires an admin account).

## Stack

Next.js · TypeScript · Prisma · SQLite (→ PostgreSQL) · Sharp (WebP) · Tailwind · systemd on LXC

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run db:seed` | Reset demo data |
| `npm run db:ensure-admin` | Ensure `root` / `calvin` admin exists |
| `npm run db:migrate` | Dev migrations |
| `npx prisma migrate deploy` | Production migrations |
| `bash deploy/install-lxc.sh` | Install/update on Proxmox LXC |
