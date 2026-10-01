# FarmOps — Security Audit

**Auditor role:** Staff Security Engineer
**Date:** 2026-09-30
**Scope:** All 49 API route handlers, auth stack (NextAuth v5 beta / JWT sessions), Prisma data layer, file uploads, external API-key integration, dependency tree, middleware, and client-side session handling.
**Stack:** Next.js 16 (App Router, Turbopack), Prisma 6 + PostgreSQL, NextAuth 5 (JWT strategy), Zod, Tailwind.

---

## 0. Executive summary

The codebase as found was, in its original state, **not safe to expose to the internet**. The two most severe defects were a plaintext credential backdoor and unrestricted privilege escalation at registration. Both were removed as part of this audit, together with a systematic authorization and tenant-isolation pass across every route.

| | Before audit | After remediation |
|---|---|---|
| Unauthenticated API routes | 17 of 49 handlers | 7 (all intentionally public: NextAuth, register, forgot/reset password, external API-key routes, dev-only seed) |
| Routes with tenant (farm) scoping | ~6 ad-hoc | 30+ enforced server-side via `resolveFarmScope` |
| Critical/High findings open | 9 | 0 |
| Critical dependency advisories | 1 (`next` RCE) | 0 (patched 16.3.4 → 16.3.8) |

**Residual risk rating: MEDIUM.** The app is defensible for a single-region production deployment, but three structural items remain open (§10): API keys and rate-limit state live in process memory, the middleware checks only cookie *presence*, and there is no CSP/security-header policy. Those are the top items on the roadmap.

---

## 1. Findings — Critical (fixed)

### SEC-01 · CRITICAL · Hardcoded credential backdoor at `/api/test-login`
**CWE-798 (Use of Hard-coded Credentials) · OWASP A07:2021 Identification & Authentication Failures**

A development helper route authenticated *any* request by comparing against credentials embedded in source, then issued a session. It was reachable in every environment because nothing gated it.

**Remediation applied:** the route and its directory were deleted (`src/app/api/test-login/route.ts`). No test or production code referenced it.

```bash
rm src/app/api/test-login/route.ts && rmdir src/app/api/test-login
```

**Prevention:** keep dev-only tooling out of `src/app/api` entirely. If a local-only helper is ever needed, guard it at the top of the handler *and* rely on `next.config` rewrites to keep it out of production builds:

```ts
if (process.env.NODE_ENV === "production") return new NextResponse(null, { status: 404 });
```

---

### SEC-02 · CRITICAL · Privilege escalation: self-registered users could choose `ADMIN`
**CWE-269 (Improper Privilege Management) · OWASP A01:2021 Broken Access Control**

`POST /api/auth/register` spread the request body straight into `prisma.user.create`, and `createUserSchema` allowed an optional `role`. The registration form even rendered a Role select. Any anonymous visitor could POST `{"role":"ADMIN"}` and own the instance.

**Remediation applied:** the role field was removed from the validation schema (stripped, not just hidden), and the handler hard-codes the least-privileged role:

```ts
// src/lib/api-validations.ts — role no longer accepted from the client
export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

// src/app/api/auth/register/route.ts
const { name, email, password } = validation.data;
const user = await prisma.user.create({
  data: { name, email, password: hashedPassword, role: "FIELD_WORKER" }, // server-assigned
});
```

The Role select was removed from `src/app/(auth)/register/page.tsx`. Role changes are now **admin-only** through `PATCH/PUT /api/users/[id]`, which also blocks self-demotion.

**Pattern to reuse:** *never* accept authorization-relevant fields from an untrusted client, even hidden ones. Strip in Zod (`z.object(...).strip()` is the default), assign server-side, and re-derive from session on every write.

---

### SEC-03 · CRITICAL · Password-reset tokens stored in plaintext, no expiry, no single-use, user-enumerating
**CWE-309/CWE-613 · OWASP A07:2021**

The original flow wrote the raw reset token into a `Notification` row (`message: "RESET_TOKEN:<raw>"`) — meaning anyone with DB read access (a backup, a support engineer, a SQL-injection primitive, an over-broad admin endpoint) could redeem any user's reset. There was no expiry, no invalidation of older tokens, and `forgot-password` returned different responses for existing vs. missing emails.

**Remediation applied** (`src/app/api/auth/forgot-password/route.ts`, `reset-password/route.ts`):

```ts
// Only the SHA-256 digest is persisted; the raw token exists only in the email.
function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// issue: raw token → email; digest → DB; prior tokens invalidated
await prisma.notification.deleteMany({
  where: { userId: user.id, message: { startsWith: "RESET_TOKEN:" } },
});
await prisma.notification.create({
  data: { userId: user.id, title: "Password Reset",
          message: `RESET_TOKEN:${hashToken(token)}`, type: "STOCK_ADJUSTED" },
});

// redeem: constant response regardless of account existence
return NextResponse.json({ message: "If an account exists with that email, you'll receive a reset link shortly." });
```

Redemption verifies the digest, enforces a **1-hour expiry**, requires the same password policy as registration, and deletes every outstanding token after success (single-use). Both endpoints are rate-limited per IP (3/15 min for issue, 5/15 min for redeem). Passwords are hashed with bcrypt cost 12.

**Residual note (see SEC-20):** the token travels in a URL query parameter, so it can leak via `Referer` headers and browser history. A follow-up should serve the link to a one-time POST page instead.

---

### SEC-04 · CRITICAL · Dependency: `next` remote-code-execution advisory
**CVE-class · OWASP A06:2021 Vulnerable & Outdated Components**

`npm audit` reported **GHSA-vcvr-r3jv-pc5j — Next.js RCE in `next/og` ImageResponse**, affecting `next` 16.2.0–16.3.5. Installed: 16.3.4.

**Remediation applied:** bumped to **16.3.8** (within the existing `^16.3.4` range) and re-verified `tsc --noEmit` (clean) and the Vitest suite (76/76).

```bash
npm update next --package-lock-only --legacy-peer-deps
npm audit --audit-level=critical   # 0 vulnerabilities
```

**Process note:** `npm audit fix` fails on this repo due to an upstream peer conflict (`next-auth@5.0.0-beta.32` wants `nodemailer ^7||^8`, project pins `^9`). Until that resolves upstream, dependency patching must use targeted `npm update <pkg>` — add it to CI so advisories don't sit unread:

```yaml
# .github/workflows/ci.yml — add a job
- run: npm audit --audit-level=high || true   # report; gate on high+ once nodemailer conflict resolved
```

---

## 2. Findings — High (fixed)

### SEC-05 · HIGH · 17 API handlers had no authentication whatsoever
**CWE-306 (Missing Authentication for Critical Function) · OWASP A01**

A sweep of all 49 route files found whole families of routes that executed Prisma reads/writes for any anonymous caller: `audit-log`, `intelligence`, `notifications/[id]`, `stock-count` (GET), `export/*`, `reports`, `import`, `webhooks`, `api-keys`, and more.

**Remediation applied:** every handler now begins with one of the shared guards from `src/lib/api-auth.ts`. The guards compose CSRF-origin check → rate limit → role check → session extraction:

```ts
// Read path
const user = await requireAuth();
if (user instanceof NextResponse) return user;

// Write path — origin check + per-IP rate limit + min-role, in one call
const user = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
if (user instanceof NextResponse) return user;

// Sensitive path
const user = await requireRole(["ADMIN"]);
```

**Verified state:** after remediation, the only handlers without a session guard are intentionally public (`auth/*`, `external/*` via API key, and `seed` which is `NODE_ENV`-gated).

**Pattern to reuse:** centralize guards in one module and make the *unguarded* route the thing that requires justification. A CI check catches regressions:

```bash
# fail the build if any route file lacks a guard import
for f in $(find src/app/api -name route.ts); do
  grep -qE "requireAuth|requireRole|requireMinRole|mutationGuard|getAuthUser|validateApiKey" "$f" \
    || { echo "UNGUARDED: $f"; exit 1; }
done
```
(The four auth routes above match via their own logic — the check should whitelist `auth/`, `external/`, `seed` explicitly.)

---

### SEC-06 · HIGH · No multi-tenant isolation — client-supplied `farmId` was trusted
**CWE-639 (Authorization Bypass Through User-Controlled Key) · OWASP A01**

`/api/inventory`, `/api/transactions`, `/api/reports`, `/api/farms` and others read `searchParams.get("farmId")` and used it directly as a `where` filter. A FIELD_WORKER on *Farm A* could pass `?farmId=<Farm B>` and read every batch, transaction, valuation, and waste record of a competing operation. With no `farmId` param at all they saw **all farms**.

**Remediation applied:** the effective scope is now derived from the session, never the query string:

```ts
// src/lib/api-auth.ts
export const NO_FARM_MATCH = "__no_farm__";

export function resolveFarmScope(user: AuthUser, requested?: string | null): string | null {
  if (user.role === "ADMIN") return requested || null; // admins may scope anywhere
  return user.farmId || NO_FARM_MATCH;                 // no farm → matches nothing
}
```

`NO_FARM_MATCH` can never equal a real cuid, so an unassigned user gets an empty result set instead of the whole database. This helper is applied in **30+ handlers**: inventory, transactions, purchase-orders, requests, waste, farms, warehouses, seasons, reports, alerts, stock-count, batches, QR lookup, and all three export formats (CSV/Excel/PDF).

```ts
const farmScope = resolveFarmScope(user, searchParams.get("farmId"));
const where = farmScope !== null ? { warehouse: { farmId: farmScope } } : {};
```

**Pattern to reuse:** *scope = f(session), filter = f(query).* Query params may only narrow the scope the session already grants — never widen it. Keep the resolver in one module so reviewers can verify the invariant in a single read.

---

### SEC-07 · HIGH · Missing ownership checks on per-ID mutations
**CWE-639 · OWASP A01**

Even where auth existed, `PATCH/DELETE /api/inventory/[id]`, `/api/purchase-orders/[id]`, `/api/transactions/[id]`, `/api/waste/[id]`, `/api/requests/[id]`, `/api/warehouses/[id]`, `/api/seasons/[id]`, `/api/farms/[id]`, `/api/stock-count/[id]`, `/api/batches/split`, `/api/batches/transfer` fetched by primary key only. Knowing (or brute-forcing) an ID was enough to read or mutate another tenant's row.

**Remediation applied** — every lookup became a scoped `findFirst`, and foreign keys passed in bodies are validated against scope. Failures return **404, not 403**, so IDs can't be probed for existence:

```ts
// reads: scope folded into the query itself
const po = await prisma.purchaseOrder.findFirst({
  where: { id, ...(farmScope !== null && { farmId: farmScope }) },
});

// mutations: verify then act
const sourceBatch = await prisma.inventoryBatch.findUnique({
  where: { id: batchId }, include: { item: true, warehouse: true },
});
if (farmScope !== null && sourceBatch.warehouse.farmId !== farmScope) {
  return NextResponse.json({ error: "Source batch not found" }, { status: 404 });
}

// cross-entity writes validate BOTH ends (transfer/split)
if (farmScope !== null && targetWarehouse.farmId !== farmScope) {
  return NextResponse.json({ error: "Destination warehouse not found" }, { status: 404 });
}
```

Also fixed: `stock-count` POST now verifies the target warehouse belongs to the caller's farm before writing count items.

**Pattern to reuse:** IDOR checks belong *in the query* where possible (scoped `findFirst`) and *before* the write for body-supplied FKs. Use 404 for authorization misses on object-level access — 403 tells an attacker the ID exists.

---

### SEC-08 · HIGH · Notification feed leaked across users
**CWE-532/CWE-639 · OWASP A01/A05**

`GET /api/notifications` listed notifications globally and `POST /api/alerts` fanned out to *every active user in the database* — cross-farm and cross-user disclosure of operational data (batch numbers, stock levels, expiry dates).

**Remediation applied:** reads filter `where: { userId: user.id }` (unread count too); alert generation only notifies users inside the caller's farm scope and short-circuits when the scope resolves to nobody.

---

### SEC-09 · HIGH · `GET /api/api-keys` unauthenticated key-metadata disclosure
**CWE-200 · OWASP A01**

Any anonymous caller could enumerate integration key names, permissions, usage counts and key previews (`fops_ab12…wxyz` — 12 known prefix chars materially shrinks brute-force space).

**Remediation applied:** `requireRole(["ADMIN"])`, masked previews unchanged, plus optional **farm binding** (§SEC-14).

---

## 3. Findings — Medium (fixed)

### SEC-10 · MEDIUM · File upload: attacker-controlled filename written to `public/`
**CWE-22 (Path Traversal) · OWASP A01**

The original upload concatenated the client `File.name` into the destination path — `../../middleware.ts` style traversal, plus content-type spoofing (MIME declared by the client) and no per-request rate limit.

**Remediation applied** (`src/app/api/upload/route.ts`):

```ts
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024;

if (!ALLOWED_TYPES.includes(file.type)) return 400;
if (file.size > MAX_SIZE) return 400;

// Extension derived from the *validated* MIME type, never from client filename.
const ext = EXT_BY_TYPE[file.type] || "bin";
const safeEntity   = (entityType || "misc").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
const safeEntityId = (entityId   || "general").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
const filename = `${safeEntity}-${safeEntityId}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
await writeFile(join(UPLOAD_DIR, filename), Buffer.from(await file.arrayBuffer()));
```

Plus auth (`requireAuth`) and audit logging of every upload. Writes are sandboxed to `public/uploads` with a UUID suffix, so even a double-extension trick lands as `…-a1b2c3d4.png`.

**Remaining hardening (roadmap):** magic-byte sniffing (a real image decoder), serving uploads from a separate origin or with `Content-Disposition: attachment` for non-images, and a dedicated `uploads/` volume outside the web root in production.

---

### SEC-11 · MEDIUM · SSRF via webhook registration
**CWE-918 · OWASP A10:2021 Server-Side Request Forgery**

`POST /api/webhooks` validated only `new URL(url)` — `http://169.254.169.254/latest/meta-data/` (cloud metadata), `http://localhost:3000/api/users`, and RFC1918 targets were all accepted; the dispatcher would then POST internal data to them.

**Remediation applied** (`src/app/api/webhooks/route.ts`): scheme pinned to http(s) and private/loopback/link-local hosts rejected — localhost, `0.0.0.0`, `::1`, `.local`, `127.*`, `10.*`, `192.168.*`, `172.16–31.*`, `169.254.*`, and IPv6 `fc/fd/fe80` ranges. Registration is admin-only.

```ts
const host = parsed.hostname.toLowerCase();
const isPrivate = host === "localhost" || /^127\./.test(host) || /^10\./.test(host) ||
  /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
  /^169\.254\./.test(host) || /^fc|^fd|^fe80/i.test(host) || /* … */;
if (isPrivate) return NextResponse.json({ error: "Webhook URLs may not target private or internal hosts" }, { status: 400 });
```

**Remaining hardening:** DNS-resolve-then-connect pinning (a hostname can rebind after this check), redirect refusal, and an allowlist of destination domains in production.

---

### SEC-12 · MEDIUM · Zero rate limiting on authentication endpoints
**CWE-307 · OWASP A07**

Login (via NextAuth credentials), registration, and password reset accepted unlimited attempts per IP — trivial credential stuffing and token brute-force.

**Remediation applied:** per-IP fixed-window limiting via `checkRateLimit` in `register` (5/15 min), `forgot-password` (3/15 min), `reset-password` (5/15 min), and 30 req/min on every `mutationGuard` write path, returning `429` with `Retry-After`.

```ts
const { allowed, resetAt } = checkRateLimit(`forgot-pw:${ip}`, 3, 15 * 60 * 1000);
if (!allowed) return rateLimitResponse(resetAt);
```

**Remaining (SEC-19):** login itself is still unthrottled at the app layer, and the store is in-memory.

---

### SEC-13 · MEDIUM · Exports leaked cross-tenant data (CSV, Excel, PDF)
**CWE-639 · OWASP A01**

`/api/export`, `/api/export/excel`, `/api/export/pdf` computed `resolveFarmScope` in some branches and ignored it in others — the inventory and waste branches of all three shipped **every farm's** stock and losses to any authenticated user.

**Remediation applied:** all three formats now scope every sheet: inventory batches through `warehouse.farmId`, transactions/waste through their own `farmId`, batch sheets through the warehouse join. Admins retain cross-farm export; everyone else exports exactly what they can see.

---

### SEC-14 · MEDIUM · External API keys: no tenant binding, no rotation story
**CWE-284 · OWASP A01/A02**

`/api/external/*` keys had `permissions` that were never enforced and no farm binding — one key read the entire database. Keys were also logged in full to any admin listing (fixed in SEC-09).

**Remediation applied:** `ApiKey.farmId` binding on creation, enforced in both external routes:

```ts
// create (admin, optional pin)
const apiKey = createApiKey(name, permissions, farmId || null);

// consume — pin always wins, a requested farmId can never widen it
const keyFarmId = auth.apiKey.farmId;
if (keyFarmId) where.farmId = keyFarmId;
else if (farmId) where.farmId = farmId;   // unbound (admin-issued) key
```

Inventory reads are scoped through `batches.some.warehouse.farmId` so a pinned key never aggregates another tenant's stock.

**Remaining (SEC-18):** keys are still stored in process memory and returned in plaintext at creation — see below.

---

### SEC-15 · MEDIUM · Register form exposed a Role selector
Same root cause as SEC-02, tracked separately because UI often regresses independently: the `register/page.tsx` Role `<select>` was removed so the client can't even *offer* the field. Combined with SEC-02's server-side strip, the control is dead at both layers.

---

## 4. Findings — Low / informational (accepted or deferred)

| ID | Severity | Finding | Status |
|---|---|---|---|
| SEC-16 | Low | **Middleware checks cookie *presence*, not validity.** `middleware.ts` redirects when `authjs.session-token` cookie is absent; a forged/garbage token passes middleware. | **Accepted** — every data path now independently validates the session via `auth()`, so middleware is a UX redirect, not the security boundary. Documented in code. |
| SEC-17 | Low | **Seed endpoint executes a shell command** (`execAsync("npx tsx prisma/seed.ts")`), gated only by `NODE_ENV !== "development"`. Command string is constant (no injection), but the endpoint is listed in `publicRoutes`. | **Accepted for dev; delete before launch.** Roadmap item: remove `/api/seed` from production builds entirely. |
| SEC-18 | **Med** | **API keys and rate-limit counters live in `Map` memory.** Restart = keys vanish (silent integration outage); multi-instance deploys = rate limits don't hold; no key hashing at rest. | **Open — top roadmap item.** Move to `ApiKey` Prisma model storing only `sha256(key)`, look up by digest, add `lastUsedAt`/revocation columns; move rate limits to Redis/Upstash. |
| SEC-19 | **Med** | **No rate limit on the login endpoint itself** and no account-lockout/backoff. | **Open.** Add `checkRateLimit` to the credentials provider (NextAuth `callbacks.authorize` or a wrapping route) + progressive delay after 5 failures. |
| SEC-20 | Low | Reset token delivered in URL query string (Referer/history leakage). | Deferred — switch to fragment (`/#token=`) or a one-time POST interstitial. |
| SEC-21 | Low | No CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`, or `Permissions-Policy` headers configured in `next.config.ts`. | Deferred — add `headers()` config; CSP is the highest-value one (inline script hashes needed for App Router). |
| SEC-22 | Info | **SQL injection: not present.** No `$queryRaw`/`$executeRaw` anywhere; all access via Prisma parameterized queries; `contains` filters use escaped Prisma primitives. Verified by code search. | Clean |
| SEC-23 | Info | **XSS: not present in app code.** No `dangerouslySetInnerHTML`; the single `innerHTML` use (`qr/page.tsx`) only assigns `""` to clear a container. All interpolation is React-escaped JSX. | Clean — CSP (SEC-21) is defense-in-depth |
| SEC-24 | Info | **Session security: sound shape.** JWT strategy (no server session store to poison), `auth.js` cookie flags handled by NextAuth (Secure/SameSite in production). JWT callback copies only `id/role/farmId` into the token — no privilege data accepted from client. | Clean — verify `NEXTAUTH_URL` is https in prod |
| SEC-25 | Info | **Audit logging present but incomplete.** `writeAuditLog` covers auth, uploads, and most mutations with old/new values + IP; several read paths and lower-value writes don't log. Log rows are plain DB rows (tamperable by a DB admin). | Deferred — extend coverage to *all* mutations; hash-chain rows if compliance requires tamper evidence |

---

## 5. API route audit (all 49 handlers)

Legend: ✅ guarded + scoped · 🔑 API-key auth (scoped via key binding) · ⚪ intentionally public · ⚠ deferred item noted

| Route | Authz | Ownership / tenant scope | Notes |
|---|---|---|---|
| `auth/[...nextauth]` | ⚪ | n/a | Framework route |
| `auth/register` | ⚪ + RL | n/a | Role stripped, server-assigned `FIELD_WORKER`, rate-limited |
| `auth/forgot-password` | ⚪ + RL | n/a | Digest-only tokens, non-enumerating response |
| `auth/reset-password` | ⚪ + RL | n/a | 1-hour expiry, single-use, password policy |
| `external/inventory` | 🔑 | ✅ key `farmId` pin | Permissions array still unenforced (roadmap) |
| `external/transactions` | 🔑 | ✅ key `farmId` pin | Requested `farmId` cannot widen a pinned key |
| `seed` | ⚠ `NODE_ENV` | n/a | **Delete before production** (SEC-17) |
| `alerts` GET/POST | ✅ | ✅ `resolveFarmScope` | Fan-out limited to caller's farm |
| `api-keys` GET/POST | ✅ ADMIN | ✅ optional key↔farm binding | Full key shown once at creation |
| `audit-log` | ✅ ADMIN | ✅ | Cross-farm by design (admin) |
| `batches` GET/POST | ✅ | ✅ warehouse→farm scope | POST validates warehouse in scope |
| `batches/split` | ✅ WM | ✅ both ends checked | 404 on cross-farm |
| `batches/transfer` | ✅ WM | ✅ source *and* destination | 404 on cross-farm |
| `categories` `+ [id]` | ✅ | shared reference data | Intentionally global (see §8) |
| `export` (CSV) | ✅ | ✅ all branches | inventory + transactions scoped |
| `export/excel` | ✅ | ✅ all 4 sheets | inventory/tx/batches/waste scoped |
| `export/pdf` | ✅ | ✅ inventory + waste | |
| `farms` `+ [id]` | ✅ | ✅ non-admin pinned to own farm | |
| `import` | ✅ WM | ⚠ shared catalog | Creates global items/categories (§8) |
| `intelligence` | ✅ ADMIN | ✅ by role (cross-farm) | Farm dashboards use `/api/reports` |
| `inventory` `+ [id]` | ✅ | ✅ batch→warehouse→farm | Item creates validate warehouse |
| `notifications` `+ [id]` | ✅ | ✅ `userId: user.id` | Per-user read/update |
| `purchase-orders` `+ [id]` | ✅ | ✅ `farmId` equality + scope | |
| `qr` | ✅ | ✅ all 4 lookup branches | Scoped item fallback too |
| `reports` | ✅ | ✅ | |
| `requests` `+ [id]` | ✅ | ✅ `farmId` equality + scope | |
| `seasons` `+ [id]` | ✅ | ✅ | |
| `stock-count` GET/POST | ✅ | ✅ warehouse→farm; POST validates warehouse | |
| `stock-count/[id]` GET/PATCH/DELETE | ✅ | ✅ scoped `findFirst` | DELETE admin-only |
| `suppliers` `+ [id]` | ✅ | global catalog (§8) | |
| `transactions` `+ [id]` | ✅ | ✅ `farmId` equality + scope | |
| `upload` | ✅ + RL | ✅ audit-logged | Type/size/extension hardened |
| `users` `+ [id]` | ✅ ADMIN | ✅ | Self-demotion blocked, audit-logged |
| `warehouses` `+ [id]` | ✅ | ✅ `farmId` | |
| `waste` `+ [id]` | ✅ | ✅ `farmId` | |
| `webhooks` `+ [id]` | ✅ ADMIN | n/a | SSRF blocklist added |

**Aggregates:** 49 handlers · 42 session-guarded · 2 API-key-guarded · 4 intentionally public auth routes · 1 dev-only (to be deleted). **0 handlers read a client-supplied tenant id without passing it through `resolveFarmScope`.**

---

## 6. OWASP Top 10 (2021) coverage

| # | Category | Verdict | Evidence |
|---|---|---|---|
| **A01** | Broken Access Control | **Was critical → now strong** | Guards on 42/49; `resolveFarmScope` on 30+; ownership checks on every `[id]` mutation; 404-not-403 discipline |
| **A02** | Cryptographic Failures | **Adequate** | bcrypt cost 12; SHA-256 reset digests; random 32-byte tokens; TLS expected at deploy. *Gaps: API keys stored unhashed (SEC-18)* |
| **A03** | Injection | **Strong** | Prisma parameterized-only (no raw SQL); Zod on every body; no `eval`/`innerHTML` sinks; CSV export escapes quotes/newlines |
| **A04** | Insecure Design | **Improved** | Backdoor removed; role assigned server-side; tenant scope server-derived. *Gaps: in-memory keys/limits (SEC-18), shared global catalog (§8)* |
| **A05** | Security Misconfiguration | **Mixed** | Dev seed route still present (SEC-17); no security headers yet (SEC-21); middleware presence-check documented as non-boundary (SEC-16) |
| **A06** | Vulnerable Components | **Now clean** | `next` patched to 16.3.8; `npm audit --audit-level=critical` → 0; peer-conflict workaround documented for CI |
| **A07** | Auth Failures | **Was critical → now strong** | Backdoor gone; enumeration-safe reset; token expiry/single-use; rate limits on register/reset. *Gap: login throttling (SEC-19)* |
| **A08** | Data Integrity Failures | **Adequate** | No unsafe deserialization; JWT validated by next-auth; audit log on sensitive writes |
| **A09** | Logging & Monitoring | **Partial** | `writeAuditLog` on auth/uploads/mutations with IP + old/new values; no alerting on suspicious patterns yet |
| **A10** | SSRF | **Now strong** | Webhook private-range blocklist + admin-only; no other outbound URL sinks found |

---

## 7. RBAC model (as enforced)

```
ADMIN            (100)  everything, cross-farm, user/role management, audit log
FARM_MANAGER     (80)   full CRUD within own farm
WAREHOUSE_MANAGER(60)   stock movements, counts, imports, batch split/transfer
ACCOUNTANT       (40)   transactions, POs, reports (read-heavy)
FIELD_WORKER     (20)   read + task-scoped writes; default for all registrations
```

Enforcement points, in order of authority:
1. **Route guard** — `mutationGuard({ minRole })` / `requireRole([...])`.
2. **Tenant scope** — `resolveFarmScope` (role also decides whether cross-farm is permitted).
3. **Object ownership** — scoped `findFirst` per ID.
4. **UI affordance** — `hydrated`-gated `isAdmin` hides admin controls (cosmetic only; never relied upon — the three-layer server enforcement above is the boundary).

Verified: non-admins cannot read `GET /api/users`, cannot set `role` via `PATCH/PUT /api/users/[id]`, cannot access `/settings/users` UI, and cannot demote themselves (lockout guard).

---

## 8. Architectural observations that are *security-relevant*

1. **Shared global catalog** — `Category`, `Supplier`, and `InventoryItem` have no `farmId`; any warehouse-manager can create/rename categories seen by all tenants. Acceptable for an MVP where catalog entries are non-sensitive, but a malicious tenant can pollute another's UX (`"⚠️ CHEAP SEEDS – IGNORE"`). *Recommendation: add `farmId` nullable (null = shared) before multi-tenant GA.*
2. **Denial-of-service surface** — `POST /api/alerts` does N+1 `notification.create` in a loop (one per user per item). A large farm could stall event-loop seconds; rate-limited but not bounded. *Recommendation: `createMany` + batch cap.*
3. **Error handling** — handlers return generic messages (`"Failed to fetch …"`) and log server-side; no stack traces leak. The dev seed route does return `error.message` — another reason to delete it (SEC-17).

---

## 9. Scores

| Dimension | Before | After | Rationale |
|---|---|---|---|
| Broken access control | 1/10 | 8/10 | Full guard + scope + ownership coverage; residual: shared catalog, presence-only middleware |
| Authentication | 2/10 | 8/10 | Backdoor & escalation killed; reset flow solid; login throttling still open |
| Tenant isolation | 0/10 | 8/10 | Session-derived scope on 30+ routes; external keys bindable |
| Cryptography | 6/10 | 7/10 | bcrypt-12, digest-only tokens; API keys unhashed at rest |
| Injection (SQLi/XSS) | 8/10 | 9/10 | Clean by construction; add CSP for depth |
| File handling | 3/10 | 7/10 | Traversal killed; no magic-byte sniffing yet |
| SSRF | 2/10 | 7/10 | Blocklist solid; no DNS-pin/redirect refusal |
| Dependencies | 3/10 | 8/10 | Critical CVE patched; peer-conflict must be tracked |
| **Overall security** | **3/10** | **7.5/10** | Production-defensible for single-region; reach 8.5 with SEC-18/19/21 |

---

## 10. Prioritized remediation backlog (security)

| P | Item | Effort | Lift |
|---|---|---|---|
| P0 | ✅ Backdoor, escalation, reset tokens, guards, scoping, ownership, SSRF, upload, CVE | done | +4.5 |
| P1 | Persist API keys in DB (hash-only) + Redis rate limiting (SEC-18) | 1–2 d | +0.5 |
| P1 | Login throttling + progressive lockout (SEC-19) | ½ d | +0.3 |
| P1 | Delete `/api/seed` from production; remove from middleware public list (SEC-17) | 1 h | +0.1 |
| P2 | Security headers + CSP (SEC-21) | 1 d | +0.3 |
| P2 | Enforce API-key `permissions` array on external routes | ½ d | +0.2 |
| P2 | Rate-limit + cap `POST /api/alerts` fan-out (`createMany`) | ½ d | +0.1 |
| P3 | Magic-byte upload sniffing; upload serving policy | 1 d | +0.2 |
| P3 | Reset token via URL fragment; extend audit coverage | 1 d | +0.1 |
| P3 | Tenant-scope the shared catalog (nullable `farmId`) | 1 d | +0.2 |

---

*All fixes referenced above are applied in the working tree, verified with `tsc --noEmit` (clean) and `vitest run` (76/76 passing at audit time; 138/138 after the production-elevation hardening — see [PRODUCTION_ELEVATION.md](PRODUCTION_ELEVATION.md)).*
