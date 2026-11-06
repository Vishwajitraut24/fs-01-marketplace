# FS-01 Architecture

## Architecture style

A TypeScript monorepo with independently deployable React and Express applications. The backend follows a modular monolith / clean-architecture direction: HTTP routes are adapters, application services own use cases, and infrastructure adapters own MongoDB, Redis, Elasticsearch, S3 and payment-provider access.

## Runtime components

- **Web:** React + Vite + TypeScript + Tailwind CSS. Deploy independently (for example, Vercel or a static host).
- **API:** Node.js + Express + TypeScript REST API. Deploy independently (for example, AWS or Render).
- **MongoDB:** system of record for users, vendor profiles, catalog, inventory, orders, payments and audit history. Use a replica set in development and production to support transactions and change streams.
- **Redis:** ephemeral cart/session/cache/rate-limit data. MongoDB remains the durable source of truth for placed orders.
- **Elasticsearch:** derived search index. It is rebuildable from MongoDB and is not the source of truth.
- **S3:** private object storage for uploads; issue short-lived presigned URLs after authorization and validate uploaded objects.
- **Payment provider:** provider adapter (Razorpay Route initially) isolates provider API calls, webhook verification and transfer orchestration from order logic.

## Core commerce flow

1. Customer cart is read from Redis and reconciled against authoritative product prices and inventory in MongoDB.
2. Checkout creates a pending parent order and vendor-specific suborders in a MongoDB transaction, with inventory reservations.
3. API creates a payment order with the configured payment provider and returns only the checkout-safe fields to the browser.
4. Provider webhooks are signature-verified and idempotently recorded. A browser redirect is never proof of payment.
5. A successful payment moves the order to paid/processing. Vendor suborders are fulfilled independently.
6. Transfers are initiated according to the payment provider's supported marketplace workflow and a configurable commission ledger. Refunds and reversals create compensating ledger entries; never rewrite historical money movements.

## Security boundaries

- Deny access by default; authorize every resource using both role and ownership checks.
- Keep secrets on the server. Browser code receives no database, Redis, S3 secret, or payment secret.
- Store money as integer paise and use deterministic rounding rules.
- Verify webhook signatures against the raw request body and enforce idempotency.
- Use short-lived presigned S3 URLs, MIME/size allowlists, generated object keys and malware scanning before public delivery.
- Apply request validation, output shaping, rate limits, structured redacted logs and audit events.

## Deployment boundaries

Deploy `apps/web` and `apps/api` independently. MongoDB, Redis and Elasticsearch should be managed services or private network services; do not expose them publicly. Configure CORS with the exact production web origin. Production secrets belong in the deployment secret manager, not `.env` or Git.
