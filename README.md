# FarmOps

**FarmOps helps medium-size farms reduce input waste and coordinate field operations across planting, maintenance, and harvest seasons.**

It is the operational layer between the field and the store: what was ordered, what arrived, which lot went where, what got counted, what was wasted — scoped to one farm, auditable per action, usable by field staff on a phone.

Built for farms running 20–500 hectares across several plots in Ghana (GH₵, kg/bags/liters, English + Twi + Ga + Ewe), where input prices are high, loss hurts, and the answer to "where did those 40 bags of NPK go?" needs to exist.

---

## Engineering metrics

Measured on `master`, not estimated:

| Metric | Value | Tool |
|---|---|---|
| Type coverage | **92.5%** (37,041 / 40,034) | `type-coverage` |
| TypeScript | `strict: true`, **0 errors** | `tsc --noEmit` |
| Unit tests | **138 passing** (12 suites — incl. 62 adversarial security/atomicity tests) | Vitest |
| Branch coverage, tested lib modules | **91.2%** | `vitest --coverage` |
| Critical vulnerabilities, production deps | **0** | `npm audit --omit=dev` |
| High vulnerabilities, production deps | **0** (2 moderate accepted — see [security.md](docs/security.md)) | `npm audit --omit=dev` |
| Authenticated API routes | **45/49 guarded** — 4 are intentionally public auth endpoints | route sweep |
| Tenant isolation | **100% of data routes** scoped server-side from the session | `resolveFarmScope` |
| Ownership checks | **100% of per-ID mutations** (scoped lookup → 404, never 403) | audit |
| Stock mutations | **atomic** — conditional updates inside DB transactions; lost race → 409 | `src/lib/stock.ts` + race tests |
| Idempotency | `Idempotency-Key` on transactions, transfer, split, approvals, PO submission | `src/lib/idempotency.ts` |
| API keys | stored **SHA-256 hashed**, scope-enforced per route | `src/lib/api-keys.ts` |
| Login throttling | 5 failed attempts / IP+account / 15 min, no lockout DoS | `src/lib/rate-limit.ts` |
| Security headers | CSP + HSTS + frame/nosniff policy on every response | `src/middleware.ts` |
| Health endpoint | `GET /api/health` (DB probe, 200/503) | deployment checks |
| Raw SQL / `dangerouslySetInnerHTML` | **0 / 0** | grep |

Honest gaps (they're tracked, not hidden): statement coverage across `src/lib` is 16% — tests cover the tested modules well but whole modules are untested; route handlers have no unit coverage (the Farm A/B HTTP matrix is the next E2E target). See [docs/testing.md](docs/testing.md) §2. The full hardening status — including deferred items like distributed rate limiting and the DTO/`any` sweep — is mapped recommendation-by-recommendation in [docs/PRODUCTION_ELEVATION.md](docs/PRODUCTION_ELEVATION.md).

---

## What's in the box

**Today (working):**

- **Stock control with lot tracking** — batches with expiry (FEFO), reorder points, valuation, split/transfer/count between stores
- **Procurement** — purchase orders, suppliers, internal input requests
- **Loss accounting** — waste records with reason and estimated value
- **Seasons** — planning periods with inventory plans
- **Forecasting Engine** — six-month weighted moving-average consumption forecasts, reorder thresholds, anomaly flags (explicit math, no "AI": [docs](docs/) → Forecasting page)
- **Alerts** — expiry, low stock, critical stock, ranked and farm-scoped
- **QR capture** — scan a bag, look up a lot, see its movements
- **Exports** — CSV / Excel / PDF, all tenant-scoped
- **5 roles** — Admin, Farm Manager, Warehouse Manager, Accountant, Field Worker
- **Audit trail** — every mutation with actor, IP, before/after values
- **i18n** — English, Twi, Ga, Ewe

**Not in the box (on purpose):** no AI chat, no "smart insights" branding, no marketplace, no payroll, no chart builder. The redesign in [docs/PRODUCT_REDESIGN.md](docs/PRODUCT_REDESIGN.md) cuts 18 nav items to 5 and rebuilds the model around crop cycles.

---

## Quick start

```bash
git clone <repo> && cd farmops
npm install --legacy-peer-deps     # see note below
cp .env.example .env               # set DATABASE_URL + NEXTAUTH_SECRET
npx prisma db push
npm run db:seed
npm run dev
```

Open http://localhost:3000.

**Why `--legacy-peer-deps`:** `next-auth@5.0.0-beta` declares a peer on
`nodemailer ^7||^8` while we run `^10` (security patches require it). npm's
strict resolver refuses the combination. This affects CI too — see
[docs/contributing.md](docs/contributing.md).

### Docker

```bash
docker compose up -d   # PostgreSQL + app + MailHog (email UI: :8025)
```

### Seeded logins

| Role | Email | Password |
|---|---|---|
| Admin | `admin@farmops.com` | `password123` |
| Farm Manager | `manager@farmops.com` | `password123` |
| Warehouse Manager | `warehouse@farmops.com` | `password123` |
| Field Worker | `worker@farmops.com` | `password123` |

> ⚠️ Seed credentials are development-only. Production registration assigns
> `FIELD_WORKER` server-side and never accepts a role from the client.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | one codebase for SSR + API |
| Language | TypeScript 5.7, `strict` | 92.5% type coverage |
| Database | PostgreSQL 16 | one DB, `farmId` discriminators ([ADR-002](docs/adr/ADR-002-multi-tenant-design.md)) |
| ORM | Prisma 6 | typed schema→code, zero raw SQL ([ADR-003](docs/adr/ADR-003-prisma-selection.md)) |
| Auth | NextAuth v5, JWT sessions | one module owns claims ([ADR-001](docs/adr/ADR-001-auth-strategy.md)) |
| UI | Radix + Tailwind + shadcn/ui | accessible primitives without a design-system project |
| Validation | Zod | same schemas at every boundary |
| Charts | Recharts | |
| Tests | Vitest + Playwright | |
| Storage | Local disk behind a `FileStore` seam → object storage later ([ADR-004](docs/adr/ADR-004-storage-strategy.md)) | |

---

## Architecture

A **modular monolith**: one Next.js app, one Postgres, 49 route handlers. Boundaries are code-level (bounded contexts), not network hops.

```
Browser → middleware (cookie presence, UX only)
       → route handler: guard → Zod → resolveFarmScope → Prisma → audit log
```

```
CROP PRODUCTION (core)     CropCycle · Plot · SeedLot · FieldOperation · HarvestBatch…
INPUTS & STORES (support)  Store · InputLot · StockMove · PurchaseOrder · StockCount
EQUIPMENT (support)        Machine · EquipmentUsage
IDENTITY (generic)         Farm(tenant) · User · Role
ACCOUNTING (generic)       export to spreadsheets — don't build a ledger
```

Full shape, seams, and debts: **[docs/architecture.md](docs/architecture.md)**

---

## Documentation

| | |
|---|---|
| [architecture.md](docs/architecture.md) | system shape, layers, seams, known debts |
| [data-model.md](docs/data-model.md) | tables, meaning, migration plan to crop cycles |
| [security.md](docs/security.md) | security entry point — posture, rules, open items |
| ├ [threat-model.md](docs/security/threat-model.md) | STRIDE: assets, threats, trust assumptions |
| ├ [tenant-isolation.md](docs/security/tenant-isolation.md) | how Farm A never sees Farm B |
| └ [api-security.md](docs/security/api-security.md) | guard stack, limits, CSRF, uploads, keys |
| [SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) | 25 findings, severities, remediation, code |
| [PRODUCT_REDESIGN.md](docs/PRODUCT_REDESIGN.md) | identity, DDD, UX redesign, scores, roadmap |
| [testing.md](docs/testing.md) | commands, coverage reality, what to test next |
| [deployment.md](docs/deployment.md) | env, migrations, checklist, scaling triggers |
| [contributing.md](docs/contributing.md) | setup, PR rules, security checklist |
| [adr/](docs/adr/) | ADR-001 auth · ADR-002 tenancy · ADR-003 ORM · ADR-004 storage |

---

## Trade-offs (the compromises we made on purpose)

Documented decisions, not accidents — the full list lives in the ADRs.

- **Modular monolith over microservices** — team < 5, lower operational
  complexity, faster development, easier debugging. Extraction triggers are
  written down ([ADR-004](docs/adr/ADR-004-storage-strategy.md)).
- **Shared-schema tenancy over database-per-tenant** — one database to
  migrate, pool, and back up; tenant isolation enforced by one server-side
  function instead of infrastructure. The invariant is convention + CI sweep,
  not the type system — the trade-off is explicitly accepted
  ([ADR-002](docs/adr/ADR-002-multi-tenant-design.md)).
- **JWT sessions over DB sessions** — no session store, one request = one
  cookie check; cost is claim staleness on role changes, mitigated by
  re-reading the DB on sensitive routes
  ([ADR-001](docs/adr/ADR-001-auth-strategy.md)).
- **Prisma over Drizzle/raw SQL** — fastest path to end-to-end types and
  zero SQL-injection surface; cost is a black-box query planner and
  Decimal⇄Number friction at every calculation site
  ([ADR-003](docs/adr/ADR-003-prisma-selection.md)).
- **Local-disk uploads behind an interface** — zero infrastructure today,
  one-class migration to S3/R2 when a written trigger fires
  ([ADR-004](docs/adr/ADR-004-storage-strategy.md)).
- **In-memory rate limits & API keys** — correct for one instance, wrong
  for two. Scaling out requires moving them first; the trigger is documented
  in [deployment.md](docs/deployment.md) §8.
- **NextAuth v5 beta** — pre-stable, pinned in the lockfile, upgrades gated
  by the test suite.
- **2 accepted moderate dependency advisories** — unreachable code paths
  pending upstream fixes, detailed in [security.md](docs/security.md).

---

## Roadmap

Prioritized plan from 4/10 → 8.5/10 across product, security, architecture,
and UX: **[docs/PRODUCT_REDESIGN.md](docs/PRODUCT_REDESIGN.md)** Part VIII.

| Phase | Focus |
|---|---|
| P0 | DTO layer, server-composed views, nav 18 → 5, season home |
| P1 | CropCycle + Plot aggregates, SeedLot split, FieldOperation flow |
| P2 | Lifecycle rail, seasonal timeline, movement flows, offline capture |
| P3 | Disease/weather events, fertilizer plan vs actual, equipment, margin review |
| P4 | Security backlog, tenant-scoped catalog, field validation |

---

## License

[MIT](LICENSE) © Samuel Ibe
