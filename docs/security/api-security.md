# FarmOps — API Security

**Scope:** every HTTP endpoint under `/api/*` (49 route handlers), the guard
primitives they share, and the client-side rules that keep them honest.
Companions: [threat-model.md](./threat-model.md) ·
[tenant-isolation.md](./tenant-isolation.md) ·
[../SECURITY_AUDIT.md](../SECURITY_AUDIT.md)

---

## 1. The guard stack

All authorization logic funnels through one module: `src/lib/api-auth.ts`.
Route handlers must use these helpers rather than rolling their own:

| Helper | What it does | Use for |
|---|---|---|
| `requireAuth()` | 401 unless a valid session exists; returns `AuthUser` | Read endpoints |
| `requireRole([...])` | 401/403 by exact role | Admin-only surfaces |
| `requireMinRole(role)` | 401/403 by role hierarchy | Role-tiered writes |
| `mutationGuard(req, {minRole, rateLimit})` | CSRF origin check → per-IP rate limit → role check, in that order | **Every** write endpoint |
| `resolveFarmScope(user, requested?)` | Server-derived tenant scope (ADR-002) | Every data query |
| `validateApiKey(token)` | External machine auth (bearer) | `/api/external/*` only |
| `writeAuditLog({...})` | Append-only trail: actor, action, entity, old/new values, IP | Every mutation |

Canonical write handler:

```ts
export async function POST(request: Request) {
  const user = await mutationGuard(request, { minRole: "WAREHOUSE_MANAGER" });
  if (user instanceof NextResponse) return user;   // 401/403/429/CSRF already handled
  const scope = resolveFarmScope(user);
  // … validate body with Zod → scoped query → write → writeAuditLog → 201
}
```

**Why return-`NextResponse`-or-user rather than throwing:** the guard's
failure responses are the contract (correct status codes + headers); a throw
would flatten them into a generic 500.

## 2. Route inventory & auth posture

| Class | Count | Mechanism |
|---|---|---|
| Session-guarded handlers | 45/49 | `mutationGuard` / `requireAuth` / `requireRole` |
| Intentionally public auth endpoints | 4 | `auth/register`, `auth/forgot-password`, `auth/reset-password`, `auth/[...nextauth]` — each rate-limited + Zod-validated |
| API-key endpoints | 2 (within the 45 count they're separate) | `Authorization: Bearer fops_…`, optional farm pin |
| Dev-only | 1 (`api/seed`) | `NODE_ENV !== "development"` → 403. **Delete before production** (SEC-17) |

CI guard-rail (fail the build on a new unguarded route):

```bash
for f in $(find src/app/api -name route.ts); do
  grep -qE "requireAuth|requireRole|requireMinRole|mutationGuard|validateApiKey" "$f" \
    || { echo "UNGUARDED: $f"; exit 1; }
done
```

## 3. Rate limiting

Fixed-window per-IP counters in process memory (`checkRateLimit`):

| Surface | Limit |
|---|---|
| `mutationGuard` (all writes) | 30/min per IP |
| `auth/register` | 5 / 15 min |
| `auth/forgot-password` | 3 / 15 min |
| `auth/reset-password` | 5 / 15 min |
| `upload` | via `requireAuth` + mutation path |

**Known limits (accepted, tracked as SEC-18/SEC-19):**

- Store is a per-process `Map` — correct for one instance, **wrong the moment
  we scale out**, and reset on restart. Migration target: Redis/Upstash.
- The **credentials (login) endpoint is not throttled yet** — highest-priority
  gap in the security backlog.
- No per-user limits, only per-IP: one NAT'd office shares a budget.

## 4. CSRF

Safe methods (GET/HEAD/OPTIONS) are exempt; every other request must carry an
`Origin` whose host equals the `Host` header (`checkCsrf`, enforced inside
`mutationGuard`). Missing origin → 403.

This is a **same-origin origin-check**, not a token. It is sound for our
shape (cookie-authenticated, no cross-origin consumers of the session API)
because:

- Browsers always send `Origin` on cross-site POSTs.
- External consumers use API keys, not cookies — and those requests are
  authenticated differently, with `Authorization` headers that browsers
  don't attach cross-site.

Known trade-off: non-browser clients that strip `Origin` can't mutate. That's
acceptable — mutations are a browser workflow; the external API is read-mostly.

## 5. Input validation & injection

- **Zod on every request body** (`src/lib/api-validations.ts`,
  `src/lib/validations.ts`), including the auth endpoints.
- **SQL:** zero raw SQL. All queries go through Prisma's parameterized client
  (`$queryRaw`/`$executeRaw` count in repo: **0**). `contains`/`mode:
  "insensitive"` filters are escaped by the client library.
- **XSS:** no `dangerouslySetInnerHTML` anywhere; the single `innerHTML` use
  (`qr/page.tsx`) assigns `""` to clear a container. All interpolation is
  React-escaped JSX. CSP is P2 defense-in-depth (SEC-21).
- **CSV import** parses with PapaParse (no `eval`), skips malformed rows,
  audit-logged; min role `WAREHOUSE_MANAGER`.

## 6. File uploads

`POST /api/upload` (SEC-10):

1. `requireAuth` first — no anonymous writes.
2. MIME allowlist: jpeg/jpg/png/webp/gif. 5 MB cap.
3. Extension derived **from the validated MIME type**, never from `File.name`.
4. Path: `public/uploads/<entity>-<entityId>-<uuid8>.<ext>` with entity and
   id sanitized to `[a-zA-Z0-9_-]{0,32}` — traversal has no surface.
5. Audit-logged with original name + size.

Residual (P3): no magic-byte sniffing — a crafted file declaring `image/png`
but containing other bytes is stored. Serving policy hardening (separate
origin / attachment disposition) is listed in the backlog.

## 7. Webhooks (SSRF)

`POST /api/webhooks` (admin-only):

- `http`/`https` schemes only.
- Private/loopback/link-local hosts rejected: `localhost`, `0.0.0.0`, `::1`,
  `.local`, `127.*`, `10.*`, `192.168.*`, `172.16–31.*`, `169.254.*`,
  IPv6 `fc/fd/fe80`.
- URL syntax-validated before registration.

Accepted gap: no DNS-resolve-and-pin, so a hostname could rebind after the
check; no redirect refusal. Acceptable while webhooks are admin-only and rare.

## 8. External API keys

- Format `fops_<64 hex>`; creation returns the full key **once**, listings
  show `fops_ab12…wxyz` previews only.
- **Admin-only** create and list (SEC-09).
- Optional **farm pin**: `farmId` at creation; on every request a pinned key's
  farm wins over any `?farmId=` the caller passes (SEC-14).
- Revocation flips `isActive` and evicts the lookup entry.

Open items (SEC-18): keys live in an in-memory `Map` (gone on restart) and
aren't hashed at rest. Target: `ApiKey` Prisma model storing only
`sha256(key)`, lookup by digest, plus `lastUsedAt`/revocation columns.
Also: the `permissions[]` array is stored but **not yet enforced** on routes.

## 9. Session security

- JWT strategy (ADR-001); Auth.js sets cookie flags (`HttpOnly`, `SameSite`,
  `Secure` under https).
- JWT callback whitelists `id`, `role`, `farmId` — nothing client-controlled
  enters the token.
- Passwords: bcrypt cost 12. Reset tokens: SHA-256-digest-only storage,
  1-hour TTL, single-use, enumeration-safe responses.
- Middleware's cookie-presence check is a redirect heuristic, **not** a
  security boundary (SEC-16); every data path re-verifies via `auth()`.

## 10. Error handling & logging

- Handlers catch broadly and return generic messages
  (`"Failed to fetch X"`); details go to server logs only.
- No stack traces, SQL, or env values in responses (the dev seed route's
  `error.message` echo is one reason it must go before launch).
- `writeAuditLog` appends actor + IP + old/new values for mutations;
  coverage is broad but not exhaustive (SEC-25).

## 11. Dependency posture

- `npm audit --omit=dev`: **0 critical, 0 high**, 2 moderate
  (`uuid` via `exceljs` — the vulnerable buffer path is unreachable from our
  usage; fix needs an upstream major).
- Dev-tree holds advisories in `vitest`/`@prisma/config` tooling — not shipped.
- **Gotcha:** `npm audit fix` fails on a `next-auth`⇄`nodemailer` peer
  conflict; patch with targeted `npm update <pkg> --legacy-peer-deps`
  (documented in [../testing.md](../testing.md)).
- CI runs `npm audit --audit-level=critical` as a gate.

## 12. Quick checklist for new endpoints

- [ ] `mutationGuard` on writes, `requireAuth`/`requireRole` on reads
- [ ] `resolveFarmScope` applied to **every** query that touches tenant data
- [ ] Object access via scoped `findFirst` → 404 (not 403)
- [ ] Both ends of cross-entity writes validated
- [ ] Zod schema on the body; unknown keys stripped
- [ ] `writeAuditLog` after successful mutations
- [ ] Response contains only the fields the client needs (no `select: true`)
- [ ] Added to the route audit table in `../SECURITY_AUDIT.md` §5
