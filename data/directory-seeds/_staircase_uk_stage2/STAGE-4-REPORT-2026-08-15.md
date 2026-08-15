# UK Staircase Trade Market · Stage 4 · Full Direct-Verify + Cross-Source Dedup

_All 311 canonical Stage 2 records · direct HTTP fetched · evidence extracted from actual page content · cross-deduplicated against 223 existing seeds · 222.4s wall time · 2026-08-15_

## Headline numbers (as requested)

- **TOTAL DISCOVERED:** 311
- **DIRECTLY REACHABLE** (HTTP 2xx-3xx): 293
- **IDENTITY CONFIRMED** on page: 222
- **FULLY VERIFIED** (identity + ≥3 capabilities directly on page): 205
- **SERVICE EVIDENCED** (identity + ≥1 capability directly on page): 16
- **DIRECTLY REACHABLE only** (identity confirmed, no capability evidence): 1
- **SEARCH DISCOVERED** (fetch failed OR identity not confirmed · preserved for review): 89
- **MANUAL REVIEW queue** (SEARCH_DISCOVERED + DIRECTLY_REACHABLE_only + cross-source duplicates): 100
- **DUPLICATES vs existing seeds:** 16
- **Fetch errors:** 13
- **No URL in record:** 5

> Standing rule reminder: "**not evidenced**" ≠ "**does not provide the service**". A homepage may not mention refacing while the company still does refacing. The 4-state comparison below preserves this distinction.

## Capability direct evidence (of 311)

| Capability | Records with direct page evidence |
|---|---:|
| manufacture | 189 |
| installation | 186 |
| refurbishment | 134 |
| refacing | 23 |
| balustrade | 113 |
| handrail | 92 |
| glass | 93 |
| metal | 78 |
| kit_or_product_supplier | 44 |
| bespoke | 218 |
| design | 214 |

## Capability comparison · Stage 2 claim → Stage 4 direct evidence

> Four states per capability:
> - **CONFIRMED** — Stage 2 claimed AND Stage 4 evidence found on page
> - **NOT_CONFIRMED** — Stage 2 claimed BUT Stage 4 evidence not found on homepage (does NOT mean company doesn't do it)
> - **CONTRADICTED** — Stage 2 claimed BUT page explicitly negates the service (rare)
> - **NOT_CHECKABLE** — fetch failed OR identity did not confirm — cannot verify either way
> - **NEWLY_EVIDENCED** — Stage 2 didn't claim BUT Stage 4 evidence found on page

| Capability | CONFIRMED | NOT_CONFIRMED | CONTRADICTED | NOT_CHECKABLE | NEWLY_EVIDENCED |
|---|---:|---:|---:|---:|---:|
| manufacture | 159 | 41 | 0 | 89 | 6 |
| installation | 124 | 28 | 1 | 89 | 38 |
| refurbishment | 52 | 12 | 0 | 89 | 67 |
| refacing | 10 | 13 | 0 | 89 | 10 |
| balustrade | 69 | 36 | 0 | 89 | 27 |
| handrail | 42 | 35 | 0 | 89 | 34 |
| glass | 50 | 19 | 0 | 89 | 28 |
| metal | 47 | 33 | 0 | 89 | 19 |

## Business-group classification

| Group | Count |
|---|---:|
| MULTI_SERVICE_COMPANY | 134 |
| STAIRCASE_MANUFACTURER | 126 |
| REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER | 32 |
| REFURBISHMENT_SERVICE_SPECIALIST | 10 |
| REFACING_SERVICE_SPECIALIST | 5 |
| STAIRCASE_INSTALLER | 4 |

## Quality bands (from 4-state verification)

| Band | Verification state | Count |
|---|---|---:|
| A | FULLY_VERIFIED | 205 |
| B | SERVICE_EVIDENCED | 16 |
| C | DIRECTLY_REACHABLE (identity only) | 1 |
| D | SEARCH_DISCOVERED (not directly verified) | 89 |

## Geographic distribution

### By region

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

### By county (top 20)

| County | Count |
|---|---:|
| Greater Manchester | 14 |
| South Yorkshire | 14 |
| West Yorkshire | 13 |
| Antrim | 12 |
| Staffordshire | 9 |
| Cheshire | 8 |
| Essex | 8 |
| Down | 8 |
| Merseyside | 6 |
| Lancashire | 6 |
| Greater London | 6 |
| Hampshire | 6 |
| West Midlands | 6 |
| Somerset | 6 |
| Warwickshire | 5 |
| Shropshire | 5 |
| Kent | 5 |
| West Glamorgan | 5 |
| Armagh | 5 |
| Tyne and Wear | 4 |

## Cross-source duplicates

16 Stage 2 records matched an existing seed (from `_refacing/` or legacy town directories). Preserved in `stage4-cross-source-duplicates.json` for merge-review — never auto-deleted, never auto-merged into production.

### First 20 cross-source duplicates

| Business | Matched-by | Existing source |
|---|---|---|
| Transform Staircases | `domain` | `_refacing/transform-staircases-wigan.json` |
| Abbott-Wade | `domain` | `warrington/abbott-wade-staircases-warrington.json` |
| The Stair Shop Ltd | `postcode+name` | `stockport/the-stair-shop-stockport.json` |
| TK Stairs | `domain` | `woodmansey/tkstairs-woodmansey.json` |
| South Yorkshire Joinery | `postcode+name` | `sheffield/south-yorkshire-joinery-ltd-sheffield.json` |
| UK Stair Parts | `domain` | `basildon/uk-stairparts-ltd-basildon.json` |
| StairFurb (Homespace Installations Ltd) | `domain` | `_refacing/stairfurb-uk.json` |
| StairBox | `domain` | `stoke-on-trent/stairbox-stoke-on-trent.json` |
| MrStairs | `fuzzy-name` | `wickford/mrstairs-wickford.json` |
| Timber Staircases (Kent) | `domain` | `harlow/timber-staircases-harlow.json` |
| Staircase Joinery Ltd | `fuzzy-name` | `london/craft-bespoke-staircase-joinery-london.json` |
| A & T Stairs (A & T Carpentry) | `fuzzy-name` | `bromsgrove/a-and-t-stairs-ltd-bromsgrove.json` |
| Higginson Staircases Ltd (E A Higginson & Company Ltd) | `postcode+name` | `london/higginson-staircases-ltd-london.json` |
| Renovate Your Staircase | `domain` | `_refacing/renovate-your-staircase-bury.json` |
| Design My Stairs | `domain` | `_refacing/design-my-stairs-wirral.json` |
| First Step Designs | `domain` | `stoke-on-trent/first-step-designs-stoke-on-trent.json` |

## Manual-review queue (preserved · NOT auto-deleted)

Per Philip's Stage 4 discipline (2026-08-15): identity failures and low-evidence records are preserved for human eyes. They are NOT dropped from the dataset.

- SEARCH_DISCOVERED (need re-fetch or manual identity check): 89
- DIRECTLY_REACHABLE_only (identity OK but no capability evidence on homepage — may need deeper crawl): 1
- Cross-source duplicates (need merge decision): 16
- Total review queue file: `stage4-manual-review-queue.json` (100 records)

## What Stage 4 did NOT do

- Did not write to Supabase directory_seeds
- Did not contact any company
- Did not auto-merge cross-source duplicates into existing seeds
- Did not delete or downgrade any identity-failure record
- Did not flip any Stage 2 capability claim to false based on absence of evidence
- Did not touch NEX brain, conversation architecture, or M4 freeze
- Did not start Stage 5 · blocked pending Philip's approval

## Files produced

- `stage4-full-verified.json` — all 311 records with `_stage4` verification data merged
- `stage4-cross-source-duplicates.json` — 16 records matching existing seeds
- `stage4-manual-review-queue.json` — 100 records needing human review
- `STAGE-4-REPORT-2026-08-15.md` — this report