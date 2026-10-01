# FarmOps — Testing

*What we test, how to run it, what we don't test yet — and why.*

---

## 1. Commands

```bash
npm test                 # unit suite (Vitest), single run
npm run test:watch       # watch mode
npm run test:coverage    # unit + V8 coverage report (text/json/html)
npm run test:e2e         # Playwright end-to-end (needs dev server)
npm run test:e2e:ui      # Playwright UI mode
npm run test:all         # vitest && playwright
```

CI runs `tsc --noEmit` → `npm test` → `npm audit --audit-level=critical`.

## 2. Current numbers (measured, not aspirational)

| Metric | Value | How it's measured |
|---|---|---|
| Unit tests | **138 passing** across 12 files | `npm test` |
| Type coverage | **91.3%** (32,519 / 35,628) | `npx type-coverage` |
| TypeScript | `strict: true`, 0 errors | `npx tsc --noEmit` |
| Branch coverage (tested lib modules) | **91.2%** | `npm run test:coverage` |
| Statement coverage across `src/lib` | **16.2%** | coverage include is `src/lib/**` only |

That last row is the honest one: our tests cover the **lib layer's tested
modules** well (`utils` 94%, `api-keys` 100%, `email` 76%) while whole
modules go untested (`api-auth`, `validations`, `audit`, `notifications`,
`auth`). Route handlers and pages have **no unit coverage at all** — they're
exercised manually and by the e2e suite. Closing this gap is roadmap P0/P2:
the guard/scope functions in `api-auth.ts` are the highest-value targets
because they *are* the security boundary.

## 3. What we test today

**`tests/lib/` — pure logic, no DB:**

| File | Covers |
|---|---|
| `utils.test.ts` (35) | formatting, currency/date/number helpers |
| `webhooks.test.ts` (13) | registration, dispatch, event fan-out |
| `email.test.ts` (12) | template rendering for each notification type |
| `api-keys.test.ts` (8) | create/validate/revoke lifecycle |
| `pagination.test.ts` (8) | cursor/limit parsing, response envelope |

**`tests/e2e/` — Playwright against a running dev server:**

- `api.spec.ts` — smoke-calls major endpoints for status/shape.
- Auth flow: register → login → dashboard.

**Deliberately excluded from unit tests:** anything needing a live database.
Prisma against a testcontainer DB is the right long-term answer; it isn't
wired up yet (see §6).

## 4. What we should test next (priority order)

1. **`resolveFarmScope` — 4 cases.** admin+requested → requested;
   admin+none → null; member+farm → farm; member+no-farm → `NO_FARM_MATCH`.
   This function is the tenant boundary; it deserves a test file of its own.
2. **Guard chain:** `checkCsrf` (safe methods, matching/mismatched origin),
   `checkRateLimit` window rollover, `hasMinRole` hierarchy edges.
3. **Zod schemas:** unknown keys stripped (especially that `role` can't
   arrive through `createUserSchema`).
4. **Reset-token logic:** digest match, 1-hour expiry, single-use invalidation.
5. **Export scoping:** CSV row sets differ per farm scope.
6. **Adversarial e2e:** two tenants, replay every GET with the other's ids,
   expect 404/empty (the single highest-value manual test —
   [security/tenant-isolation.md](./security/tenant-isolation.md) §6.4).

## 5. Writing tests

- Vitest style: `describe` per unit, `it` states the behavior in a sentence.
- No DB in unit tests — pass data in, assert data out. If a function can't
  be tested without a DB, it's doing too much; split it.
- Use `vi.fn()` for collaborators; don't mock Prisma inside unit tests
  (that's a sign the unit is a route handler — test the extracted function).
- Coverage thresholds: none yet. Adding them before the number is meaningful
  just teaches people to lower them.

## 6. Known tooling notes

**`--legacy-peer-deps` is required** — `next-auth@5.0.0-beta` peers on
`nodemailer ^7||^8`, we pin `^10` (security patches). npm's strict resolver
rejects the tree. Consequences:

- Use `npm ci --legacy-peer-deps` in CI and `npm install --legacy-peer-deps`
  locally. A plain `npm install` fails with `ERESOLVE`.
- `npm audit fix` fails for the same reason. To patch a dep:
  `npm update <pkg> --legacy-peer-deps --package-lock-only`.

**Coverage provider pinning:** `@vitest/coverage-v8` must match the Vitest
major (currently 3.2.7) or the run dies with
`BaseCoverageProvider` export errors. It's pinned in `devDependencies`.

**Playwright** needs browsers once per machine: `npx playwright install`.

**Coverage config** (`vitest.config.ts`): `include: ["src/lib/**/*.ts"]`,
excluding `prisma.ts`. Widening it to `src/app/api/**` will crater the
percentage — do that *with* the route tests in §4, not before, so the number
means something when it changes.

## 7. Definition of done

A change is done when:

- [ ] `npx tsc --noEmit` is clean
- [ ] `npm test` is green (and new behavior has tests where §4 says it should)
- [ ] e2e passes if auth, navigation, or a major flow changed
- [ ] Security-sensitive changes ticked the checklist in
      [contributing.md](./contributing.md)
