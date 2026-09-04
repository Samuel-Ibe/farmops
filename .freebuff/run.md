# FarmOps Run Doc

## Reproduce uncommitted artifacts
Copy `.env` from the main checkout — secrets and DB URLs are configured there.
```bash
cp "C:\Users\Samuel Ibe\Downloads\Farm Ops\.env" .env
```

## Install dependencies
```bash
npm install
```

## Seed database (first run only)
The PostgreSQL database must be running. Seed with demo data:
```bash
curl -s -X POST http://localhost:3000/api/seed
```

## Start dev server
Use the Windows detach recipe from `<preview_state>`:
```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput '.freebuff\preview-5bce4995-3573-4eb8-acf5-ac541168a69f.log' -RedirectStandardError '.freebuff\preview-5bce4995-3573-4eb8-acf5-ac541168a69f.log.err' -WindowStyle Hidden -PassThru).Id"
```

## Test accounts
| Email | Password | Role |
|-------|----------|------|
| admin@farmops.com | password123 | Admin |
| manager@farmops.com | password123 | Farm Manager |
| samuelibe200@gmail.com | Prosperity2003 | Farm Manager |

## Known fixes applied
- **Middleware cookie name**: NextAuth v5 (Auth.js) uses `authjs.session-token`, not `next-auth.session-token`. The middleware was checking the wrong cookie name, which caused every authenticated page to redirect back to login.
- **API response format**: All paginated API routes (inventory, transactions, waste, requests, stock-count, purchase-orders) were changed from `paginatedResponse()` to `cachedJsonResponse()` to return plain arrays instead of `{data:[...]}`. This fixed client pages that expected plain arrays.
- **Service Worker**: Disabled SW registration in development mode (`sw-register.tsx` checks `process.env.NODE_ENV !== 'development'`) to prevent stale cached JS bundles.
- **Dashboard data extraction**: Added `extract()` helper in dashboard/page.tsx, global-search.tsx, qr/page.tsx, and reports/page.tsx to handle both `{data:[...]}` and plain array API responses.
- **Defensive array checks**: Added `safeItems`, `safeTransactions`, `safeRecords`, `safeCounts`, `safeOrders`, `safeRequests` wrappers in inventory, transactions, waste, stock-count, purchase-orders, and requests pages.
