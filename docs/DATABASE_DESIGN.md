# FS-01 Database Design (initial plan)

MongoDB is the source of truth. The following collections are planned; schemas and indexes will be implemented and tested in Step 2.

| Collection | Purpose | Important relationships / constraints |
|---|---|---|
| users | Customer, vendor-user and admin identities | Unique normalized email; role and account status; password hash only |
| vendorProfiles | Seller/store profile and onboarding | Unique owner; approval state; provider linked-account reference |
| categories | Hierarchical catalog taxonomy | Optional parent category; slug unique |
| products | Catalog and inventory | Vendor owner; category references; price in paise; status; SKU unique per vendor |
| carts | Durable cart snapshot if needed across devices | Unique customer; Redis is the fast cart cache |
| orders | Customer-facing parent order | Customer; total in paise; payment state; idempotency reference |
| vendorOrders | Vendor-specific fulfilment orders | Parent order + vendor; isolated line items and fulfilment state |
| transactions | Payment, transfer, refund and fee ledger | Provider IDs unique; immutable append-only movement records |
| reviews | Verified-purchase reviews | Product/customer; one review per eligible purchase line |
| coupons | Promotions and redemption limits | Code unique; validity window; eligibility and usage constraints |
| auditLogs | Sensitive administrative and commerce events | Actor, action, target, timestamp, minimal redacted metadata |

## Order state model

Payment state and fulfilment state are separate. Example payment states: `pending`, `authorized`, `paid`, `partially_refunded`, `refunded`, `failed`. Vendor fulfilment states: `pending`, `accepted`, `packed`, `shipped`, `delivered`, `cancelled`, `returned`. State changes must go through explicit transition functions; clients cannot write status fields directly.

## Money and inventory invariants

- All monetary amounts are integer paise with an explicit currency code (initially INR).
- Product price is snapshotted into order line items at checkout.
- Available quantity cannot become negative. Inventory reservation and order creation are atomic.
- Commission, vendor payable, gateway fees, refunds and transfers are represented as explicit ledger entries.
- Webhook event IDs and provider payment/transfer IDs have unique indexes for idempotency.
