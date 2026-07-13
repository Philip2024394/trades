# Architecture Decision Records (ADRs)

Every meaningful architectural choice captured as a small immutable document. Read this folder before questioning a pattern — the reasoning is here.

## Rules

1. **Sequential numbering.** ADR-0001, ADR-0002, ... never reused, never renumbered.
2. **Immutable once merged.** If a decision changes, write a new ADR that supersedes the old one. Don't edit history.
3. **Each ADR is small.** One page max. Structure: Context / Decision / Consequences / Alternatives considered.
4. **File naming.** `{4-digit-number}-{kebab-case-title}.md`.

## Template

```markdown
# ADR-XXXX: {Short title}

Status: {Accepted | Superseded by ADR-YYYY | Deprecated}
Date: YYYY-MM-DD

## Context
What situation forced the decision? What constraints existed?

## Decision
What did we decide? One clear sentence, then any elaboration.

## Consequences
- Positive: what got easier
- Negative: what got harder
- Neutral: what changed but isn't better or worse

## Alternatives considered
- Alternative A — why not
- Alternative B — why not
```

## Index

- [ADR-0001 — Manifest-first apps](./0001-manifest-first-apps.md)
- [ADR-0002 — Single domain: thenetworkers.app](./0002-single-domain-thenetworkers.md)
- [ADR-0003 — Never sell leads](./0003-never-sell-leads.md)
- [ADR-0004 — 30-day free-tier slug expiry policy](./0004-free-slug-expiry-policy.md)
- [ADR-0005 — Non-destructive canteen restore](./0005-non-destructive-canteen-restore.md)
- [ADR-0006 — Vehicle metaphor for pricing tiers](./0006-vehicle-metaphor-pricing.md)
- [ADR-0007 — No editorial image rules](./0007-no-editorial-image-rules.md)
- [ADR-0008 — Per-product surface flags](./0008-per-product-surface-flags.md)
- [ADR-0009 — eBay-parity fields + category-driven Item Specifics](./0009-ebay-parity-category-aspects.md)
- [ADR-0010 — Every paid feature clears Stripe margin, both directions](./0010-stripe-margin-safe-pricing.md)
- [ADR-0011 — Per-variant SKU / photo / price via override map](./0011-per-variant-overrides.md)
- [ADR-0012 — Consumer-side variant picker (shared, mobile-first)](./0012-consumer-variant-picker.md)
- [ADR-0013 — Object-contain everywhere + optional pre-upload pan/zoom crop editor](./0013-object-contain-and-crop-editor.md)
</parameter>
