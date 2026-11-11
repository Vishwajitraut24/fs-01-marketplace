# FS-01 - Database Design

## 1. Database Overview

FS-01 uses MongoDB as its primary persistent database.

Mongoose provides schema definitions, model operations and database interaction.

The database stores customer accounts, vendor information, products, carts, orders and payment-related information.

MongoDB transactions are used for important commerce operations that require multiple database changes to succeed together.

## 2. Main Data Entities

| Entity | Purpose | Important relationships |
|---|---|---|
| Users | Customer and administrative user accounts | Authentication, user roles and account information |
| Vendors | Vendor applications and store information | Vendor ownership and approval status |
| Products | Marketplace product catalog and inventory | Vendor ownership and product information |
| Carts | Customer shopping cart information | Associated customer and cart items |
| Orders | Customer-facing parent orders | Customer, seller orders, payment information |
| Seller Orders | Vendor-specific portions of customer orders | Embedded within the parent order |
| Razorpay Webhook Events | Records of processed payment webhook events | Razorpay event identifiers and processing information |

The table describes the logical application entities. Actual MongoDB collection names are determined by the Mongoose model definitions.

## 3. Entity Relationships

### Users and Vendors

A user can be associated with a vendor application.

Vendor records maintain the information required for vendor onboarding, approval and marketplace operations.

Vendor approval controls whether the vendor's products are eligible for public marketplace visibility.

### Vendors and Products

A vendor can manage multiple products.

Each product is associated with its vendor.

Product information includes the details required for catalog discovery, pricing and inventory management.

Only active products from approved vendors should appear in the public catalog.

### Users and Carts

Customer cart information is associated with the customer.

Cart operations support adding, updating and removing products before checkout.

### Orders and Seller Orders

A customer-facing parent order can contain multiple seller-specific order sections.

Seller-specific order information is maintained within the parent order structure.

This allows different vendors to manage their respective order items and fulfillment operations.

### Orders and Payments

Order records maintain payment information, including the payment method, payment state and provider references.

Razorpay payment identifiers are associated with the corresponding marketplace order.

### Razorpay Webhook Events

Webhook event records provide an idempotency mechanism for payment-event processing.

Previously processed event identifiers are protected against duplicate processing.

## 4. Product Data and Search Index

MongoDB is the authoritative source for product information.

Elasticsearch maintains derived product-search documents.

Product search synchronization is performed when relevant product or vendor lifecycle operations occur, including:
- Product creation.
- Product updates.
- Product archival.
- Vendor approval.
- Inventory changes after checkout or eligible cancellation.

The search index can be rebuilt from eligible MongoDB product records.

Elasticsearch is not the authoritative storage for product information.

## 5. Order State and Payment State

Order status and payment status are treated as separate concepts.

### Order State

The implementation includes states such as:

- `PENDING_PAYMENT`
- `PLACED`
- `CANCELLED`

The complete set of valid states is determined by the order model and service-level transition rules.

### Payment State

Payment processing includes states such as:

- `PENDING`
- `AUTHORIZED`
- `PAID`
- `FAILED`

The payment state is updated through validated payment operations and verified Razorpay events.

### Seller Fulfillment State

Seller-specific fulfillment information is maintained separately from the customer's payment state.

This allows vendors to manage order fulfillment independently.

Clients should not be allowed to directly modify protected payment or fulfillment state fields.

## 6. Inventory Management

Inventory is maintained against product records.

Important inventory rules:

- Inventory must not become negative.
- Checkout validates product availability.
- Order creation and inventory reservation are performed using database transactions.
- Eligible unpaid-order cancellation restores reserved inventory.
- Search documents are synchronized after relevant inventory changes.

Inventory restoration must be protected against duplicate execution.

## 7. Payment Data Consistency

Razorpay payment processing uses provider order identifiers and payment identifiers.

The implementation validates:
- Marketplace order ownership.
- Payment method.
- Expected payment amount.
- Currency.
- Razorpay order reference.
- Payment signature.
- Captured payment status.

Webhook events are signature-verified and processed with duplicate-event protection.

A payment failure does not automatically imply that inventory should be restored immediately, because the customer may be allowed to retry the payment.

## 8. Transaction and Consistency Requirements

MongoDB transactions are important for operations that affect multiple records.

Examples include:

- Checkout and inventory reservation.
- Payment-state updates.
- Eligible unpaid-order cancellation.
- Inventory restoration.

Operations that update the database and Elasticsearch must account for the possibility that search synchronization can fail independently of a committed MongoDB transaction.

MongoDB remains the source of truth in these cases.

## 9. Additional Database Features - Future Scope

The following capabilities are potential future additions and should not be considered confirmed parts of the current implementation:

- Immutable payment and commission ledger.
- Automated vendor payout and transfer records.
- Product reviews and ratings.
- Coupon and promotional management.
- Dedicated audit-log collection.
- Advanced financial reporting.

These features can be added as the marketplace evolves.

## 10. Database Design Principles

The database design follows these principles:

1. MongoDB is the source of truth for persistent marketplace data.
2. Mongoose validates and manages application models.
3. Parent orders maintain seller-specific order information.
4. Payment and fulfillment states remain separate.
5. Checkout and inventory operations use transactions where required.
6. Payment webhook processing must be idempotent.
7. Product search data is derived from MongoDB.
8. Sensitive payment and authentication information must be protected.
9. Inventory and payment updates must preserve data consistency.