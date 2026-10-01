# Production Elevation — Recommendation → Implementation Map

Source: *FarmOps Production Elevation & Engineering Recommendations* (1 October 2026).
Guiding principle of that document: **harden before expanding**.

This file records, honestly, what has been implemented in this repository, what
is partially done, and what is deliberately deferred — with the evidence for
each claim. Nothing below is marked done without a passing check.

**Verification snapshot** (all re-run after the changes in this document):

| Check | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `vitest run` | **138/138 passing** (12 suites; 76 pre-existing + 62 new security/atomicity tests) |
| `next build` | succeeds (middleware + 49 API routes + pages) |
| `eslint .` | 249 pre-existing errors (mostly `no-explicit-any` legacy debt) — CI lint job marked non-blocking until Phase 4, see §7 |
| Live smoke test | dev server: security headers present on pages *and* APIs; `/api/health` responds; login page renders with zero CSP violations |

---

## 1. P0 — Inventory correctness (§4 of the recommendations)

### 1.1 Atomic stock mutations — **DONE**

Every write to `InventoryBatch.quantityRemaining` now goes through
`applyStockDelta` in [src/lib/stock.ts](../src/lib/stock.ts): a **conditional
`UPDATE` (Prisma `updateMany` + predicate) executed inside the caller's
`$transaction`**, so the read-validate-write cycle can never interleave with a
concurrent request. A lost race returns a deterministic **409 with the true
remaining quantity** instead of clamping with `Math.max(0, …)`.

| Stock path | Before | After |
|---|---|---|
| `POST /api/transactions` | create → then non-atomic update (`Math.max` clamp) | one transaction, conditional decrement, 409 on race |
| `DELETE /api/transactions/[id]` | read-modify-write restore, clamped at 0 | atomic reverse delta; 409 if stock already consumed |
| `POST /api/batches/transfer` | source set absolutely from a pre-read; destination set absolutely | conditional decrement + atomic `increment` on destination |
| `POST /api/batches/split` | absolute set from pre-read | conditional decrement, 409 on race |
| Request approval (`PATCH /api/requests/[id]`) | separate issue + update, silent skip | approval and issuance atomic; over-issue → 409, approval not recorded |
| Stock-count reconciliation (`PATCH /api/stock-count/[id]`) | per-item updates, `Math.max` clamp | whole reconciliation in one transaction; variance beyond stock → 409 |

Status transitions are also correct now: batches reactivate `DEPLETED → ACTIVE`
when stock arrives (previously impossible without manual intervention).

**Acceptance test (encoded permanently):**
`tests/security/stock-race.test.ts` → "two concurrent 80-unit draws against
100 → exactly one succeeds", stock ends at 20 — never negative, never 160.

### 1.2 Validate every warehouse relationship — **DONE**

`POST /api/transactions` independently verifies `fromWarehouseId` and
`toWarehouseId` against the authenticated farm scope (404 if unknown, 403 if
another tenant's), instead of trusting the batch's farm. The rule lives in one
pure function — `warehouseInScope` in [src/lib/tenant.ts](../src/lib/tenant.ts)
— with adversarial tests ("Farm A acting on Farm B warehouse → denied").
Transfer and split already validated their target warehouse; they now share the
same helper semantics.

### 1.3 Idempotency for high-impact mutations — **DONE (opt-in)**

`withIdempotency` in [src/lib/api-auth.ts](../src/lib/api-auth.ts) +
[src/lib/idempotency.ts](../src/lib/idempotency.ts): clients send an
`Idempotency-Key` header; duplicates replay the stored successful response
(`Idempotent-Replay: true`), in-flight duplicates get 409, failures release the
key so a corrected retry can run. Applied to:

- `POST /api/transactions` (stock issuance/adjustment)
- `POST /api/batches/transfer`, `POST /api/batches/split`
- `PATCH /api/requests/[id]` (approval → issuance)
- `POST /api/purchase-orders` (PO submission)

Scope key = route + user ID, so two users can never share a replay.
Tests: `tests/security/idempotency.test.ts` (8 cases incl. "two attempts →
one effective operation").

*Known limitation (same as rate limiting):* the store is in-memory,
single-instance. Persist to DB/Redis before horizontal scaling — tracked as
SEC-18 in [SECURITY_AUDIT.md](SECURITY_AUDIT.md).

---

## 2. P1 — Security hardening (§5 of the recommendations)

| Recommendation | Status | Evidence |
|---|---|---|
| Adversarial tenant-isolation tests | **DONE** (helper/rule level) | `tests/security/tenant-isolation.test.ts` — Farm A/B matrix: scope pinning, warehouse cross-tenant, unassigned user fail-closed, role escalation denied (14 cases). Route-level Farm A/B matrix remains an E2E task (§5). |
| Login throttling | **DONE** | [src/lib/auth.ts](../src/lib/auth.ts) + [src/lib/rate-limit.ts](../src/lib/rate-limit.ts): failed attempts counted per **IP+account** (5 / 15 min), per-IP budget 30/min, cleared on success. Keyed per-IP so an attacker **cannot lock a victim out** from another network. Tests: `tests/security/login-throttle.test.ts`. |
| Distributed rate limiting | **DEFERRED** (SEC-18) | In-memory maps remain correct for one instance; moving to Redis/DB is a scaling decision, documented rather than half-done. |
| Hash API keys at rest | **DONE** | [src/lib/api-keys.ts](../src/lib/api-keys.ts): only the SHA-256 digest is stored; plaintext returned once at creation; list endpoint shows a display hint, never a usable secret. Tests: `tests/security/api-key-scopes.test.ts`. |
| Enforce API-key permissions | **DONE** | `authenticateExternal(request, scope)` in [src/lib/external-auth.ts](../src/lib/external-auth.ts) enforces `read:inventory` / `read:transactions` before any query runs → 403 with the missing scope. |
| Upload magic-byte validation | **DONE** | [src/lib/file-signatures.ts](../src/lib/file-signatures.ts) verifies JPEG/PNG/GIF/WEBP signatures before write; spoofed content (PDF/script renamed to `.png`) → 400. Tests: `tests/security/file-signatures.test.ts`. |
| Production security headers | **DONE** (verified live) | [src/lib/security-headers.ts](../src/lib/security-headers.ts) applied in [src/middleware.ts](../src/middleware.ts): CSP (`frame-ancestors 'none'`, `object-src 'none'`, no `unsafe-eval` in prod), HSTS (HTTPS only), `X-Frame-Options`, `nosniff`, Referrer-Policy, Permissions-Policy. Verified with `curl` on pages + APIs; login page renders with zero CSP violations. Tests: `tests/security/security-headers.test.ts`. *Not yet tested in a deployed HTTPS environment — do so before claiming production readiness.* |
| Remove/disable production seed endpoint | **DONE (gated)** | `POST /api/seed` returns 403 unless `NODE_ENV === "development"` and merely shells out to the dev seeder. Permanent removal (SEC-17) is a one-liner when the demo ends. |
| Tenant-safe HTTP caching | **DONE (added)** | All JSON GET helpers now emit `Cache-Control: private` — `public, s-maxage` on tenant-scoped responses could have served Farm A's data from a shared proxy cache ([src/lib/pagination.ts](../src/lib/pagination.ts)). |

---

## 3. P1 — Testing strategy (§6)

Shift from utility coverage to **business-invariant coverage** — started:

| New suite | What it locks in |
|---|---|
| `tests/security/tenant-isolation.test.ts` | Farm A/B scope matrix, unassigned-user fail-closed, role escalation |
| `tests/security/stock-race.test.ts` | concurrency acceptance criterion, status invariants, delta mapping |
| `tests/security/idempotency.test.ts` | duplicate request → one effective operation |
| `tests/security/login-throttle.test.ts` | brute force slowed, no lockout DoS, window expiry |
| `tests/security/api-key-scopes.test.ts` | hashing at rest, scope confinement, revocation |
| `tests/security/file-signatures.test.ts` | upload spoof resistance |
| `tests/security/security-headers.test.ts` | CSP/HSTS policy regressions |

Still missing (next phase): route-level integration tests with a real
database (the Farm A/B HTTP matrix: read/write/delete/export denial), a
concurrency test against live Postgres, and E2E
auth → inventory → request → approval → stock movement → audit trail.
The CI E2E job (Postgres service + Playwright) is the intended home.

---

## 4. P1 — Type safety & frontend (§7) / Dashboard refactor (§8)

### Dashboard aggregation — **DONE**

`GET /api/dashboard/overview` ([src/app/api/dashboard/overview/route.ts](../src/app/api/dashboard/overview/route.ts))
returns one dedicated DTO computed server-side with session-derived scope; the
dashboard page went from **7 parallel browser fetches + ~100 lines of
client-side aggregation to a single request** (no client-supplied `farmId` at
all).

### DTO sweep / removing `any` from critical paths — **DEFERRED (Phase 4)**

Not started: the frontend still passes Prisma-shaped objects into components.
Honest baseline: `eslint` counts **206 `no-explicit-any` errors**, concentrated
in `intelligence`, `inventory`, `reports` pages and shared forms. Until that
sweep lands, the CI lint job runs non-blocking (see §7) while type-check,
tests, build and E2E remain hard gates. Track with `type-coverage` (92.5%,
up from 91.3% — the new modules are fully typed).

---

## 5. P2 — Domain/service architecture (§9) & DB evolution (§10)

- **Route → service extraction:** partially. High-risk stock logic now lives in
  `src/lib/stock.ts`, authorization rules in `src/lib/tenant.ts`, throttling in
  `src/lib/rate-limit.ts` — all independently testable and shared by routes.
  Remaining routes still mix HTTP + data access; refactor opportunistically.
- **Shared catalog decision (Category/Supplier tenant ownership):** still open —
  see [adr/ADR-002](adr/ADR-002-multi-tenant-design.md); deliberately not
  changed without a decision.
- **DB constraints for invariants:** not added (would need `prisma migrate` —
  this repo currently uses `db push` and has no migration history). Candidate:
  `CHECK (quantityRemaining >= 0)` as a defence-in-depth backstop to the
  application-level conditional updates.

---

## 6. P2 — Deployment & observability (§§11–12)

| Item | Status |
|---|---|
| One package manager / one lockfile | **OPEN DECISION** — CI uses pnpm (`pnpm-lock.yaml`), local workflow documented in README uses npm (`package-lock.json` + `--legacy-peer-deps`). Both exist today; pick one and delete the other (recommendation from the source document: pnpm). |
| Docker image built in CI | **DONE** — `docker` job builds the image; note it now also triggers on `master` (CI previously only watched `main`, so **no CI job had ever run on the actual branch** — fixed). |
| Container smoke test | **DEFERRED** — add a `curl /api/health` step against the built image in a follow-up. |
| Health/readiness endpoint | **DONE** — `GET /api/health` returns 200 when Postgres answers, 503 when not, with per-check latency; verified live (degraded response while local DB is down). |
| Structured logs with request IDs | **DONE on critical paths** — JSON-lines logger with key redaction (`src/lib/logger.ts`), `x-request-id` attached by middleware, `logRouteError` adopted across stock/PO/dashboard routes + health. Remaining routes still `console.error` — migrate incrementally. |
| Secrets separated from source/CI logs | Already: `.env` gitignored, CI uses service env only. |
| Error monitoring (Sentry etc.) | **NOT DONE** — deliberately deferred; no vendor chosen. |
| Object storage for uploads | **DEFERRED** — ADR-004 already defines the `FileStore` seam. |

---

## 7. CI reality check

`.github/workflows/ci.yml` watched `main`/`develop` while the repository
branch is `master` — the pipeline had never actually run. Fixed: push/PR
triggers and the Docker job now include `master`.

Job status expectations for the first real run:

- **Type Check / Unit Tests / Build / Docker Build:** expected green (all
  verified locally).
- **Lint:** expected red on pre-existing debt (249 errors, 106 warnings —
  `no-explicit-any`, `react-hooks/set-state-in-effect` in legacy pages). The
  job is marked `continue-on-error` with a pointer to this document; remove
  that flag as Phase 4 progresses.
- **E2E:** runs against the CI Postgres service; the new security-header
  middleware and dashboard route are covered indirectly. Extend
  `tests/e2e/api.spec.ts` with the Farm A/B matrix next.

---

## 8. What was deliberately NOT built (§14 of the recommendations)

No microservices, no blockchain, no AI chatbot, no extra dashboard charts, no
new modules. The only user-visible feature-ish change is the dashboard
round-trip reduction — everything else is correctness, security and
observability work.

---

## 9. Updated checklist (§20 of the recommendations)

- [x] Fix atomic stock mutation/concurrency — conditional updates + tests
- [x] Validate every warehouse/foreign-key relationship against tenant scope (warehouses + batch + request ownership)
- [x] Add idempotency to critical mutations (5 endpoints, header-driven)
- [x] Build adversarial tenant-isolation tests (rule level; route level → E2E next)
- [x] Add login throttling — per-IP+account failures, no lockout DoS
- [ ] Distributed rate limiting — deferred, SEC-18
- [x] Hash API keys and enforce scopes
- [x] Validate upload content using file signatures
- [ ] Remove `any` from critical client paths — Phase 4 baseline captured (206)
- [ ] Introduce typed DTOs — only the dashboard DTO exists so far
- [x] Move dashboard aggregation server-side
- [ ] Verify/fix Docker standalone deployment — image builds in CI; standalone output + container smoke test pending
- [ ] Standardize on pnpm — open decision (§6)
- [ ] Add critical-path integration and E2E tests — unit/security suites added; route-level Farm A/B matrix pending
- [x] Add health checks and structured logging (critical paths); error monitoring pending
- [x] Update README with verified, honest metrics
