# FarmOps — Architecture

*How the system is shaped, and why it's shaped that way.*

---

## 1. The one-paragraph version

FarmOps is a **modular monolith**: a single Next.js 16 application (App
Router, server + client components) with 49 route handlers talking to one
PostgreSQL database through Prisma. No microservices, no message queue, no
separate backend. Domain logic is organized by *bounded context* (below),
tenancy is enforced by one function, and the auth stack is one library deep.

## 2. Why a modular monolith (and not services)

We chose this deliberately:

- **Team size < 5.** Distributed systems tax you in ops, debugging, and
  deployment before they pay you in anything.
- **Lower operational complexity.** One process, one deploy, one log stream,
  one database connection pool.
- **Faster development velocity.** A feature touching crop cycles *and* stock
  is one PR, not a contract negotiation between services.
- **Easier debugging.** One stack trace follows the request end-to-end.

The modularity comes from **boundaries in code** (below), not network hops.
If a context ever needs independent scaling (we suspect: export generation,
image processing), it extracts *then* — see the trigger in
[adr/ADR-004](./adr/ADR-004-storage-strategy.md).

## 3. Request flow

```
Browser ─► middleware.ts            (cookie presence → redirect for UX only)
        ─► RSC / page component     (server components where possible)
        ─► fetch /api/* ─► route handler
                            1. mutationGuard / requireAuth   (authz + CSRF + rate limit)
                            2. Zod validation                 (body shape)
                            3. resolveFarmScope               (tenant scope)
                            4. Prisma query (scoped where)    (data)
                            5. writeAuditLog                  (accountability)
                            6. JSON/CSV/PDF response
```

Rules of thumb:

- The **route handler is an adapter**: parse, authorize, call, serialize.
  Business rules don't live in `route.ts`.
- **Scope is derived, never trusted** (see
  [adr/ADR-002](./adr/ADR-002-multi-tenant-design.md)).
- Client components fetch what they need; the P0 roadmap moves composed
  aggregation server-side (one endpoint per screen instead of six).

## 4. Bounded contexts

```
┌──────────────────────────────────────────────────────────────┐
│ CROP PRODUCTION  (core domain — the differentiator)          │
│ CropCycle · Plot · SeedLot · FertilizerPlan · FieldOperation │
│ DiseaseEvent · WeatherImpactEvent · HarvestBatch             │
├──────────────────────────────────────────────────────────────┤
│ INPUTS & STORES  (supporting)                                │
│ Store · InputItem · InputLot · StockMove · PurchaseOrder     │
│ Supplier · StockCount · LossRecord                           │
├──────────────────────────────────────────────────────────────┤
│ EQUIPMENT  (supporting)      Machine · EquipmentUsage        │
├──────────────────────────────────────────────────────────────┤
│ IDENTITY & TENANCY  (generic)  Farm(tenant) · User · Role    │
├──────────────────────────────────────────────────────────────┤
│ ACCOUNTING  (generic — integrate, don't build)               │
│ CostEvent · SaleEvent → export, never a ledger               │
└──────────────────────────────────────────────────────────────┘
```

Today's schema (19 models) sits mostly in *Inputs & Stores*; the migration
plan toward Crop Production is in
[PRODUCT_REDESIGN.md](./PRODUCT_REDESIGN.md) Part IV. The contexts share a
database — **shared DB, not shared model**: each context's types are imported
only within it.

## 5. Layer map (where code goes)

| Layer | Location | Contains |
|---|---|---|
| UI screens | `src/app/(dashboard)/*/page.tsx` | composition + data fetching |
| Shared UI | `src/components/{ui,shared,forms,layout}` | primitives, page shells, forms |
| HTTP surface | `src/app/api/**/route.ts` | parse → authorize → call → serialize |
| Auth/scope kernel | `src/lib/api-auth.ts` | guards, `resolveFarmScope`, rate limit, CSRF, audit |
| Domain services | `src/lib/*.ts` | email, webhooks, notifications, exports, storage |
| Schema | `prisma/schema.prisma` | single source of truth for entities |
| i18n | `src/lib/i18n` | 4 locales (en, tw, ga, ewe) |
| Docs | `docs/` | ADRs, security, testing, deployment, this file |

**Dependency direction:** routes → lib → prisma. Nothing imports from
`app/` into `lib/` — a rule, not yet a lint rule.

## 6. Key seams (the interfaces we commit to)

| Seam | Module | Backed by |
|---|---|---|
| Auth/tenancy | `api-auth.ts` | Auth.js JWT |
| File storage | `FileStore` (planned `lib/storage.ts`) | local disk → object storage (ADR-004) |
| Email | `lib/email.ts` (`sendEmail`) | nodemailer/SMTP |
| Events out | `lib/webhooks.ts` | HTTP POST to admin-defined URLs |
| i18n | `useI18n().t()` | static JSON locales |

## 7. Cross-cutting concerns

- **Tenancy:** one function, fail-closed — [security/tenant-isolation.md](./security/tenant-isolation.md)
- **Authz:** role hierarchy ADMIN(100) → FARM_MANAGER(80) → WAREHOUSE_MANAGER(60) → ACCOUNTANT(40) → FIELD_WORKER(20)
- **Validation:** Zod at every body boundary
- **Audit:** append-on-mutation with IP + old/new values
- **Errors:** generic client messages, detailed server logs
- **Testing:** Vitest unit (lib layer) + Playwright e2e — [testing.md](./testing.md)
- **Types:** `strict: true`; 91.3% type coverage, DTO layer is P0 to close the gap

## 8. Known architectural debts (honest list)

1. **`any`-heavy client pages** — 170 `any` sites; mitigated by the DTO layer (roadmap P0).
2. **Scope-by-convention** — the type system can't enforce tenant scoping; guarded by review + CI sweep (ADR-002).
3. **Global catalog tables** — `Category`/`Supplier`/`InventoryItem` not tenant-scoped yet.
4. **In-memory rate limits and API keys** — single-instance only (SEC-18).
5. **Client-side aggregation** — dashboards fetch 6 endpoints and reduce in the browser; moving server-side (roadmap P0).
6. **NextAuth v5 beta** — pinned, upgrades gated by tests (ADR-001).
7. **Entity CRUD IA** — 18-item nav is a symptom; redesign in
   [PRODUCT_REDESIGN.md](./PRODUCT_REDESIGN.md).

## 9. Architecture decision records

| ADR | Decision |
|---|---|
| [ADR-001](./adr/ADR-001-auth-strategy.md) | NextAuth v5 + JWT sessions |
| [ADR-002](./adr/ADR-002-multi-tenant-design.md) | Shared schema, `farmId`, session-derived scope |
| [ADR-003](./adr/ADR-003-prisma-selection.md) | Prisma over Drizzle/hand-SQL |
| [ADR-004](./adr/ADR-004-storage-strategy.md) | Local disk behind `FileStore`, object storage later |

New architectural choice → new ADR. If it isn't written down, it isn't a
decision — it's a coincidence.
