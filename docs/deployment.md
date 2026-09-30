# Deploying FarmOps

*Single-instance deployment today. The shape we'd run at scale is called out
explicitly so nobody has to guess what changes.*

---

## 1. Requirements

- Node.js 20+ (24 LTS recommended)
- PostgreSQL 15+ (Neon/Supabase/RDS all fine)
- SMTP credentials (any provider nodemailer can talk to)
- TLS-terminating reverse proxy (Caddy/nginx) or platform HTTPS
- Persistent disk **or** object storage for `public/uploads` (ADR-004)

## 2. Environment

`.env.example` lists every key; the load-bearing ones:

| Var | Notes |
|---|---|
| `DATABASE_URL` | Postgres, TLS required at the provider |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` — **rotating it logs everyone out** |
| `NEXTAUTH_URL` | Must be the public **https://** origin — cookie `Secure` flag depends on it |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Password-reset email is the only hard dependency |
| `NEXT_PUBLIC_APP_URL` | Absolute URL builder for links |

**Never** commit `.env`. Deploy-time injection only.

## 3. Build & run

```bash
npm ci --legacy-peer-deps        # lockfile-exact (peer-dep note: docs/contributing.md)
npx prisma generate              # postinstall normally does this
npx prisma migrate deploy        # ← production: migrations ONLY, never db push
npm run build
npm run start                    # or: node node_modules/next/dist/bin/next start
```

**`db push` vs `migrate deploy`:** `db push` (dev convenience) silently
alters tables with no migration history — see ADR-003. Production schema
changes go through `prisma migrate dev` locally, get reviewed as SQL, and
land via `migrate deploy`.

## 4. Pre-deploy checklist

- [ ] `npx tsc --noEmit` — clean
- [ ] `npm test` — all green
- [ ] `npm audit --audit-level=critical` — 0 (CI gate)
- [ ] Route guard sweep passes (see
      [security/api-security.md](./security/api-security.md) §2)
- [ ] **`/api/seed` is not routable** — it's `NODE_ENV`-gated, and the plan
      is to delete it outright before launch (SEC-17). Confirm
      `NODE_ENV=production`.
- [ ] Migrations reviewed and `migrate deploy` dry-run against a scratch DB
- [ ] `public/uploads` backed up alongside the DB (they must restore together)
- [ ] Reverse proxy sets `X-Forwarded-For` — rate limiting keys off client IP
- [ ] HTTPS only; HSTS header recommended at the proxy (SEC-21)

## 5. Post-deploy smoke test

1. Register a user → must land as `FIELD_WORKER`, dashboard shows zeros.
2. Login, create a farm, assign the user → data appears.
3. `GET /api/users` as that user → **403**.
4. Same request with `?farmId=<other>` → still only own-farm data.
5. Forgot-password flow → email arrives, link works once, expires after 1 hour.
6. Upload an image → served from `/uploads/…` with the generated filename.

## 6. Backups & recovery

- **Nightly logical backup** (`pg_dump`) with 30-day retention; restore
  drill once per quarter into a scratch database.
- Uploads directory rsynced/snapshotted **on the same schedule** — a DB
  restored without its files yields broken image links; files without the DB
  are orphaned.
- RTO target: 4 hours. RPO: 24 hours (daily). Honest note: if that's not
  enough for harvest week, move to PITR — it's a provider flag, not a project.

## 7. Logging & health

- App logs to stdout (structured `console.error` in catch blocks) → whatever
  the platform collects (journald/CloudWatch/etc.).
- Liveness: any authed page or `GET /api/auth/session`.
- Audit trail lives in the `AuditLog` table — check it after deploys that
  touch auth or mutations.

## 8. Scaling path (when to change shape)

| Trigger | Change |
|---|---|
| CPU pegged by SSR | Second app instance **behind one LB** |
| Second instance deployed | **Rate limits and API keys must move out of process first** (SEC-18) — they're per-process `Map`s today; two instances = 2× the limit and lost keys on restart |
| Uploads > ~10 GB or slow backups | Object storage (ADR-004 `FileStore` impl #2) |
| DB CPU/latency | Read replica for reports/exports; `pgbouncer` if connection-bound |
| Background jobs slow requests (export, alert fan-out) | Extract worker — first justified service boundary |

Until item 2 lands, **running two instances is actively worse than one**:
limits double and keys vanish on rolling restarts. Single-instance with
vertical scaling is the correct posture today, and ADR-004 documents the
same logic for storage.

## 9. Rollback

1. Redeploy previous image/commit.
2. Schema: only forward-compatible migrations get deployed with code —
   expand/contract pattern (add nullable column → backfill → switch reads →
   drop old). No destructive migration in the same release as its caller.
3. Confirm smoke test, then investigate from logs + `AuditLog`.

## 10. Environments

| Env | Purpose |
|---|---|
| local | `npm run dev`, `db push` + seed allowed |
| staging | Production-shaped, synthetic data, migration dry-runs |
| production | The checklist above, no exceptions |

Secrets differ per env; never share `NEXTAUTH_SECRET` between them — a
leaked staging secret must not mint production sessions.
