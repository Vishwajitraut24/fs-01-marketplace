# FS-01 - System Architecture

## 1. Architecture Overview

FS-01 is a full-stack, multi-vendor e-commerce marketplace implemented as a TypeScript monorepo.

The system follows a modular monolithic backend architecture. The frontend and backend are maintained as separate workspaces and can be deployed independently.

The architecture separates presentation, application logic, data persistence, infrastructure integrations and external payment services.

## 2. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, TypeScript |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js, TypeScript |
| Database | MongoDB, Mongoose |
| Caching / Infrastructure | Redis |
| Product Search | Elasticsearch |
| Payment Gateway | Razorpay |
| Validation | Zod |
| Containerization | Docker, Docker Compose |
| Version Control | Git, GitHub |

## 3. Runtime Components

### Frontend

Location: `apps/web`

Responsibilities:
- Customer storefront and product discovery.
- Customer registration and login.
- Shopping cart and checkout interface.
- Customer order history.
- Vendor dashboard and product management.
- Administrative vendor management.

The frontend communicates with the backend through REST API endpoints.

### Backend API

Location: `apps/api`

Responsibilities:
- Authentication and authorization.
- Customer and vendor operations.
- Product and inventory management.
- Catalog search and filtering.
- Shopping cart operations.
- Checkout and order creation.
- Payment order creation and verification.
- Razorpay webhook processing.
- Vendor order fulfillment.
- Scheduled unpaid-order cleanup.

The backend is organized around routes, middleware, services, models and infrastructure integrations.

### MongoDB

MongoDB is the primary persistent database.

It stores application data such as:
- User accounts.
- Vendor profiles.
- Product information.
- Cart information.
- Customer orders.
- Seller-specific order information.
- Payment references and order status.
- Razorpay webhook event records.

MongoDB replica-set configuration supports transaction-based checkout and inventory operations.

### Redis

Redis is included in the application infrastructure and provides support for transient application data and caching.

MongoDB remains the durable source of truth for customer orders and product records.

### Elasticsearch

Elasticsearch provides product search functionality.

MongoDB remains the authoritative product database. Elasticsearch stores derived search documents that can be synchronized or rebuilt from eligible MongoDB product records.

Product search supports:
- Product-name matching.
- Brand matching.
- Category matching.
- Description matching.
- Fuzzy matching.

Only eligible active products from approved vendors are included in public search results.

### Razorpay

The payment integration supports Razorpay Test Mode.

Implemented payment operations include:
- Payment order creation.
- Razorpay order reference storage.
- Payment signature verification.
- Payment verification with Razorpay.
- Payment capture handling.
- Webhook signature verification.
- Webhook event processing and duplicate-event protection.

Live marketplace settlements and automated vendor payouts require additional gateway configuration and implementation.

## 4. Core Marketplace Workflows

### Customer Authentication

1. Customer submits registration details.
2. Backend validates the request.
3. Password is securely hashed.
4. Customer account is stored in MongoDB.
5. Authentication tokens are generated.
6. Customer can access protected application functionality.

### Vendor Onboarding

1. Vendor submits an application.
2. Backend validates vendor information.
3. Application is stored in MongoDB.
4. Administrator reviews the application.
5. Approved vendors can access vendor functionality.
6. Vendor products become eligible for public catalog visibility when active.

### Product Management and Search

1. Vendor creates or updates a product.
2. Product information is stored in MongoDB.
3. Product lifecycle changes trigger Elasticsearch synchronization.
4. Vendor approval controls product search visibility.
5. Customers discover eligible products through the catalog API.

### Shopping Cart and Checkout

1. Customer adds products to the cart.
2. Backend validates product availability and pricing.
3. Checkout creates the parent order and seller-specific order information.
4. Inventory is reserved through database operations.
5. Order begins in the appropriate payment-pending state.
6. Customer completes the selected payment method.

### Payment Processing

1. Backend creates a Razorpay payment order.
2. Razorpay order reference is associated with the marketplace order.
3. Customer completes the payment flow.
4. Backend verifies the payment signature.
5. Payment details are checked with Razorpay.
6. Successful payment updates the marketplace order.
7. Webhooks provide an additional verified payment-event processing mechanism.

A browser redirect alone is not considered proof of successful payment.

### Vendor Order Fulfillment

1. Vendor views eligible seller orders.
2. Vendor updates fulfillment information.
3. Backend validates the operation.
4. Order information is updated in MongoDB.

### Unpaid Order Expiry

The backend periodically checks eligible unpaid Razorpay orders.

For qualifying orders that never received a Razorpay gateway order ID:
1. The order is checked again inside a MongoDB transaction.
2. Reserved inventory is restored.
3. The order is marked cancelled.
4. Payment and seller fulfillment statuses are updated.
5. Product search documents are synchronized.

Orders already linked to a Razorpay gateway order are excluded from this cleanup process to avoid unsafe inventory restoration while payment status may still be unresolved.

## 5. Data Flow

```text
Customer / Vendor / Admin
          |
          v
    React Frontend
          |
          v
     Express REST API
          |
          v
    Application Services
          |
    +-----+--------+----------+
    |              |          |
    v              v          v
 MongoDB          Redis   Elasticsearch
    |
    v
 Razorpay Payment Integration
    |
    v
 Payment Verification / Webhooks
```

MongoDB is the primary data source. Redis supports transient infrastructure needs, while Elasticsearch provides derived product-search functionality.

## 6. Security Boundaries

- Validate incoming API requests.
- Protect sensitive operations with authentication and authorization.
- Apply role and resource-ownership checks.
- Hash user passwords before storage.
- Keep payment secrets and database credentials on the backend.
- Verify Razorpay payment signatures.
- Verify webhook signatures against the original request body.
- Protect webhook processing against duplicate events.
- Keep `.env` files out of version control.
- Use HTTPS and secured infrastructure in production.
- Avoid publicly exposing MongoDB, Redis and Elasticsearch.
- Use restricted production credentials and appropriate network access controls.

## 7. Deployment Architecture

The frontend and backend are maintained as independent applications.

The infrastructure directory contains Docker Compose configuration for local development services.

Production deployment requires:
- Production environment variables.
- Secure MongoDB deployment.
- Secure Redis deployment.
- Protected Elasticsearch deployment.
- HTTPS and correct CORS configuration.
- Production Razorpay credentials and webhook configuration.
- Logging, monitoring and database backup procedures.

Provider-specific production deployment configuration has not been established as part of the current local development milestone.

## 8. Future Enhancements

Potential future capabilities include:
- Automated vendor settlements and payouts.
- Commission and transaction ledger.
- S3-compatible product image storage.
- Product reviews and ratings.
- Coupon and promotional management.
- Advanced analytics and reporting.
- Production deployment and monitoring.

These capabilities should be treated as future enhancements unless separately implemented and tested.