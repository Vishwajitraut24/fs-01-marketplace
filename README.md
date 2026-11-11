# FS-01 - Multi-Vendor E-Commerce Marketplace

A full-stack multi-vendor e-commerce marketplace where customers can discover products, manage carts and place orders, vendors can manage products and fulfill orders, and administrators can review vendor applications.

The project uses a React frontend, Node.js and Express API, MongoDB, Redis, Elasticsearch and Razorpay Test Mode.

## Project Status

**Development milestone: Core marketplace implementation completed.**

Verified on November 11, 2026:

- Backend and frontend TypeScript checks passed.
- Production builds completed successfully.
- Customer registration and login tested successfully.
- Frontend navigation and catalog endpoint tested.
- MongoDB, Redis and Elasticsearch connections verified.
- Production dependency audit reported zero vulnerabilities.
- Latest changes committed and pushed to GitHub.

These checks verify the current development build. They do not constitute a complete production deployment or live-payment certification.

## Features

### Customer
- Customer registration and login.
- Product catalog and product discovery.
- Product search and filtering.
- Sorting and pagination.
- Shopping cart management.
- Checkout with Cash on Delivery and Razorpay.
- Customer order history.

### Vendor
- Vendor application and onboarding.
- Vendor dashboard.
- Product creation and management.
- Inventory management.
- Vendor order management.
- Order fulfillment status updates.

### Administrator
- Vendor application management.
- Vendor approval and rejection.
- Administrative vendor management.

### Backend and Infrastructure
- REST API using Node.js and Express.
- MongoDB with Mongoose.
- Redis integration.
- Elasticsearch product search.
- Product search synchronization with product and vendor lifecycle changes.
- Razorpay Test Mode order creation and payment verification.
- Razorpay webhook signature verification and event processing.
- Unpaid order expiry handling for eligible orders.
- Inventory restoration during eligible order cancellation.
- Structured application logging.
- API liveness and readiness endpoints.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, TypeScript, Vite |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js, TypeScript |
| Database | MongoDB, Mongoose |
| Search | Elasticsearch |
| Cache | Redis |
| Payments | Razorpay Test Mode |
| Validation | Zod |
| Containerization | Docker, Docker Compose |
| Version Control | Git and GitHub |

## Prerequisites

Install the following:

- Node.js 26.x
- npm 10 or newer
- Docker Desktop
- Git

For local development, allocate approximately 6 GB or more of memory to Docker because Elasticsearch requires additional resources.

## Project Structure

```text
fs-01-marketplace/
|
|-- apps/
|   |-- api/                  # Express backend
|   |-- web/                  # React frontend
|
|-- docs/                     # Architecture and database documentation
|
|-- infrastructure/
|   |-- docker-compose.yml    # Local infrastructure services
|
|-- .env.example              # Environment variable template
|-- .gitignore
|-- package.json
|-- package-lock.json
|-- README.md
```

## Installation and Setup

### 1. Clone the repository

```bash
git clone https://github.com/Vishwajitraut24/fs-01-marketplace.git
cd fs-01-marketplace
```

### 2. Configure environment variables

Create your local environment file.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure the required values.

Important variables include database connection settings, Redis configuration, Elasticsearch configuration, application URLs and Razorpay Test Mode credentials.

Do not commit your actual `.env` file or share payment credentials.

### 3. Start infrastructure services

From the repository root:

```bash
docker compose -f infrastructure/docker-compose.yml up -d
```

This starts the local MongoDB replica set, Redis and Elasticsearch services.

Check their status:

```bash
docker compose -f infrastructure/docker-compose.yml ps
```

Wait until MongoDB replica-set initialization completes and all required services are healthy.

### 4. Install project dependencies

```bash
npm install
```

### 5. Start the application

The root project provides a command that starts the frontend and backend together:

```bash
npm run dev
```

Alternatively, start them in separate terminals.

**Backend:**

```bash
npm run dev --workspace @fs01/api
```

**Frontend:**

```bash
npm run dev --workspace @fs01/web
```

## Application URLs

| Service | Local URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:4000 |
| API Catalog | http://localhost:4000/api/v1/catalog/products |
| API Liveness | http://localhost:4000/api/v1/health/live |
| API Readiness | http://localhost:4000/api/v1/health/ready |
| MongoDB | localhost:27017 |
| Redis | localhost:6379 |
| Elasticsearch | http://localhost:9200 |

The readiness endpoint reports infrastructure availability and can return HTTP 503 when required dependencies are unavailable.

## Useful Commands

Run these commands from the repository root.

**Start frontend and backend:**

```bash
npm run dev
```

**TypeScript validation:**

```bash
npm run typecheck
```

**Production build:**

```bash
npm run build
```

**Run backend tests:**

```bash
npm test
```

**Production dependency security audit:**

```bash
npm audit --omit=dev
```

## Search and Product Availability

Elasticsearch is used for product discovery and search. Product records are synchronized with the search index as relevant product and vendor lifecycle operations occur.

The public catalog only returns eligible active products from approved vendors.

An empty catalog is expected when there are no approved vendors with active products.

## Payment Configuration

The project integrates Razorpay Test Mode for payment-order creation and payment verification.

To test payment functionality:

1. Configure Razorpay Test Mode credentials in the local `.env`.
2. Start the backend and frontend.
3. Create a valid customer order.
4. Initiate the Razorpay checkout flow.
5. Complete a test payment.
6. Verify the payment result and order status.

Razorpay webhook testing also requires the webhook secret and a correctly configured webhook endpoint.

**Important:** Test Mode integration does not mean live payments or automatic vendor settlements have been certified. Configure and verify the gateway's production marketplace settlement capabilities before enabling real transactions.

## Security Notes

- Never commit `.env` files or API credentials.
- Use separate credentials for development and production.
- Keep MongoDB, Redis and Elasticsearch private.
- Configure authentication, authorization and CORS correctly for deployed environments.
- Use HTTPS for production traffic.
- Configure valid payment webhook secrets.
- Use secure production database credentials and backups.
- Review dependency vulnerabilities regularly.

Elasticsearch's local development configuration must not be exposed publicly without appropriate security controls.

## Troubleshooting

### MongoDB connection problems

- Confirm that Docker containers are running.
- Check MongoDB connection settings in `.env`.
- Verify that replica-set initialization completed successfully.

### Redis connection problems

- Confirm that the Redis container is running.
- Check the Redis URL and password configuration.

### Elasticsearch connection problems

- Confirm that Elasticsearch is running.
- Verify the configured Elasticsearch node URL.
- Check Docker Desktop memory allocation.

### Frontend cannot connect to backend

- Confirm that the backend is running.
- Check `VITE_API_BASE_URL`.
- Verify the backend's `WEB_ORIGIN` configuration.

### Empty product catalog

The public catalog requires active products belonging to approved vendors. An empty database or absence of approved vendors can therefore produce an empty catalog.

## Deployment Considerations

The frontend and backend are maintained as separate workspaces and can be deployed independently.

Before production deployment:

- Configure production environment variables.
- Use secured managed database and infrastructure services.
- Configure HTTPS and production CORS origins.
- Configure payment gateway production credentials and webhooks.
- Verify vendor settlement and payout functionality.
- Test complete customer, vendor and administrator workflows.
- Configure logging, monitoring, backups and recovery procedures.

Deployment-provider-specific configuration is not included in this local development setup.

## Repository

GitHub:

https://github.com/Vishwajitraut24/fs-01-marketplace

## License

Add the appropriate license before distributing or publishing this project for external use.