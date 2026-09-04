# 🌾 FarmOps — Farm Inventory & Resource Intelligence Platform

A comprehensive digital farm inventory and resource management platform designed to help agricultural operations efficiently track, manage, and optimize inputs, equipment, harvested products, and operational resources across multiple farms and storage locations.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-6.10-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?logo=tailwindcss)
![License](https://img.shields.io/badge/License-Private-red)

---

## ✨ Features

### Core Functionality

- **🏢 Multi-Farm Support** — Manage inventory across multiple farms and warehouses with farm-level isolation
- **📦 Inventory Management** — Full CRUD for items, batches, categories, and suppliers with batch-level tracking
- **🔄 Stock Movements** — Complete audit trail: receive, issue, transfer, adjust, waste, expire, and return
- **🏗️ Warehouse Management** — Hierarchical farm → warehouse locations with capacity tracking and type classification (Physical, Cold Storage, Virtual)
- **📋 Resource Requests** — Field workers submit inventory requests; managers review, approve/reject with notes
- **🛒 Purchase Orders** — Create, track, and receive against POs with line-item detail and status workflow
- **🗑️ Waste & Loss Tracking** — Record waste by type (expired, damaged, spoiled, lost, stolen) with cost impact analysis
- **📊 Physical Stock Count** — Warehouse audits with system vs. actual comparison and variance reporting

### Intelligence & Planning

- **📅 Seasonal Planning** — Create farming seasons with estimated inventory needs and budgets
- **📈 Dashboard Analytics** — Stats cards, consumption trends, inventory valuation charts, and farm-level breakdowns
- **⚠️ Low Stock Alerts** — Automatic detection when stock falls below configurable minimum levels
- **🕐 Expiry Management** — FEFO (First Expired, First Out) recommendations with 30-day expiry warnings
- **💰 Inventory Valuation** — Real-time value calculation by category, farm, and warehouse
- **🔔 Notifications System** — Auto-generated alerts for low stock, expiry, pending requests, and PO updates

### System Features

- **🔒 Role-Based Access Control** — 5 roles: Administrator, Farm Manager, Warehouse Manager, Field Worker, Accountant
- **🌙 Dark Mode** — Theme toggle with system preference detection
- **🌍 Internationalization** — Multi-language support: English, Twi (Akan), Ga, and Ewe
- **📝 Audit Trail** — Full audit log with old/new value diffs, IP address, and user agent tracking
- **📱 QR Codes** — Generate and scan QR codes for inventory items
- **📤 Import/Export** — CSV import and Excel export capabilities
- **📧 Email Notifications** — SMTP-based email support with MailHog for development

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language** | [TypeScript 5.7](https://www.typescriptlang.org/) |
| **Database** | [PostgreSQL 16](https://www.postgresql.org/) |
| **ORM** | [Prisma 6.10](https://www.prisma.io/) |
| **Auth** | [NextAuth.js v5](https://next-auth.js.org/) (Beta) |
| **UI Components** | [Radix UI](https://www.radix-ui.com/) primitives |
| **Styling** | [Tailwind CSS 3.4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| **Validation** | [Zod 3.24](https://zod.dev/) |
| **Charts** | [Recharts 2.15](https://recharts.org/) |
| **Testing** | [Vitest](https://vitest.dev/) (unit) + [Playwright](https://playwright.dev/) (E2E) |
| **Containerization** | [Docker](https://www.docker.com/) + Docker Compose |
| **CI/CD** | [GitHub Actions](https://github.com/features/actions) |
| **Package Manager** | [pnpm](https://pnpm.io/) |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ (recommended: 20)
- **PostgreSQL** 14+
- **pnpm** (recommended) or npm
- **Docker** (optional, for containerized setup)

### Quick Start (Local Development)

```bash
# 1. Clone the repository
git clone <repository-url>
cd farmops

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# 4. Initialize the database
pnpm db:push

# 5. Seed with sample data
pnpm db:seed

# 6. Start the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Setup (Recommended)

```bash
# Start all services (PostgreSQL + App + MailHog)
docker compose up -d

# The app will be available at http://localhost:3000
# MailHog email UI at http://localhost:8025
```

### Login Credentials (After Seeding)

| Role | Email | Password |
|------|-------|----------|
| 👑 Administrator | `admin@farmops.com` | `password123` |
| 🌾 Farm Manager | `manager@farmops.com` | `password123` |
| 🏗️ Warehouse Manager | `warehouse@farmops.com` | `password123` |
| 🔧 Field Worker | `worker@farmops.com` | `password123` |
| 📊 Accountant | `accountant@farmops.com` | `password123` |

---

## 📁 Project Structure

```
farmops/
├── prisma/
│   ├── schema.prisma              # Database schema (20 models, 11 enums)
│   ├── seed.ts                    # Comprehensive seed data
│   └── migrations/                # Database migrations
├── src/
│   ├── app/
│   │   ├── (auth)/                # Authentication pages
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   ├── forgot-password/
│   │   │   └── reset-password/
│   │   ├── (dashboard)/           # Main application pages
│   │   │   ├── dashboard/         # Overview & analytics
│   │   │   ├── inventory/         # Inventory management
│   │   │   ├── warehouses/        # Warehouse management
│   │   │   ├── transactions/      # Stock movements
│   │   │   ├── requests/          # Resource requests
│   │   │   ├── purchase-orders/   # Procurement
│   │   │   ├── waste/             # Waste tracking
│   │   │   ├── stock-count/       # Physical counts
│   │   │   ├── seasons/           # Seasonal planning
│   │   │   ├── farms/             # Farm management
│   │   │   ├── suppliers/         # Supplier management
│   │   │   ├── alerts/            # Low stock alerts
│   │   │   ├── notifications/     # Notifications center
│   │   │   ├── reports/           # Reports & analytics
│   │   │   ├── intelligence/      # Intelligence features
│   │   │   ├── audit-log/         # Audit trail
│   │   │   ├── qr/                # QR code generation
│   │   │   └── settings/          # User settings
│   │   └── api/                   # REST API endpoints (30+ routes)
│   │       ├── auth/              # NextAuth authentication
│   │       ├── inventory/         # Inventory CRUD
│   │       ├── warehouses/        # Warehouse CRUD
│   │       ├── transactions/      # Stock transactions
│   │       ├── requests/          # Resource requests
│   │       ├── purchase-orders/   # Purchase orders
│   │       ├── waste/             # Waste records
│   │       ├── reports/           # Analytics & reports
│   │       ├── import/            # CSV import
│   │       ├── export/            # Excel export
│   │       ├── qr/                # QR code endpoints
│   │       ├── webhooks/          # Webhook management
│   │       ├── api-keys/          # API key management
│   │       └── notifications/     # Notification endpoints
│   ├── components/
│   │   ├── ui/                    # shadcn/ui base components (15 components)
│   │   ├── layout/                # Sidebar, header, language switcher
│   │   ├── shared/                # Data table, search, badges
│   │   ├── inventory/             # Inventory-specific components
│   │   ├── dashboard/             # Dashboard widgets & charts
│   │   ├── warehouses/            # Warehouse components
│   │   ├── transactions/          # Transaction components
│   │   ├── requests/              # Request components
│   │   └── forms/                 # Form components
│   ├── lib/
│   │   ├── prisma.ts              # Prisma client singleton
│   │   ├── auth.ts                # NextAuth configuration
│   │   ├── validations.ts         # Zod validation schemas
│   │   ├── constants.ts           # Roles, statuses, units
│   │   ├── utils.ts               # Utility functions
│   │   ├── email.ts               # SMTP email service
│   │   ├── notifications.ts       # Notification logic
│   │   ├── audit.ts               # Audit logging
│   │   ├── pagination.ts          # Pagination helpers
│   │   ├── api-keys.ts            # API key management
│   │   ├── api-auth.ts            # API authentication
│   │   ├── api-validations.ts     # API validation middleware
│   │   ├── webhooks.ts            # Webhook dispatch
│   │   └── i18n/                  # Internationalization
│   │       ├── index.tsx          # i18n provider & hooks
│   │       └── locales/           # en.json, tw.json, ga.json, ewe.json
│   ├── hooks/                     # Custom React hooks
│   └── types/
│       └── index.ts               # Shared TypeScript types
├── tests/
│   ├── setup.ts                   # Test setup (jsdom, @testing-library)
│   ├── lib/                       # Unit tests (5 test files)
│   │   ├── utils.test.ts
│   │   ├── email.test.ts
│   │   ├── pagination.test.ts
│   │   ├── api-keys.test.ts
│   │   └── webhooks.test.ts
│   └── e2e/                       # End-to-end tests
│       ├── auth.spec.ts
│       └── api.spec.ts
├── public/
│   ├── icons/                     # App icons
│   ├── screenshots/               # App screenshots
│   └── uploads/                   # User uploads
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI/CD pipeline
├── docker-compose.yml             # Docker Compose orchestration
├── Dockerfile                     # Multi-stage Docker build
├── tailwind.config.ts             # Tailwind CSS configuration
├── vitest.config.ts               # Vitest test configuration
├── playwright.config.ts           # Playwright E2E configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Dependencies & scripts
```

---

## 🗄️ Database Schema

The application uses **20 Prisma models** with **11 enums** to manage the full inventory lifecycle:

### Core Models

| Model | Description |
|-------|-------------|
| `User` | Authentication, roles, and profile management |
| `Farm` | Multi-farm support with location and acreage |
| `Warehouse` | Storage locations with type (Physical/Cold/Virtual) and capacity |
| `Category` | Inventory item categorization with icons and colors |
| `Supplier` | Vendor management with contact info and ratings |

### Inventory Models

| Model | Description |
|-------|-------------|
| `InventoryItem` | Master item definitions with reorder points and shelf life |
| `InventoryBatch` | Batch tracking with expiry, cost, barcode, and QR data |
| `StockTransaction` | Complete movement audit trail (7 transaction types) |
| `StockAdjustment` | Physical count reconciliations with variance tracking |

### Operational Models

| Model | Description |
|-------|-------------|
| `ResourceRequest` | Field worker requests with priority and approval workflow |
| `PurchaseOrder` | Procurement with line items and status tracking |
| `PurchaseOrderItem` | Individual PO line items with received quantities |
| `WasteRecord` | Waste/loss tracking by type with cost impact |

### Planning & Analytics Models

| Model | Description |
|-------|-------------|
| `Season` | Seasonal planning with crop types and date ranges |
| `SeasonInventoryPlan` | Per-season inventory needs and budgets |
| `StockCount` | Physical count sessions with status tracking |
| `StockCountItem` | Individual count items with system vs. actual variance |

### System Models

| Model | Description |
|-------|-------------|
| `Notification` | In-app notifications with type-based routing |
| `AuditLog` | Full audit trail with old/new value diffs |

### Enums

`UserRole`, `TransactionType`, `BatchStatus`, `RequestStatus`, `RequestPriority`, `WarehouseType`, `WasteType`, `AdjustmentType`, `POStatus`, `SeasonStatus`, `NotificationType`

---

## 🌐 API Reference

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/*` | Various | NextAuth.js authentication endpoints |

### Core Resources

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/inventory` | GET, POST | List or create inventory items |
| `/api/inventory/[id]` | GET, PUT, DELETE | Get, update, or delete an item |
| `/api/batches` | GET, POST | List or create inventory batches |
| `/api/warehouses` | GET, POST | List or create warehouses |
| `/api/transactions` | GET, POST | List or create stock transactions |
| `/api/farms` | GET, POST | List or create farms |
| `/api/suppliers` | GET, POST | List or create suppliers |
| `/api/categories` | GET, POST | List or create categories |

### Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/requests` | GET, POST | List or create resource requests |
| `/api/purchase-orders` | GET, POST | List or create purchase orders |
| `/api/waste` | GET, POST | List or create waste records |
| `/api/stock-count` | GET, POST | List or create physical stock counts |

### Intelligence & Reports

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reports` | GET | Dashboard stats, charts, and analytics |
| `/api/intelligence` | GET | Intelligence features and insights |
| `/api/alerts` | GET | Low stock and expiry alerts |

### System

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/notifications` | GET | List user notifications |
| `/api/audit-log` | GET | Query audit trail |
| `/api/users` | GET, POST | User management (admin) |
| `/api/import` | POST | CSV data import |
| `/api/export` | GET | Excel data export |
| `/api/qr` | GET | QR code generation |
| `/api/webhooks` | GET, POST | Webhook management |
| `/api/api-keys` | GET, POST | API key management |
| `/api/seed` | POST | Database seeding (dev only) |

---

## 🧪 Testing

### Unit Tests (Vitest)

```bash
# Run unit tests
pnpm test

# Run in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage
```

Unit tests cover:
- Utility functions (`utils.test.ts`)
- Email service (`email.test.ts`)
- Pagination helpers (`pagination.test.ts`)
- API key management (`api-keys.test.ts`)
- Webhook dispatch (`webhooks.test.ts`)

### End-to-End Tests (Playwright)

```bash
# Run E2E tests
pnpm test:e2e

# Run with UI mode
pnpm test:e2e:ui

# Run all tests (unit + E2E)
pnpm test:all
```

E2E tests cover:
- Authentication flows (`auth.spec.ts`)
- API endpoints (`api.spec.ts`)

### CI Pipeline

The GitHub Actions workflow (`ci.yml`) runs automatically on push to `main`/`develop` and on PRs to `main`:

1. **Lint & Type Check** — ESLint + TypeScript compilation
2. **Unit Tests** — Vitest with verbose output
3. **Build** — Full Next.js production build
4. **E2E Tests** — Playwright against a real PostgreSQL database
5. **Docker Build** — Production image build (main branch only)

---

## 🐳 Docker

### Development

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16** (port 5432) with health checks
- **Next.js App** (port 3000) with hot reload
- **MailHog** (port 8025) for email testing

### Production

```bash
# Build the production image
docker build -t farmops:latest .

# Run with external database
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_SECRET="..." \
  farmops:latest
```

The Dockerfile uses a multi-stage build:
1. **deps** — Install dependencies with pnpm
2. **builder** — Generate Prisma client and build Next.js
3. **runner** — Minimal production image with standalone output

---

## 🌍 Internationalization

FarmOps supports 4 languages out of the box:

| Code | Language | Flag |
|------|----------|------|
| `en` | English | 🇬🇧 |
| `tw` | Twi (Akan) | 🇬🇭 |
| `ga` | Ga | 🇬🇭 |
| `ewe` | Ewe | 🇬🇭 |

Language selection persists in `localStorage` and can be switched at any time via the header language switcher.

### Adding a New Language

1. Create a new locale file in `src/lib/i18n/locales/<code>.json`
2. Add the locale to the `locales` record in `src/lib/i18n/index.tsx`
3. Add the language option to `LANGUAGE_OPTIONS`

---

## 📊 Role-Based Access Control

| Role | Capabilities |
|------|-------------|
| **👑 Administrator** | Full system access, user management, system settings, audit logs |
| **🌾 Farm Manager** | Manage farms, approve requests, view reports, manage seasons |
| **🏗️ Warehouse Manager** | Manage warehouses, process stock movements, physical counts |
| **🔧 Field Worker** | Submit resource requests, view own requests, scan QR codes |
| **📊 Accountant** | View financial reports, inventory valuation, purchase orders |

---

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm db:push` | Push schema to database |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed database with sample data |
| `pnpm db:reset` | Reset database and re-seed |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm test` | Run unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm test:all` | Run all tests |

---

## 🗺️ Roadmap

### v0.1.0 — MVP ✅

- [x] Multi-farm inventory management
- [x] Warehouse and batch tracking
- [x] Stock movements with full audit trail
- [x] Resource request workflow
- [x] Purchase order management
- [x] Waste and loss tracking
- [x] Physical stock counts
- [x] Seasonal planning
- [x] Dashboard analytics and charts
- [x] Role-based access control (5 roles)
- [x] Dark mode
- [x] Internationalization (4 languages)
- [x] QR code generation and scanning
- [x] CSV import / Excel export
- [x] Docker support
- [x] CI/CD pipeline

### v0.2.0 — Intelligence 🔮

- [ ] Consumption forecasting with trend analysis
- [ ] Improved expiry management with auto-reorder
- [ ] Advanced analytics and custom reports
- [ ] Dashboard widgets with drag-and-drop
- [ ] Batch-level cost tracking and margin analysis

### v0.3.0 — Smart Integration 🤖

- [ ] AI-powered inventory recommendations
- [ ] Weather data integration for planting decisions
- [ ] IoT sensor data ingestion (temperature, humidity)
- [ ] Predictive resource planning with ML models
- [ ] Mobile app (React Native) for field workers
- [ ] Offline-first capability with sync

### v0.4.0 — Enterprise 🏢

- [ ] Multi-tenant architecture
- [ ] SSO / SAML authentication
- [ ] Advanced reporting with custom dashboards
- [ ] API rate limiting and usage analytics
- [ ] Compliance and regulatory reporting

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and conventions
- Write tests for new features
- Update documentation as needed
- Keep PRs focused and small

---

## 📄 License

This project is private and proprietary. All rights reserved.

---

## 🙏 Acknowledgments

Built with the [T3 Stack](https://create.t3.gg/) philosophy:
- [Next.js](https://nextjs.org/) — React framework
- [Prisma](https://prisma.io/) — Database ORM
- [Tailwind CSS](https://tailwindcss.com/) — Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com/) — Beautiful components
- [Radix UI](https://radix-ui.com/) — Accessible primitives
