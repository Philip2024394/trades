# Batch 001 — Report (2026-08-13)

## Numbers

| Metric | Value |
|---|---|
| Verified seeds imported | **4** |
| Verified public emails | 2 (Transform Staircases · Renovate Your Staircase) |
| Emails visible on site but not extractable | 1 (Stairfurb — email present in footer, WebFetch redacted) |
| No public email found | 1 (Stair Part Replacement — Birmingham) |
| Verified phone numbers | 4 / 4 |
| Websites | 4 / 4 |
| Google ratings | 0 (WebFetch could not verify GBP data) |
| Qualification A+ | 4 |
| Qualification A / B / C / excluded | 0 |
| Unclaimed (lifecycle_status) | 4 |

## Geographic coverage (Batch 001)

| Region | Companies |
|---|---|
| North West England | 2 (Wigan · Bury) |
| West Midlands | 1 (Birmingham + 30-mile radius) |
| UK-wide / trade supply | 1 (Stairfurb) |

England-only in this batch. Scotland · Wales · Northern Ireland not covered yet.

## WebFetch reliability during this session

Out of ~12 URLs attempted:
- **4 succeeded** (companies listed above)
- **6 ECONNREFUSED** (Abbott-Wade × 2 URLs, Modernise-Yourstairs, Stairs Direct UK, Nustair, Design My Stairs)
- **1 SSL cert expired** (Hawthorn Joinery)
- **1 425 Too Early** (Hughes Joinery)
- **1 TLS cert alt-name mismatch** (Design My Stairs)

WebFetch is not reliable enough in this environment for volume research. Options
for reaching the 250-target:

1. Retry the failed URLs in a subsequent session (some may just have been flaky).
2. Philip supplies rows in a CSV / JSON that a batch importer converts to seeds.
3. Integrate a Google Places API + billing key for programmatic discovery.

## Files written this session

| Path | Purpose |
|---|---|
| `src/lib/nex/centre-publishing/directorySeedLoader.ts` | Extended `DirectorySeed` type with `capabilities` / `refacing_evidence` / `refacing_qualification` / `email_source` / `email_verified` / `email_checked_at` / `lifecycle_status` — additive, no breaking changes |
| `data/directory-seeds/_schema.json` | Added refacing fields to JSON schema · added `refacing_discovery` to `source` enum |
| `src/lib/nex/centre-publishing/categories.ts` | New · `CATEGORY_STAIRCASE_REFACING` constant + `REFACING_CAPABILITY_LABELS` map |
| `src/app/nex-app/refacing/companies/page.tsx` | Replaced placeholder with Suspense wrapper + `CompaniesClient` |
| `src/app/nex-app/refacing/companies/client.tsx` | New · fetches `/api/nex/centre/feed?category=Staircase Refacing` · renders Trade-Centre-style cards with Unclaimed badge + Claim CTA |
| `data/directory-seeds/_refacing/README.md` | Folder docs · schema · verification rules · qualification tiers |
| `data/directory-seeds/_refacing/transform-staircases-wigan.json` | A+ · full contact |
| `data/directory-seeds/_refacing/renovate-your-staircase-bury.json` | A+ · full contact |
| `data/directory-seeds/_refacing/stair-part-replacement-birmingham.json` | A+ · phone only, no email |
| `data/directory-seeds/_refacing/stairfurb-uk.json` | A+ · phone + address gap · email visible on site but redacted by fetcher |
| `data/directory-seeds/_refacing/BATCH-001-REPORT.md` | This file |

## What is NOT done (deferred per plan)

- **D — Search/filter/sort** on the companies page (postcode / capability chips / nearest + fair rotation). Deferred until the data foundation is larger and the rotation policy is defined.
- **F — Admin editor** at `/admin/(authed)/refacing-trades/`. Deferred until Batch 001 is proven working and the final field shape stabilises.

## What is NOT done (needs shared infrastructure)

- **Claim endpoint** at `/nex-app/claim?listing_id=<slug>` is referenced by the CTA but does not exist yet. Per Philip's clarification (2026-08-13) the refacing trades must reuse the SHARED claim flow — I did not build a parallel one. The CTA path is a placeholder for that endpoint. When the shared claim endpoint ships, no changes are needed to these seeds or the companies page.
- **Shared paid membership funnel** (tiers · Stripe · activation) — reused from the existing `src/lib/tierCatalog.ts` etc. Nothing refacing-specific added.

## Verification of the final state

- `/nex-app/refacing/companies` renders the 4 verified companies with correct city, phone, website, services, and Unclaimed badge.
- `/api/nex/centre/feed?category=Staircase+Refacing&limit=10` returns the 4 seeds with `category_path: ["Staircase Refacing"]` and `merchant_verification_level: "listed"`.
- No duplicate business/merchant records were created.
- No fabricated emails, ratings, phones, or addresses.
- Existing directory seeds (kitchen · staircase manufacturer) are unaffected — schema changes are additive.

## Next batches — recommended cadence

- **Batch 002 (target 10-20)** — Retry the failed URLs from this session + expand to Scotland / Wales / Northern Ireland candidates.
- **Batch 003 (target 25-40)** — First real geographic sweep · one region at a time (e.g. Greater Manchester → West Midlands → Yorkshire).
- Once 50+ verified seeds are in, revisit deferred D (search/filter) and F (admin editor).

Never claim UK-wide coverage until the research has actually been performed.
