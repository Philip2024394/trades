# UK Staircase Trade Market · Stage 5A · Master Dataset (DRY-RUN)

_311 master records built · consolidated from 311 Stage 4 records + 223 existing seeds · DRY-RUN · no Supabase writes · Stage 5B blocked pending review · 2026-08-15_

## Tier split

| Tier | Count | Notes |
|---|---:|---|
| **production_ready.json** | **211** | A + B band · non-duplicate · ready to INSERT |
| **merge_pending.json** | **16** | Cross-source duplicates · MERGE-preview per record · needs human decision |
| **manual_review_queue.json** | **84** | SEARCH_DISCOVERED / DIRECTLY_REACHABLE only · preserved for review · NOT auto-imported |

## Two-dimension schema (Philip 2026-08-15)

Every master record carries TWO independent classification fields:

### 1. business_type (single value)

| business_type | Count |
|---|---:|
| MULTI_SERVICE_COMPANY | 134 |
| STAIRCASE_MANUFACTURER | 126 |
| REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER | 32 |
| REFURBISHMENT_SERVICE_SPECIALIST | 10 |
| REFACING_SERVICE_SPECIALIST | 5 |
| STAIRCASE_INSTALLER | 4 |

### 2. capabilities (multi-flag · "yes" count per capability)

| capability | Count with "yes" |
|---|---:|
| bespoke | 288 |
| manufacture | 282 |
| design | 277 |
| installation | 246 |
| balustrade | 182 |
| refurbishment | 171 |
| handrail | 156 |
| metal | 137 |
| glass | 136 |
| refacing | 45 |
| kit_or_product_supplier | 44 |

## Language discipline (Philip's "verified" caution)

Internal states are precise engineering labels. Customer-facing labels are softer until the company opts in.

| Internal state | Count | Customer-facing label |
|---|---:|---|
| FULLY_VERIFIED | 205 | Business information checked |
| SEARCH_DISCOVERED | 89 | _(no badge)_ |
| SERVICE_EVIDENCED | 16 | Business information partially checked |
| DIRECTLY_REACHABLE | 1 | _(no badge)_ |

> `verified: true` is set to `false` for every record in this tier. `verified` is reserved for CLAIMED+ companies — never applied to a company that hasn't opted into NEX.

## Stage 5B · Import plan preview

| Action | Count |
|---|---:|
| INSERT (new records to Supabase directory_seeds) | 211 |
| MERGE (into existing legacy/refacing seeds) | 16 |
| DEFERRED (preserved in review queue · not imported) | 84 |

### First 10 INSERT preview

| Business | business_type | Category | Caps=yes | Cust-label |
|---|---|---|---:|---|
| Darcy Joinery Ltd | `STAIRCASE_MANUFACTURER` | Staircase Manufacturer | 6 | Business information checked |
| Modernise Your Stairs | `MULTI_SERVICE_COMPANY` | Multi-Service Staircase Company | 9 | Business information checked |
| Alpine Stairs | `STAIRCASE_MANUFACTURER` | Staircase Manufacturer | 6 | Business information checked |
| Edwards & Hampson Ltd | `MULTI_SERVICE_COMPANY` | Multi-Service Staircase Company | 8 | Business information checked |
| Tailor Made Stairs and Storage Solutions | `MULTI_SERVICE_COMPANY` | Multi-Service Staircase Company | 9 | Business information checked |
| Greenbank Joinery | `STAIRCASE_INSTALLER` | Staircase Installer | 2 | Business information partially checked |
| Northwest Staircases Ltd | `MULTI_SERVICE_COMPANY` | Multi-Service Staircase Company | 7 | Business information checked |
| A.D. Stairs Ltd | `STAIRCASE_MANUFACTURER` | Staircase Manufacturer | 5 | Business information checked |
| Northern Joinery Ltd | `STAIRCASE_MANUFACTURER` | Staircase Manufacturer | 5 | Business information checked |
| Ash Timber (Manchester) | `MULTI_SERVICE_COMPANY` | Multi-Service Staircase Company | 5 | Business information checked |

### All 16 MERGE previews (full detail)

| Existing source | Incoming | Match | Existing qual → Merged | Existing evid → Merged evid | Merged caps=yes |
|---|---|---|---|---|---:|
| `_refacing/transform-staircases-wigan.json` | Transform Staircases | domain | A+ → A+ | 1 → 3 | 15 |
| `warrington/abbott-wade-staircases-warrington.json` | Abbott-Wade | domain | — → — | 0 → 4 | 10 |
| `stockport/the-stair-shop-stockport.json` | The Stair Shop Ltd | postcode+name | — → — | 0 → 3 | 9 |
| `woodmansey/tkstairs-woodmansey.json` | TK Stairs | domain | — → — | 0 → 3 | 7 |
| `sheffield/south-yorkshire-joinery-ltd-sheffield.json` | South Yorkshire Joinery | postcode+name | — → — | 0 → 1 | 3 |
| `basildon/uk-stairparts-ltd-basildon.json` | UK Stair Parts | domain | — → — | 0 → 1 | 5 |
| `_refacing/stairfurb-uk.json` | StairFurb (Homespace Installations Ltd) | domain | A+ → A+ | 1 → 5 | 15 |
| `stoke-on-trent/stairbox-stoke-on-trent.json` | StairBox | domain | — → — | 0 → 4 | 10 |
| `wickford/mrstairs-wickford.json` | MrStairs | fuzzy-name | — → — | 0 → 1 | 6 |
| `harlow/timber-staircases-harlow.json` | Timber Staircases (Kent) | domain | — → — | 0 → 1 | 2 |
| `london/craft-bespoke-staircase-joinery-london.json` | Staircase Joinery Ltd | fuzzy-name | — → — | 0 → 1 | 5 |
| `bromsgrove/a-and-t-stairs-ltd-bromsgrove.json` | A & T Stairs (A & T Carpentry) | fuzzy-name | — → — | 0 → 2 | 9 |
| `london/higginson-staircases-ltd-london.json` | Higginson Staircases Ltd (E A Higginson & Company Ltd) | postcode+name | — → — | 0 → 1 | 6 |
| `_refacing/renovate-your-staircase-bury.json` | Renovate Your Staircase | domain | A+ → A+ | 1 → 2 | 18 |
| `_refacing/design-my-stairs-wirral.json` | Design My Stairs | domain | A+ → A+ | 1 → 2 | 17 |
| `stoke-on-trent/first-step-designs-stoke-on-trent.json` | First Step Designs | domain | — → — | 0 → 1 | 9 |

## Merge policy (existing wins · never overwrite stronger with weaker)

- Canonical fields (name, phone, email, address, postcode, website) — existing value never overwritten; only backfilled where existing is null
- Capabilities — existing "yes" never downgraded; incoming "yes" adds; "unknown" backfilled where existing is undefined
- Evidence items — appended + deduped by (url, category); both sources' evidence preserved
- Qualification band — upgrade-only (A+ > A > B > C > D > excluded)
- Tags — union of both sets
- Provenance — merge_history array records every merge event

## Quality bands

| Band | Count |
|---|---:|
| A | 205 |
| null | 89 |
| B | 16 |
| C | 1 |

## Geographic distribution

| Region | Count |
|---|---:|
| NW | 39 |
| Scotland | 38 |
| NI | 33 |
| Yorkshire | 32 |
| Wales | 31 |
| W Mids | 29 |
| SW | 24 |
| E | 23 |
| SE | 23 |
| London | 17 |
| E Mids | 13 |
| NE | 8 |

## What Stage 5A did NOT do

- Did not write to Supabase directory_seeds table
- Did not run any HTTP requests (all consolidation from cached Stage 4 fetch results)
- Did not contact any company
- Did not delete or downgrade any Stage 4 record
- Did not overwrite any existing seed field with a weaker value
- Did not set `verified: true` on any unclaimed record
- Did not touch NEX brain / M4 freeze
- Did not start Stage 5B · blocked pending Philip's review of this dry-run

## Files produced

- `production_ready.json` — 211 records ready to INSERT
- `merge_pending.json` — 16 MERGE previews for review
- `manual_review_queue.json` — 84 records preserved for human review
- `stage5b-import-plan.json` — full Supabase import plan preview
- `STAGE-5A-REPORT-2026-08-15.md` — this report

## Ask · Stage 5B approval

On approval, Stage 5B will:

1. Backup existing Supabase directory_seeds (per migration-verification-protocol step 1)
2. INSERT 211 new records (business_type + capabilities + customer_facing_label + full evidence trail)
3. MERGE 16 incoming records into their matched existing seeds (existing wins · evidence appended · never overwrite stronger with weaker)
4. Leave 84 records in `manual_review_queue.json` (never imported)
5. Emit post-import audit: row counts before/after + exceptions list
6. Never contact any company
7. Never set `verified: true` on any unclaimed record