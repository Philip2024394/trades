# UK Staircase Trade Market · Stage 4-IE · Ireland Full Direct-Verify

_All 87 Irish candidates · direct HTTP fetched · evidence from actual page content · cross-checked against live 471 UK production · 64.1s wall time · 2026-08-16_

## Headline numbers (as requested)

- **TOTAL DISCOVERED:** 87
- **DIRECTLY REACHABLE** (HTTP 2xx-3xx): 78
- **IDENTITY CONFIRMED** on page: 57
- **FULLY VERIFIED** (identity + ≥3 caps directly evidenced): 40
- **SERVICE EVIDENCED** (identity + ≥1 cap): 10
- **DIRECTLY REACHABLE only** (identity, no caps): 7
- **SEARCH DISCOVERED** (fetch/identity failed · preserved): 30
- **MANUAL REVIEW queue:** 37
- **DUPLICATES vs UK 471:** 0
- **Fetch errors:** 9
- **No URL:** 0

> Standing rule: "**not evidenced**" ≠ "**does not provide the service**". A page may not mention refacing while the company still does refacing. The 4-state comparison below preserves this distinction.

## Capability comparison · Stage 2 claim → Stage 4 direct evidence

| Capability | CONFIRMED | NOT_CONFIRMED | CONTRADICTED | NOT_CHECKABLE | NEWLY_EVIDENCED |
|---|---:|---:|---:|---:|---:|
| manufacture | 30 | 15 | 0 | 30 | 1 |
| installation | 26 | 19 | 0 | 30 | 2 |
| refurbishment | 9 | 4 | 0 | 30 | 6 |
| refacing | 0 | 6 | 0 | 30 | 0 |
| balustrade | 9 | 15 | 0 | 30 | 5 |
| handrail | 6 | 13 | 0 | 30 | 6 |
| glass | 11 | 8 | 0 | 30 | 4 |
| metal | 6 | 10 | 0 | 30 | 0 |

## Per-agent verification (answers the Munster question)

| Agent | FULLY_VERIFIED | SERVICE_EVIDENCED | DIRECTLY_REACHABLE | SEARCH_DISCOVERED |
|---|---:|---:|---:|---:|
| agent-ie-1-dublin-leinster.json | 20 | 0 | 0 | 11 |
| agent-ie-2-munster.json | 9 | 1 | 2 | 8 |
| agent-ie-3-connacht-roi-ulster.json | 10 | 5 | 4 | 6 |
| agent-ie-4-refurb-refacing.json | 1 | 4 | 1 | 5 |

## Per-county verification

| County | Total | FULLY_VERIFIED | SEARCH_DISCOVERED |
|---|---:|---:|---:|
| Dublin | 23 | 11 | 10 |
| Cork | 12 | 5 | 5 |
| Galway | 7 | 3 | 1 |
| Donegal | 5 | 2 | 3 |
| Meath | 4 | 3 | 1 |
| Wexford | 4 | 2 | 1 |
| Cavan | 4 | 0 | 2 |
| Louth | 3 | 1 | 1 |
| Limerick | 4 | 2 | 1 |
| Sligo | 3 | 2 | 0 |
| Tipperary | 2 | 0 | 2 |
| Kerry | 2 | 1 | 0 |
| Mayo | 3 | 1 | 1 |
| Carlow | 1 | 1 | 0 |
| Kilkenny | 1 | 1 | 0 |
| Wicklow | 1 | 1 | 0 |
| Kildare | 1 | 1 | 0 |
| Westmeath | 1 | 0 | 1 |
| Waterford | 1 | 0 | 1 |
| Clare | 1 | 1 | 0 |
| Leitrim | 1 | 1 | 0 |
| Monaghan | 3 | 1 | 0 |

## Business-group classification

| Group | Count |
|---|---:|
| STAIRCASE_MANUFACTURER | 52 |
| MULTI_SERVICE_COMPANY | 21 |
| REFACING_SERVICE_SPECIALIST | 6 |
| REFURBISHMENT_SERVICE_SPECIALIST | 3 |
| STAIRCASE_INSTALLER | 3 |
| REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER | 2 |

## Quality bands

| Band | Verification state | Count |
|---|---|---:|
| A | FULLY_VERIFIED | 40 |
| B | SERVICE_EVIDENCED | 10 |
| C | DIRECTLY_REACHABLE (identity only) | 7 |
| D | SEARCH_DISCOVERED | 30 |

## Cross-source dedup vs live UK 471

0 Irish candidates matched a UK production row. Clean · Ireland is a genuinely new country dataset. Preserved in `stage4-ie-cross-source-duplicates.json`.

## Manual review queue

- SEARCH_DISCOVERED: 30
- DIRECTLY_REACHABLE only: 7
- UK cross-source duplicates: 0
- Total: 37 · preserved in `stage4-ie-manual-review-queue.json` (NOT auto-imported)

## What Stage 4-IE did NOT do

- Did NOT modify any UK 471 record (read-only cross-check)
- Did NOT write to Supabase directory_seeds
- Did NOT contact any Irish company
- Did NOT delete any identity-failure record
- Did NOT flip any Stage 2 capability claim to false based on absence of evidence
- Did NOT touch NEX brain / M4 freeze
- Did NOT start Stage 5-IE · blocked pending Philip's review