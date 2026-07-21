# VenInspect — Proxmox LXC install guide

This guide covers installing VenInspect as the **main server** on Proxmox.

## Fastest path (helper-scripts style — recommended)

Run this **on the Proxmox host shell** (not inside a CT). It opens a **whiptail GUI** (same idea as community-scripts), creates a Debian LXC, and installs VenInspect.

**From GitHub (live):**

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/McKrackenAU/VenInspect/main/ct/veninspect.sh)"
```

**From Gitea (LAN / dev):**

```bash
bash -c "$(curl -fsSL http://192.168.13.9:3000/McKraken/VenInspect/raw/branch/main/ct/veninspect.sh)"
```

The menu asks for CT ID, hostname, CPU/RAM/disk, storage, network, git source (Gitea vs GitHub), and optional separate photo storage.

When finished, open `http://<ct-ip>:8181/login` — default **root** / **calvin**.

| Script | Where it runs |
|--------|----------------|
| `ct/veninspect.sh` | Proxmox **host** — GUI + create CT |
| `ct/finish-install.sh` | Proxmox **host** — finish/repair an existing CT |
| `deploy/install-lxc.sh` | **Inside** the CT — Node/app/systemd |
| `install/veninspect-install.sh` | Thin wrapper → `deploy/install-lxc.sh` |

---

## Manual install (more control)

If you prefer creating the CT yourself first, continue below.

- App code at `/opt/veninspect`
- Database (SQLite) under `DATA_DIR` (default `/var/lib/veninspect`)
- Photos under `PHOTO_DIR` (default `{DATA_DIR}/photos`, or a separate large disk)
- Service listening on **port 8181**: `http://<ct-ip>:8181`

---

## 1. What you need

| Item | Notes |
|------|--------|
| Proxmox VE host | With storage for the CT and (recommended) a data volume |
| Network | CT reachable from phones/PCs on LAN (static IP or DHCP reservation) |
| Git access | **Dev:** Gitea on LAN · **Live:** GitHub |

| Source | Clone URL |
|--------|-----------|
| Gitea (dev / LAN) | `http://192.168.13.9:3000/McKraken/VenInspect.git` |
| GitHub (live) | `https://github.com/McKrackenAU/VenInspect.git` |

Prefer **Gitea** when the CT is on the same LAN. Use **GitHub** if the CT cannot reach Gitea.

---

## 2. Recommended CT size

| Resource | Starting point |
|----------|----------------|
| Template | **Debian 12** |
| Type | **Unprivileged** LXC |
| CPU | 2 vCPU |
| RAM | 2–4 GB |
| Root disk | 8–16 GB (app + Node only) |
| Data / photos | 50–200+ GB (separate mount — see below) |

Keep the **rootfs small**. Put the database and photos on mounted storage so the CT stays easy to rebuild.

---

## 3. Create the LXC (Proxmox UI)

1. **Create CT** → Debian 12 template.
2. Set hostname (e.g. `veninspect`).
3. Networking: bridge + IPv4 (static or DHCP). Note the IP for later.
4. Start the CT and open its **Console** (or SSH in as root).

### Optional: create from the Proxmox host shell

Adjust storage IDs and network to match your cluster:

```bash
pct create 120 local:vztmpl/debian-12-standard_*.tar.zst \
  --hostname veninspect \
  --cores 2 \
  --memory 2048 \
  --swap 512 \
  --rootfs local-lvm:12 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --features nesting=0 \
  --start 1
```

Use your real template path (`pveam available` / `ls /var/lib/vz/template/cache/`).

---

## 4. Attach storage (important)

You have two good patterns.

### A) One data mount (simplest)

SQLite **and** photos on the same volume at `/var/lib/veninspect`.

On the **Proxmox host**, edit `/etc/pve/lxc/<CTID>.conf` and add a bind-mount (path must exist on the host):

```conf
mp0: /tank/veninspect-data,mp=/var/lib/veninspect
```

Example with a directory on the host:

```bash
mkdir -p /tank/veninspect-data
# then add mp0 line to the CT config and restart the CT
pct stop <CTID>
pct start <CTID>
```

Or attach a second virtual disk via the UI / `pct set` and mount it inside the CT at `/var/lib/veninspect` (fstab).

### B) Separate photo disk (recommended when photos will grow)

- **Small / default:** `DATA_DIR=/var/lib/veninspect` → SQLite only (lightweight)
- **Large volume:** e.g. mount at `/mnt/veninspect-photos` → set `PHOTO_DIR` after install

Example host config:

```conf
mp0: /tank/veninspect-db,mp=/var/lib/veninspect
mp1: /tank/veninspect-photos,mp=/mnt/veninspect-photos
```

After install, set in `/etc/veninspect.env`:

```bash
DATA_DIR=/var/lib/veninspect
PHOTO_DIR=/mnt/veninspect-photos
```

Then:

```bash
mkdir -p /mnt/veninspect-photos
chown -R veninspect:veninspect /var/lib/veninspect /mnt/veninspect-photos
systemctl restart veninspect
```

You can also set the photo path later in the app: **Management → Photo storage** (unless `PHOTO_DIR` is locked in the env file).

### Photo folder layout (automatic)

```
{PHOTO_DIR}/{Road Name}/{AssetCode}/{DDMMYYYY}/SN1234-D001.webp
```

Same-day second inspection uses `{DDMMYYYY-HHmmss}`.

---

## 5. Install inside the CT

As **root** in the CT:

```bash
apt update
apt install -y git ca-certificates curl
```

### Option A — from Gitea (recommended on LAN)

```bash
git clone http://192.168.13.9:3000/McKraken/VenInspect.git /tmp/VenInspect
cd /tmp/VenInspect
bash deploy/install-lxc.sh http://192.168.13.9:3000/McKraken/VenInspect.git
```

Or in one step (script clones for you):

```bash
curl -fsSL http://192.168.13.9:3000/McKraken/VenInspect/raw/branch/main/deploy/install-lxc.sh -o /tmp/install-lxc.sh
# If raw URL differs on your Gitea version, clone then run:
git clone http://192.168.13.9:3000/McKraken/VenInspect.git /tmp/VenInspect
cd /tmp/VenInspect
sudo bash deploy/install-lxc.sh http://192.168.13.9:3000/McKraken/VenInspect.git
```

### Option B — from GitHub (live / external)

```bash
git clone https://github.com/McKrackenAU/VenInspect.git /tmp/VenInspect
cd /tmp/VenInspect
bash deploy/install-lxc.sh https://github.com/McKrackenAU/VenInspect.git
```

### What the install script does

1. Installs Node.js **22**, git, build tools  
2. Creates system user `veninspect`  
3. Clones/updates app to `/opt/veninspect`  
4. Writes `/etc/veninspect.env` (`DATA_DIR`, `PORT=8181`, …)  
5. `npm ci` → Prisma generate → production build → migrations  
6. Enables systemd unit `veninspect`  

Expect several minutes on first build.

---

## 6. Verify it works

```bash
systemctl status veninspect
curl -I http://127.0.0.1:8181
hostname -I
```

From a PC or phone on the LAN open:

```text
http://<ct-ip>:8181
```

| Portal | URL |
|--------|-----|
| Login | `http://<ct-ip>:8181/login` |
| User (field) | `http://<ct-ip>:8181/` |
| Admin (manage) | `http://<ct-ip>:8181/manage` |

Default credentials (created on install): **root** / **calvin**

### Optional demo data (lab only — not for real production)

```bash
sudo -u veninspect env DATA_DIR=/var/lib/veninspect npm --prefix /opt/veninspect run db:seed
```

Seeded logins (password `calvin`):

| Username | Role |
|----------|------|
| `root` | Admin |
| `l1` | Level 1 inspector |
| `l2` | Level 2 inspector |

### Finish a failed first install

If the helper stopped on `chown … Operation not permitted` (bind-mounted photos on an unprivileged CT), the app was never installed. On the Proxmox host:

```bash
curl -fsSL http://192.168.13.9:3000/McKraken/VenInspect/raw/branch/main/ct/finish-install.sh \
  -o /tmp/veninspect-finish.sh
bash /tmp/veninspect-finish.sh 969 /monolith/VenInspect
```

(GitHub raw URL works the same with `McKrackenAU/VenInspect`.)

Omit the photo path if you are not using a separate photo mount.

---

## 7. Useful service commands

```bash
systemctl status veninspect
systemctl restart veninspect
systemctl stop veninspect
journalctl -u veninspect -f
cat /etc/veninspect.env
```

---

## 8. Updating after new git pushes

Inside the CT:

```bash
cd /opt/veninspect

# Dev CT tracking Gitea:
sudo -u veninspect git remote -v
sudo -u veninspect git pull origin main

# Or live CT tracking GitHub:
# sudo -u veninspect git pull origin main   # if cloned from GitHub
# (or add a github remote and pull from it)

sudo -u veninspect npm ci
sudo -u veninspect npx prisma generate
sudo -u veninspect env DATA_DIR=/var/lib/veninspect npm run build
sudo -u veninspect env DATA_DIR=/var/lib/veninspect npx prisma migrate deploy
systemctl restart veninspect
```

If you used the install script with a clone URL, `/opt/veninspect` already has that remote as `origin`.

---

## 9. Network / firewall tips

- Allow **TCP 8181** from the office/field LAN to the CT IP.
- Prefer a **static IP** or DHCP reservation so bookmarks and phone home-screen installs stay stable.
- For HTTPS later: put **Caddy** or **nginx** on this CT (or a reverse-proxy CT) and proxy to `127.0.0.1:8181`.

---

## 10. Troubleshooting

| Symptom | Check |
|---------|--------|
| Service won’t start | `journalctl -u veninspect -n 80 --no-pager` |
| Build failed (Sharp / native) | Ensure `build-essential` and Node 22; re-run install |
| Blank page / 500 | Migrations: `sudo -u veninspect env DATA_DIR=/var/lib/veninspect npx prisma migrate deploy` |
| Can’t save photos | Permissions on `DATA_DIR` / `PHOTO_DIR`; `chown -R veninspect:veninspect …` |
| CT can’t clone Gitea | Ping `192.168.13.9`; use GitHub URL instead |
| Out of disk on rootfs | You put photos on root — move `PHOTO_DIR` to a large mount |

Confirm mounts inside the CT:

```bash
df -h
mount | grep veninspect
ls -la /var/lib/veninspect
```

---

## 11. Related files in this repo

| File | Purpose |
|------|---------|
| `deploy/install-lxc.sh` | One-shot install / update |
| `deploy/veninspect.service` | systemd unit |
| `deploy/proxmox-ct.conf.example` | Host mount examples |
| `.env.example` | Env variable reference |
| `CONTEXT.md` | Product / storage / portal context |

---

## Quick checklist

- [ ] Debian 12 unprivileged CT created and started  
- [ ] Data mount at `/var/lib/veninspect` (and optional photo mount)  
- [ ] `bash deploy/install-lxc.sh <repo-url>` completed  
- [ ] `systemctl status veninspect` is active  
- [ ] Browser opens `http://<ct-ip>:8181`  
- [ ] (Optional) separate `PHOTO_DIR` set for large photo volume  
- [ ] (Optional) demo seed only if this is a test box  

You’re done — VenInspect is running as the LXC main server.
