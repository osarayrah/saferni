---
name: Payment architecture
description: Durable decision about Safferni payment processing and supplier settlement.
---

Safferni does not use Stripe or another in-app payment processor. Hotel supplier fulfillment uses LiteAPI's account-wallet method; flight booking remains blocked until LiteAPI confirms a supported payment entitlement.

**Why:** The user explicitly requested complete Stripe removal, and the existing Stripe Checkout flow was unavailable in the intended deployment.

**How to apply:** Do not reintroduce Stripe dependencies, secrets, webhooks, checkout sessions, payment-intent fields, or payment-gated booking states without explicit user approval.