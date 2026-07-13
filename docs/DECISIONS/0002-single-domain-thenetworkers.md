# ADR-0002: Single domain — thenetworkers.app

Status: Accepted
Date: 2026-07-13

## Context

The platform accumulated multiple brand domains during iteration — `xratedtrade.com`, `hammerexdirect.com`, `theconstructionnotebook.com`, plus a dual-tier URL scheme where paid merchants got the "premium" domain and free-tier merchants were demoted to a secondary domain. Merchants found the tier boundary confusing and the multiple domains fragmented brand recognition. The domain `thenetworkers.app` was purchased 2026-07-13 to consolidate.

## Decision

Every merchant lives on `thenetworkers.app/{slug}` regardless of tier. Tier distinction is a visible "Free" badge on the profile plus hidden paid-only widgets — never a URL demotion to a secondary domain. Every previously-used brand domain (`xratedtrade.com`, `hammerexdirect.com`, `theconstructionnotebook.com`, `xratedtrade.vercel.app`, `thenetwork.uk`) is stripped from the codebase, replaced with `thenetworkers.app`, and DNS-redirected to the single canonical domain.

## Consequences

- **Positive:** One brand, one URL, one story for merchants. Marketing materials, van vinyl, business cards all point at the same place across all tiers.
- **Positive:** Simpler middleware — subdomain routing collapses to `SUBDOMAIN_ROOTS = ["thenetworkers.app"]`.
- **Positive:** Slug ownership survives tier changes without URL migration.
- **Negative:** Merchants who upgrade lose the "URL upgrade" psychological reward. Compensated with the Verified badge on Ultimate.
- **Neutral:** Old brand domains still resolve via 301 redirects to `thenetworkers.app`.

## Alternatives considered

- **Keep dual-domain paid/free model** — rejected. Merchants found "your URL changes when you cancel" hostile.
- **Add subdomain prefix for free tier** (`free.thenetworkers.app/{slug}`) — rejected. Same psychological problem in a different wrapper; also would break QR codes and van vinyls when a merchant upgrades.
- **Buy `thenetwork.com`** ($100K+ aftermarket) — rejected as prohibitively expensive; `thenetworkers.app` reads well and enforces HTTPS by TLD.
</parameter>
