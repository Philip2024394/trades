# NEX UK Staircase Refacing Trades — Seed Directory

**Created:** 2026-08-13
**Owner:** Philip
**Category:** `Staircase Refacing` (canonical · see `src/lib/nex/centre-publishing/categories.ts`)
**Schema:** `../\_schema.json` (extended 2026-08-13 with refacing-specific fields)

## Purpose

Seeds in this folder are UK businesses that genuinely offer work on **existing
staircases** — refacing, refurbishment, covering, cladding, tread/riser
replacement, balustrade upgrades, restoration, or similar.

These records **plug into the existing NEX Trade Center system**:

```
discovered → unclaimed listing → claim (existing shared endpoint)
           → membership offer (existing tiers) → payment (existing Stripe)
           → merchant/member account (attached, not duplicated) → paid trade member
```

**Do NOT** build a parallel membership/payment/claim system for refacing — this
is an acquisition channel INTO the existing infrastructure (Philip 2026-08-13).

## Filename convention

`<slug>-<town>.json` where `<slug>` is the kebab-case business name.
Example: `abbott-wade-macclesfield.json`

## Required fields (per `_schema.json`)

- `id` (UUID v4), `slug`, `business_name`
- `status: "listed"`, `claimed: false`, `verified: false`, `visibility: "public"`
- `photos: []`, `cover_image: null` (per ADR-0022 · no third-party image copy)
- `source: "refacing_discovery"` (identifies the acquisition channel)
- `imported_at` (ISO date-time)

## Refacing-specific fields (all optional, additive)

- `category: "Staircase Refacing"` (parent category)
- `capabilities`: `{ staircase_refacing: "yes" | "no" | "unknown", ... }` — see
  `RefacingCapabilityKey` in `src/lib/nex/centre-publishing/directorySeedLoader.ts`
- `refacing_evidence`: `[{ url, type, category, summary, checked_at }]` — at least
  one required for A+ / A qualifications
- `refacing_qualification`: `"A+" | "A" | "B" | "C" | "excluded"`
- `email_source`, `email_verified`, `email_checked_at`
- `lifecycle_status: "unclaimed"` (default · flipped only by shared claim flow)

## Verification rules (NEX Constitution)

- **Rule A — Silence over fabrication.** Never invent email, phone, rating,
  address, services or review counts. If not verifiable, set the field to `null`.
- **Rule B — Trust over completeness.** 10 verified companies beat 100 with
  questionable data.
- **Rule C — Reality over speculation.** A staircase manufacturer is not a
  refacing specialist just because it sells stairs. Evidence required.

## Qualification tiers (refacing_qualification)

| Tier | Meaning |
|------|---------|
| **A+** | Explicit existing-staircase refacing / refurbishment / covering / cladding. |
| **A** | Strong existing-staircase renovation evidence. |
| **B** | Possible refacing trade · needs additional verification. |
| **C** | Primarily new staircase manufacture / install. |
| **excluded** | Does not qualify. |

## Directory state (Refacing Trade Exchange progression)

Every seed carries a `directory_state` field with one of four progressive
values. Forward-only · never downgrade without an audit entry in
`refacing_evidence[]`.

| State | Meaning | Set by |
|---|---|---|
| **listed** | Discovered / imported · basic info stored · NOT independently verified beyond initial pass | Discovery pipeline (default) |
| **verified** | NEX has independently verified the directory info (contact accuracy · evidence of refacing work · currently operating) · still unclaimed | Manual admin verification |
| **claimed** | Business owner has claimed the listing via the shared claim flow | Shared claim endpoint |
| **paid_member** | Active paying NEX Trade Center member · **eligible to receive routed homeowner opportunities** from the Refacing Trade Exchange | Shared membership activation |

**Routing rule:** homeowner opportunities are only routed to seeds where
`directory_state === "paid_member"` AND `refacing_qualification ∈ {A+, A}`.
Enforced by `isEligibleForRefacingRouting()` in `directorySeedLoader.ts`.

**Distinct from the `verified` boolean:** the existing `verified: boolean`
field is the verified BADGE on the merchant card, earned only via the claim
workflow. NEX internal directory verification (`directory_state === "verified"`)
does NOT flip the `verified` badge — that stays honest to the customer until
the owner claims and passes verification.

## Email discovery

Only accept **publicly published business emails** (info@ · enquiries@ · sales@
· office@ · contact@). **Never infer** `info@domain.com` from a website domain.
Record `email_source` (e.g. `"company_website"`) and `email_checked_at`.

## Batch numbering

- **Batch 001** (2026-08-13) — Philip's initial verified candidate list.
- Future batches append new files · never mutate old ones without an audit
  entry in the `refacing_evidence[]` array.

## Public listing

Every unclaimed seed here appears on `/nex-app/refacing/companies` via the
existing `/api/nex/centre/feed?category=Staircase Refacing` endpoint. The
"Claim this business" CTA routes to the existing shared claim endpoint
(canonical path `/nex-app/claim?listing_id=<slug>`).
