# 🛍️ FS-01 — Multi-Vendor E-Commerce Marketplace

A full-stack marketplace application that brings customers, independent sellers and administrators together. Customers can browse products, manage a shopping cart, place orders and pay using Cash on Delivery or Razorpay Test Mode. Vendors can manage products and fulfill seller orders, while administrators can review vendor applications and monitor marketplace activity.

> **Project status:** Core marketplace features and local development workflows have been implemented and tested. Cloud services have been provisioned, and Vercel deployment preparation is in progress. This repository is not yet a live production deployment.

---

## ✨ Features

### 🛒 Customer experience
- Customer registration and login.
- Product discovery through the public catalog.
- Product search, category filtering, sorting and pagination.
- Shopping cart with quantity updates and item removal.
- Checkout with Cash on Delivery or Razorpay Test Mode.
- Customer order history.
- Product ratings and reviews. Review submission is restricted to customers with a delivered order containing the reviewed product.
- Coupon-code entry at checkout, with server-side validation.
- Downloadable PDF order invoices for eligible orders.

### 🏪 Vendor experience
- Vendor application and onboarding.
- Vendor approval workflow.
- Vendor dashboard and seller-order view.
- Product creation, editing and archiving.
- Product inventory management.
- Seller-order fulfillment status updates.

### 🛡️ Administrator experience
- View pending vendor applications.
- Approve or reject vendor applications.
- Admin analytics overview, including revenue, order, customer, vendor and product metrics.
- Coupon creation, listing and deactivation through protected API endpoints.

### ⚙️ Backend and infrastructure
- REST API built with Express and TypeScript.
- MongoDB with Mongoose for persistent data.
- Redis for refresh-session storage and session rotation.
- Elasticsearch for product search; MongoDB remains the source of truth.
- Razorpay Test Mode order creation, signature verification, payment capture checks and webhook handling.
- Scheduled local cleanup for eligible unpaid orders that never received a gateway order ID.
- Structured application logging, request validation and protected routes.

---

## 🧰 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Backend | Node.js 24.x, Express 5, TypeScript |
| Validation | Zod |
| Database | MongoDB, Mongoose |
| Local cache/session service | Redis |
| Serverless Redis option | Upstash Redis REST SDK |
| Search | Elasticsearch |
| Payments | Razorpay Test Mode |
| PDF generation | PDFKit |
| Local infrastructure | Docker Compose |
| Monorepo | npm workspaces |
| Version control | Git and GitHub |

---

## 🏗️ Architecture

The repository is an npm-workspaces monorepo containing separately maintained frontend and backend applications.

```text
fs-01-marketplace/
├── apps/
│   ├── api/                       # Express REST API
│   │   └── src/
│   │       ├── config/            # Environment validation
│   │       ├── infrastructure/    # MongoDB, Redis, Elasticsearch, logging
│   │       ├── middleware/        # Authentication, errors and request handling
│   │       ├── models/            # Mongoose models
│   │       ├── routes/            # REST API routes
│   │       ├── services/          # Business logic
│   │       ├── app.ts             # Express application
│   │       └── server.ts          # Local HTTP server bootstrap
│   └── web/                       # React + Vite frontend
│       └── src/
│           ├── components/        # Marketplace UI components
│           ├── lib/               # Frontend API client
│           ├── App.tsx
│           └── main.tsx
├── docs/
│   ├── ARCHITECTURE.md
│   └── DATABASE_DESIGN.md
├── infrastructure/
│   └── docker-compose.yml         # Local MongoDB, Redis and Elasticsearch
├── .env.example                   # Safe environment template
├── package.json                  # Workspace scripts
├── package-lock.json
└── README.md
```

### High-level request flow

```text
Customer / Vendor / Admin
          │
          ▼
   React + Vite frontend
          │ HTTPS / REST
          ▼
     Express API
          │
    ┌─────┼──────────────┐
    ▼     ▼              ▼
 MongoDB Redis       Elasticsearch
    │                    ▲
    └── product data ────┘
          │
          ▼
   Razorpay Test Mode
   (payment order, verification, webhooks)
```

- **MongoDB** is the persistent source of truth for users, vendors, products and orders.
- **Redis** stores refresh-session data. Local development uses the Docker Redis service; the deployment configuration can use Upstash REST.
- **Elasticsearch** is a derived search index and can be rebuilt from eligible MongoDB products.

More detail is available in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/DATABASE_DESIGN.md`](docs/DATABASE_DESIGN.md).

---

## ✅ Prerequisites

Install the following before running the project locally:

- Node.js **24.x** and npm 10 or newer.
- Docker Desktop with sufficient memory for Elasticsearch (6 GB or more allocated to Docker is recommended for local development).
- Git.

Check versions:

```bash
node --version
npm --version
docker --version
```

---

## 🚀 Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Vishwajitraut24/fs-01-marketplace.git
cd fs-01-marketplace
```

### 2. Create the environment file

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS / Linux:

```bash
cp .env.example .env
```

Open `.env` and set the required local values. Do not commit this file or share its contents.

### 3. Start local infrastructure

From the repository root:

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

Check container status:

```bash
docker compose -f infrastructure/docker-compose.yml ps
```

Wait for MongoDB replica-set initialization to complete before starting the API. The replica set is used by transactional checkout and inventory operations.

### 4. Install dependencies

From the repository root:

```bash
npm install
```

### 5. Start frontend and backend

Run both workspaces together:

```bash
npm run dev
```

Or start them separately in two terminals:

**Backend:**

```bash
npm run dev:api
```

**Frontend:**

```bash
npm run dev:web
```

### 6. Local URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API root | http://localhost:4000 |
| API liveness | http://localhost:4000/api/v1/health/live |
| API readiness | http://localhost:4000/api/v1/health/ready |
| Product catalog | http://localhost:4000/api/v1/catalog/products |
| MongoDB | mongodb://localhost:27017 |
| Redis | redis://localhost:6379 |
| Elasticsearch | http://localhost:9200 |

The frontend API base URL is configured with `VITE_API_BASE_URL`. For local development, use:

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

---

## 🔐 Environment Variables

The backend validates its environment at startup. Configure the values in the root `.env` file for local development and in the hosting provider's environment-variable settings for deployment.

| Variable | Purpose | Local development | Cloud deployment |
|---|---|---|---|
| `NODE_ENV` | Runtime environment | `development` | `production` |
| `LOG_LEVEL` | Application log level | `info` | `info` or stricter |
| `PORT` | Local API port | `4000` | Provided by hosting platform / runtime |
| `WEB_ORIGIN` | Allowed frontend origin(s) for CORS | `http://localhost:5173` | Actual Vercel frontend origin |
| `TRUST_PROXY` | Trust hosting proxy headers | `false` | `true` when required by hosting setup |
| `MONGODB_URI` | MongoDB connection string | Local replica-set URI | MongoDB Atlas connection string |
| `REDIS_PROVIDER` | Redis client selection | `local` | `upstash` |
| `REDIS_URL` | Local Redis connection string | Docker Redis URL | Retain a valid value if required by schema; Upstash REST is selected separately |
| `UPSTASH_REDIS_REST_URL` | Upstash REST endpoint | Not required | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash REST credential | Not required | Upstash REST token |
| `ELASTICSEARCH_NODE` | Elasticsearch endpoint | Local Docker endpoint | Elastic Cloud endpoint |
| `ELASTICSEARCH_API_KEY` | Elasticsearch API-key authentication | Optional locally | Elastic Cloud API key |
| `JWT_ACCESS_SECRET` | JWT signing secret | Strong local secret (32+ characters) | Unique strong production secret (32+ characters) |
| `RAZORPAY_KEY_ID` | Razorpay key identifier | Test Mode key | Test Mode key for demo deployment |
| `RAZORPAY_KEY_SECRET` | Razorpay server-side secret | Test Mode secret | Test Mode secret for demo deployment |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook signature secret | Local webhook secret | Configured webhook secret (32+ characters) |
| `RAZORPAY_ROUTE_ENABLED` | Route feature flag | `false` | `false` unless Route access is approved and integrated |
| `PLATFORM_COMMISSION_BPS` | Commission configuration value | `1000` by default | Configuration only; automated Route split payouts are not implemented |
| `VITE_API_BASE_URL` | Frontend API base URL | `http://localhost:4000/api/v1` | `https://<backend-domain>/api/v1` |

**Security:** Never commit `.env`, cloud credentials, API keys, database passwords, webhook secrets or tokens. Use the hosting provider's encrypted environment-variable settings. Do not put server secrets in variables prefixed with `VITE_`, because Vite exposes those values to browser code.

---

## 🧪 Development, Test and Build Commands

Run these commands from the repository root.

| Command | Purpose |
|---|---|
| `npm run dev` | Start API and web workspaces together |
| `npm run dev:api` | Start backend only |
| `npm run dev:web` | Start frontend only |
| `npm run typecheck` | Typecheck backend and frontend |
| `npm test` | Run backend Vitest tests |
| `npm run build` | Build backend and frontend |
| `npm audit --omit=dev` | Audit production dependencies |

The project has previously passed TypeScript validation and production builds in the local development environment. The backend test suite currently contains health-endpoint tests; expand automated coverage for checkout, coupon redemptions, reviews, invoices and payment webhooks before production use.

---

## 💳 Payments and Marketplace Settlements

The current payment integration uses **Razorpay Test Mode**.

Implemented payment capabilities include:
- Create a Razorpay payment order using the server-calculated order total.
- Verify the checkout signature on the backend.
- Fetch payment details from Razorpay and validate order, amount and currency.
- Capture an authorized payment when required by the existing payment flow.
- Process signature-verified webhook events with duplicate-event protection.

### Important payment limitation

**Razorpay Route split payments and automated vendor payouts are not implemented.** Route was not available in the Razorpay dashboard during this project setup. The `RAZORPAY_ROUTE_ENABLED` flag remains disabled. The commission environment setting is configuration only and must not be represented as an active settlement or payout feature.

For a real marketplace launch, obtain Razorpay Route approval, onboard linked vendor accounts, implement and test transfer creation, reversals and reconciliation, and verify the relevant settlement requirements. Do not use live payment credentials until the full flow has been independently tested and approved.

---

## ⭐ Reviews, Coupons and Invoices

### Product reviews
- Public review listing and rating statistics.
- Review creation restricted to a customer whose order contains the product and whose seller order is marked delivered.
- One review per customer per product, enforced by a unique database index.
- Backend operations for editing and deleting a customer's own review.

### Coupons
- Percentage and fixed-value coupon types.
- Minimum order amount, optional maximum percentage discount, start and expiry dates.
- Overall and per-customer usage limits.
- Server-side validation and discount calculation during checkout.
- Admin API operations to create, list and deactivate coupons.

### PDF invoices
- Authenticated customers can download an invoice for an eligible order.
- Invoice content is generated from saved order and shipping snapshots.
- Pending-payment and cancelled orders are not eligible for invoice download.
- The generated document is an **order invoice/receipt, not a GST tax invoice**. GST registration and tax breakdown support are not part of the current implementation.

---

## 📊 Admin Analytics

The protected admin analytics endpoint is:

```text
GET /api/v1/admin/analytics/overview
```

The overview includes:
- Total orders and paid orders.
- Total customers.
- Total vendors and approved vendors.
- Active product count.
- Captured revenue and last-30-day revenue/order totals.
- Daily paid revenue data for the recent seven-day period.
- Top-selling products and order-status counts.

Analytics are calculated from the data currently stored in MongoDB. Empty or newly created databases will naturally show zero counts and no sales. The analytics revenue calculation is not a settlement ledger or vendor payable report.

---

## 🔎 Product Search and Catalog Visibility

Elasticsearch is used for product discovery and search. MongoDB remains the canonical product store.

The public catalog only exposes eligible active products belonging to approved vendors. Therefore, an empty catalog is expected when there are no approved vendors with active products. No demo vendor or product data is automatically fabricated by this project.

---

## ☁️ Deployment Status and Vercel Preparation

The intended deployment is two separate Vercel projects connected to the same GitHub monorepo:

| Project | Repository | Intended root directory |
|---|---|---|
| Backend API | `Vishwajitraut24/fs-01-marketplace` | `apps/api` |
| Frontend web app | `Vishwajitraut24/fs-01-marketplace` | `apps/web` |

External services provisioned for deployment preparation:
- MongoDB Atlas for the cloud database.
- Upstash Redis for serverless-compatible Redis access.
- Elastic Cloud for hosted Elasticsearch.
- Razorpay Test Mode for payment testing.

**Deployment is still pending.** Provisioning cloud services does not by itself mean that the application has been successfully deployed or that the Vercel-to-service connections have been verified.

Before declaring the Vercel deployment complete:
1. Configure all backend environment variables in Vercel.
2. Verify the backend Express entry point and Vercel routing configuration.
3. Confirm MongoDB Atlas, Upstash and Elastic Cloud connectivity from the deployed function.
4. Configure frontend `VITE_API_BASE_URL` to the deployed API URL.
5. Set backend `WEB_ORIGIN` to the actual deployed frontend origin.
6. Verify authentication, CORS, catalog, cart, checkout, webhooks, coupons, reviews, invoices and admin analytics.
7. Replace the local five-minute unpaid-order expiry timer with a protected scheduled endpoint / Vercel Cron configuration. A continuously running `setInterval` must not be relied on in serverless functions.
8. Configure monitoring, database backups, rate limits and recovery procedures appropriate to the hosting plan.

---

## ⚠️ Known Limitations and Production Checklist

- Razorpay Route split payments and automated vendor settlements are not implemented.
- The current invoice is not a GST tax invoice.
- A review can only be submitted after the relevant seller order is marked delivered.
- The public catalog requires an approved vendor and active product data.
- The order-expiry task currently runs in the local server process; migrate it to a protected scheduled function before relying on it in Vercel.
- End-to-end workflows involving multiple vendors, real Route transfers, refunds, reversals and live payments require additional implementation and testing.
- Add broader automated tests for critical business flows before production launch.

---

## 🧯 Troubleshooting

### MongoDB connection fails
- Confirm the MongoDB Atlas connection string or local MongoDB container is correct.
- Check Atlas network access rules and the database user's privileges.
- Confirm the replica set is available for transaction-based checkout.

### Redis connection fails
- For local development, confirm Docker Redis is running and `REDIS_PROVIDER=local`.
- For Vercel, confirm `REDIS_PROVIDER=upstash` and that the Upstash REST URL and token are configured correctly.

### Elasticsearch connection fails
- Confirm `ELASTICSEARCH_NODE` is a valid endpoint URL.
- For Elastic Cloud, verify the API key is present and has the required index privileges.
- For local development, confirm the Docker Elasticsearch service is running.

### Frontend cannot reach the API
- Confirm `VITE_API_BASE_URL` contains the deployed API base URL ending in `/api/v1`.
- Confirm the backend `WEB_ORIGIN` exactly matches the frontend origin.
- Check browser console errors and Vercel function logs.

### Catalog is empty
- Check whether any vendors are approved.
- Confirm those vendors have active products with available inventory.

---

## 📦 Repository

GitHub: <https://github.com/Vishwajitraut24/fs-01-marketplace>

## 📄 License

No open-source license has been declared in this repository. Add an appropriate `LICENSE` file before permitting external reuse or redistribution.
