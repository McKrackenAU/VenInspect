# PostgreSQL migration (SQLite → Postgres)

VenInspect historically stores structured data in **SQLite** (`{DATA_DIR}/veninspect.db`) via Prisma + LibSQL. Photos and documents stay on disk under `PHOTO_DIR` / `DATA_DIR` and are **not** moved into the database.

**Long-term target:** PostgreSQL running **inside the same LXC** as the app.

## Current state (this release)

| Piece | Status |
|-------|--------|
| App runtime | Still **SQLite** |
| LXC install | Installs **PostgreSQL** locally by default (`INSTALL_POSTGRES=1`) |
| Credentials | Written to `/etc/veninspect.env` as `POSTGRES_*` + `DATABASE_URL_POSTGRES` |
| Cutover | Manual — set `DATABASE_URL` only after the app supports Postgres (next phase) |

Skip Postgres on install: `INSTALL_POSTGRES=0 bash deploy/install-lxc.sh …`

Standalone (existing CT):

```bash
bash /opt/veninspect/deploy/install-postgres.sh
```

## Why this order

1. **Install Postgres now** so the CT already has a local server, role, and empty database.
2. **Keep serving from SQLite** until Prisma is switched and data is copied — no production risk.
3. **Cut over** once migrations and a dry-run copy succeed.
4. **Remove SQLite** (LibSQL adapter, `veninspect.db` assumptions) after a stable soak period.

Prisma only supports **one** `provider` per schema, so the app cannot speak SQLite and Postgres from the same generated client. Dual-run means: empty Postgres ready + SQLite active, then a short maintenance window to switch.

## Phase 2 — app cutover (next engineering pass)

1. Change `prisma/schema.prisma` `provider` to `postgresql`.
2. Replace `@prisma/adapter-libsql` with `@prisma/adapter-pg` + `pg` in `src/lib/db.ts`.
3. Teach `prisma.config.ts` / `getDatabaseUrl()` to honour `postgresql://…` `DATABASE_URL`.
4. Generate a **new** Postgres migration history (baseline from current schema); do not replay SQLite SQL as-is.
5. Data copy: export from SQLite → import into Postgres (script below + cutover checklist).
6. Point production at Postgres; verify; then delete SQLite paths/deps.

## Phase 3 — remove SQLite

After soak (recommended: 1–2 weeks of production use):

- Remove `@libsql/client`, `@prisma/adapter-libsql`
- Remove `file:` DB helpers that assume `veninspect.db`
- Archive or delete `{DATA_DIR}/veninspect.db` (keep a backup first)

## Cutover checklist (ops)

Maintenance window (~15–30 min depending on data size).

1. **Backup**
   ```bash
   systemctl stop veninspect
   cp -a /var/lib/veninspect/veninspect.db /var/lib/veninspect/veninspect.db.bak-$(date +%Y%m%d)
   sudo -u postgres pg_dump -Fc veninspect > /var/lib/veninspect/pg-pre-cutover.dump || true
   ```

2. **Export SQLite** (from app tree, with DATA_DIR set):
   ```bash
   cd /opt/veninspect
   sudo -u veninspect env DATA_DIR=/var/lib/veninspect npm run db:export-sqlite
   # writes /var/lib/veninspect/exports/sqlite-export-*.json
   ```

3. **Apply Postgres schema** (after Phase 2 app build that uses `provider = postgresql`):
   ```bash
   # In /etc/veninspect.env — activate URL (use the value of DATABASE_URL_POSTGRES):
   # DATABASE_URL=postgresql://veninspect:…@127.0.0.1:5432/veninspect
   systemctl daemon-reload
   cd /opt/veninspect
   sudo -u veninspect env $(grep -v '^#' /etc/veninspect.env | xargs) npx prisma migrate deploy
   ```

4. **Import data** into Postgres (Phase 2 import script).

5. **Start & smoke-test**
   ```bash
   systemctl start veninspect
   # Login, open an asset, draft inspection, PDF export, manage dashboard
   ```

6. **Rollback** (if needed): stop service, comment out `DATABASE_URL`, restore SQLite file, start service.

## Resources

| Resource | Starting point with Postgres |
|----------|------------------------------|
| CT RAM | **4 GB** recommended (2 GB may work for light use) |
| Root disk | Still 8–16 GB (Postgres data lives under `/var/lib/postgresql`) |
| App data disk | Still for photos + SQLite backup during transition |

## Security notes

- Postgres listens on **localhost** only by default — good for a single-app LXC.
- Password is in `/etc/veninspect.env` (`chmod 640`, group `veninspect`).
- Do not expose `5432` on the LAN unless you add TLS and host firewall rules.

## Related files

- `deploy/install-postgres.sh` — package, role, database, env keys
- `deploy/install-lxc.sh` — calls Postgres install when `INSTALL_POSTGRES=1`
- `deploy/veninspect.service` — `After=` / `Wants=` `postgresql.service`
- `scripts/export-sqlite-json.ts` — `npm run db:export-sqlite`
