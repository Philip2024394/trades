# ADR-0003: Never sell leads

Status: Accepted
Date: 2026-07-13

## Context

Every UK trades platform (Checkatrade, MyBuilder, Rated People, Bark, TrustaTrader) monetises by selling leads to merchants — either per-lead fees, per-shortlist fees, or subscription tiers that gate access to leads. Merchants universally complain about the model: they pay for leads that don't convert, they're forced to bid against each other, and platforms have no incentive to send them fewer better-fit leads over more low-fit ones.

## Decision

Thenetworkers never sells leads and never takes a commission on merchant sales. Instead:
- Merchants pay a flat monthly / annual subscription
- When a customer submits a project through Notebook and gets matched to nearby merchants, the merchant sees the match for free and can reply via WhatsApp with no fee, no bidding, no shortlist charge
- Merchant sells → funds go direct from customer to merchant via Stripe Connect / PayPal / Coinbase. We never touch the money
- Positioning: "We give you the tools to close the leads you already have. We don't sell you leads."

## Consequences

- **Positive:** Merchants who understand the leads model instantly get why we're different. Anti-Checkatrade positioning is a strong sales lever.
- **Positive:** Zero regulated-activity exposure — we're not a payment institution, not a lead broker.
- **Positive:** Aligned incentives — we make money when merchants stay subscribed, so we optimise for merchant retention, not for churning leads through the platform.
- **Negative:** Slower initial monetisation. Lead sales are high-margin per unit; subscriptions take longer to compound.
- **Negative:** Merchants who are used to the leads model may not understand "why can't I pay for a good lead?" — needs sales education.

## Alternatives considered

- **Hybrid model** (subscription + optional lead purchases) — rejected. Dilutes the positioning and creates internal incentive conflict.
- **Take a commission on Marketplace sales** (0.5-2%) — rejected on same principle. Simpler and cleaner to price the subscription to cover our costs and take nothing on transactions.
- **Sell "priority lead access" as an upgrade** — rejected. Just another name for lead-selling.
</parameter>
