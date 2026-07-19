# VenInspect

Web app for **bridge and drainage asset inspections** — field capture, compressed defect photos, scheduling, and management.

**Production target:** Proxmox **LXC** as the main server (native Node + systemd). Local `npm run dev` is for development only.

## Storage model (lightweight)

| What | Where | Why |
|------|--------|-----|
| Assets, inspections, defects, users | **SQLite** (`{DATA_DIR}/veninspect.db`) | Tiny metadata — many reports stay cheap |
| Defect photos | **Filesystem** (`{DATA_DIR}/uploads/...`) | Never in the DB |
| Photo format | **WebP**, ≤1600px, quality ~75 | Phone originals shrink before write |

On Proxmox, set `DATA_DIR=/var/lib/veninspect` and **mount a separate disk/dataset** there so photos grow outside the CT rootfs.

## Production: Proxmox LXC (main server)

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
# Option A — from GitHub once the repo is pushed:
bash deploy/install-lxc.sh https://github.com/<you>/VenInspect.git

# Option B — copy this project in (scp/rsync), then:
cd /path/to/VenInspect
sudo bash deploy/install-lxc.sh
```

That installs Node 22, builds the app under `/opt/veninspect`, stores data in `/var/lib/veninspect`, and enables the `veninspect` systemd service on port **3000**.

```bash
systemctl status veninspect
curl -I http://127.0.0.1:3000
```

Reach it on the LAN at `http://<ct-ip>:3000`. Add Caddy/nginx later for HTTPS if needed.

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

Open [http://localhost:3000](http://localhost:3000).

### Demo users

| Email | Role | Qualifications |
|-------|------|----------------|
| admin@veninspect.local | Admin | L1 + L2 |
| l1@veninspect.local | Inspector | L1 only |
| l2@veninspect.local | Inspector | L1 + L2 |

Demo asset: **SN2656 Forsyth Road Bridge**.

## Stack

Next.js · TypeScript · Prisma · SQLite · Sharp (WebP) · Tailwind · systemd on LXC

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run db:seed` | Reset demo data |
| `npm run db:migrate` | Dev migrations |
| `npx prisma migrate deploy` | Production migrations |
| `bash deploy/install-lxc.sh` | Install/update on Proxmox LXC |
