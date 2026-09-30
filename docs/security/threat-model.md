# FarmOps — Threat Model

**Method:** STRIDE, scoped to the web application and its data store
**Date:** 2026-09-30
**Companions:** [tenant-isolation.md](./tenant-isolation.md) · [api-security.md](./api-security.md) · [../SECURITY_AUDIT.md](../SECURITY_AUDIT.md)

---

## 1. System overview

```
                        ┌────────────────────────── Internet ──────────────────────────┐
                        │                                                             │
   Farm staff ──Browser─┤  Next.js App (SSR + client)                                │
   (5 roles)            │   ├── Server Components / Pages  ──┐                        │
   Admins ──────────────┤   ├── Middleware (cookie presence) │                        │
   3rd-party systems ───┤   └── Route Handlers (/api/*)  ────┤                        │
                        └────────────────────────────────────┼────────────────────────┘
                                                             │ (same Node process)
                        ┌────────────────────────────────────▼────────────────────────┐
                        │  Prisma client (parameterized SQL)                          │
                        │  ├── PostgreSQL (single DB, farmId discriminators)          │
                        │  └── Local filesystem: public/uploads, exports generated     │
                        │  Outbound: SMTP (nodemailer), webhook URLs (admin-defined)   │
                        └─────────────────────────────────────────────────────────────┘
```

**Trust boundaries:** (A) browser ↔ app — Internet; (B) app ↔ database —
process-local; (C) app ↔ SMTP / webhook targets — outbound Internet.
Everything inside boundary B is trusted; everything crossing A is hostile
until the session cookie is verified.

## 2. Assets

| Asset | Sensitivity | Attacker's prize |
|---|---|---|
| Credentials & session tokens | Critical | Account takeover |
| Stock, prices, valuations per farm | High | Commercial espionage between competing farms |
| Roles / farm assignments | High | Privilege escalation, cross-tenant access |
| Audit log | High (integrity) | Cover tracks after compromise |
| Password-reset tokens | Critical (short-lived) | Takeover without the password |
| API keys | Critical | Machine-level data access, no MFA/UX friction |
| Uploaded images | Medium | Malware hosting, content spoofing |
| Availability of the app during planting/harvest windows | High | Business disruption |

## 3. Threats (STRIDE) and mitigations

### Spoofing

| # | Threat | Mitigation | Status |
|---|---|---|---|
| S1 | Forged/stolen session cookie | Auth.js JWT signature verification on every data path; middleware presence-check is UX only (SEC-16) | ✅ |
| S2 | Password-reset token theft from DB | Only SHA-256 digests stored; 1-hour TTL; single-use; prior tokens invalidated on issue (SEC-03) | ✅ |
| S3 | Hardcoded-credential backdoor | `/api/test-login` deleted (SEC-01) | ✅ |
| S4 | Credential stuffing on login | Register/reset rate-limited; **login throttling still open (SEC-19)** | ⚠️ P1 |
| S5 | API-key replay after leak | Keys bound to farm; revocation endpoint; **keys currently in-memory, unhashed (SEC-18)** | ⚠️ P1 |

### Tampering

| # | Threat | Mitigation | Status |
|---|---|---|---|
| T1 | Self-promotion to ADMIN at registration | Role stripped in Zod, server-assigned `FIELD_WORKER` (SEC-02) | ✅ |
| T2 | Role change via API by non-admin | `PATCH/PUT /api/users/[id]` requires ADMIN; non-admins can't set roles; self-demotion blocked | ✅ |
| T3 | Audit-log forgery by app-level attacker | Writes go through `writeAuditLog` only; log is admin-read-only | ✅ |
| T4 | Audit-log tampering by DB admin | Rows are plain — **no hash chain** (SEC-25) | ⚠️ P3 |
| T5 | Malicious CSV re-import overwriting stock | Import validates rows, skips bad ones, audit-logged; min role WAREHOUSE_MANAGER | ✅ |
| T6 | Path traversal in upload filename | Filename derived from MIME + UUID; client name never touches the path (SEC-10) | ✅ |

### Repudiation

| # | Threat | Mitigation | Status |
|---|---|---|---|
| R1 | "Nobody approved this PO" | `writeAuditLog` on auth, uploads, and mutations with actor + IP + old/new values | ✅ partial |
| R2 | Read-path actions unlogged | Reads largely unlogged — accepted: they're voluminous and low-value for forensics | ⚠️ by design |
| R3 | No alerting on suspicious patterns | No SIEM/monitors yet; depends on logs surviving | ⚠️ P3 |

### Information disclosure

| # | Threat | Mitigation | Status |
|---|---|---|---|
| I1 | **Cross-tenant read via `?farmId=`** | `resolveFarmScope` from session only; 30+ routes (SEC-06) | ✅ |
| I2 | IDOR on per-ID routes | Scoped `findFirst`, 404-not-403, both ends of transfers checked (SEC-07) | ✅ |
| I3 | Key-metadata enumeration | `GET /api/api-keys` admin-only, previews masked (SEC-09) | ✅ |
| I4 | Export endpoints leaking all tenants | CSV/Excel/PDF fully scoped (SEC-13) | ✅ |
| I5 | Notification feed cross-user | Per-user `userId` filter; alert fan-out farm-scoped (SEC-08) | ✅ |
| I6 | Reset-token email enumeration | Constant response regardless of account existence (SEC-03) | ✅ |
| I7 | Stack traces to clients | Generic messages client-side, details logged server-side | ✅ |
| I8 | Backup/DB-reader stealing reset tokens | Digests only (S2) — a DB reader cannot redeem | ✅ |

### Denial of service

| # | Threat | Mitigation | Status |
|---|---|---|---|
| D1 | Unbounded auth attempts | Per-IP fixed windows on register/forgot/reset; 30/min on mutation routes (SEC-12) | ✅ partial |
| D2 | Login flood | No throttle on the credentials endpoint (SEC-19) | ⚠️ P1 |
| D3 | Alert fan-out N+1 stall | Rate-limited but not chunked — `createMany` planned (SEC-8 backlog) | ⚠️ P2 |
| D4 | 5 MB uploads × many | Per-request cap; no per-user quota yet | ⚠️ P2 |
| D5 | CSV import of huge file | Rows processed in loop; no size cap beyond body limits | ⚠️ P2 |

### Elevation of privilege

| # | Threat | Mitigation | Status |
|---|---|---|---|
| E1 | Anonymous → authenticated | Guards on 45/49 routes; 4 intentionally public auth endpoints | ✅ |
| E2 | FIELD_WORKER → ADMIN | T1 + T2 + admin-only user UI (server-enforced) | ✅ |
| E3 | Farm A → Farm B | I1 + I2; `NO_FARM_MATCH` fails closed for unassigned users | ✅ |
| E4 | Unpinned API key → all farms | Farm binding on key creation; pin wins over any requested `farmId` (SEC-14) | ✅ |
| E5 | SSRF → cloud metadata / internal network | Webhook URL private-range blocklist, admin-only (SEC-11) | ✅ (DNS-rebinding gap noted) |
| E6 | `NODE_ENV` misconfigured in prod → seed endpoint | Seed route guarded by NODE_ENV; **delete before launch** (SEC-17) | ⚠️ P1 |

## 4. Trust assumptions

1. **TLS terminates in front of us** (reverse proxy) — cookies and bodies
   are encrypted in transit; `NEXTAUTH_URL` is `https://`.
2. **Postgres is trusted** — inside boundary B; DB admins are outside our
   threat model (except T4, noted).
3. **SMTP provider is trusted** for reset-link confidentiality in transit.
4. **Admins are trusted but not omnipotent** — they may read across farms
   by design; they may not bypass audit logging for mutations.
5. **The build pipeline and lockfile are trusted** — hence pinned deps and
   the audit step in CI.

## 5. Out of scope (explicitly)

- Physical security of the deployment host.
- Client-device malware / session theft from a compromised browser.
- Social engineering of farm staff.
- Content moderation of user-uploaded images beyond MIME validation.
- Availability of upstream SMTP/webhook targets.

## 6. Review cadence

- **Every PR touching auth, scope, or uploads** → re-read this file's tables.
- **Quarterly** → run `npm audit`, re-run the route guard sweep, confirm the
  open ⚠️ items haven't aged silently.
- **On trigger events** → new ADR if the architecture changes (new storage
  backend, second app instance, added tenant-scoped model).
