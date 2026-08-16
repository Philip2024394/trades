# UK Staircase Trade Market · Stage 4-USA · Full Direct-Verify

_All 246 US candidates · direct HTTP fetched · evidence from actual page content · cross-checked against live 521 production · 223.5s wall time · 2026-08-16_

## Headline numbers

- **TOTAL DISCOVERED:** 246
- **DIRECTLY REACHABLE** (HTTP 2xx-3xx): 223
- **IDENTITY CONFIRMED** on page: 182
- **FULLY VERIFIED** (identity + ≥3 caps): 165
- **SERVICE EVIDENCED**: 15
- **DIRECTLY REACHABLE only**: 2
- **SEARCH DISCOVERED** (preserved): 64
- **MANUAL REVIEW queue:** 66
- **DUPLICATES vs 521 production:** 0
- **Fetch errors:** 23
- **No URL:** 0

## Per-agent verification

| Agent | FULLY | SERVICE | DIRECT | SEARCH |
|---|---:|---:|---:|---:|
| agent-us-1-northeast.json | 35 | 2 | 2 | 4 |
| agent-us-2-southeast.json | 25 | 0 | 0 | 10 |
| agent-us-3-midwest.json | 20 | 3 | 0 | 7 |
| agent-us-4-southwest.json | 15 | 1 | 0 | 9 |
| agent-us-5-west.json | 20 | 1 | 0 | 5 |
| agent-us-6-california.json | 16 | 3 | 0 | 13 |
| agent-us-7-texas.json | 19 | 2 | 0 | 10 |
| agent-us-8-refacing-refurbishment.json | 15 | 3 | 0 | 6 |

## Capability comparison · Stage 2 → Stage 4

| Capability | CONFIRMED | NOT_CONFIRMED | CONTRADICTED | NOT_CHECKABLE | NEWLY_EVIDENCED |
|---|---:|---:|---:|---:|---:|
| manufacture | 72 | 33 | 0 | 64 | 49 |
| installation | 84 | 30 | 0 | 64 | 49 |
| refurbishment | 46 | 11 | 0 | 64 | 64 |
| refacing | 5 | 12 | 0 | 64 | 3 |
| balustrade | 85 | 27 | 0 | 64 | 44 |
| handrail | 51 | 65 | 0 | 64 | 25 |
| glass | 10 | 12 | 0 | 64 | 26 |
| metal | 44 | 28 | 0 | 64 | 29 |

## Per-state verification (top 15)

| State | Total | FULLY | SEARCH_DISC |
|---|---:|---:|---:|
| CA | 36 | 18 | 15 |
| TX | 32 | 20 | 10 |
| NY | 14 | 12 | 2 |
| AZ | 14 | 11 | 3 |
| PA | 8 | 7 | 0 |
| GA | 8 | 2 | 6 |
| FL | 8 | 8 | 0 |
| IL | 7 | 6 | 0 |
| OH | 7 | 4 | 3 |
| OK | 7 | 3 | 4 |
| CO | 7 | 5 | 2 |
| NJ | 6 | 6 | 0 |
| NC | 6 | 3 | 2 |
| WA | 6 | 5 | 0 |
| MA | 5 | 3 | 0 |

## Business-group classification

| Group | Count |
|---|---:|
| MULTI_SERVICE_COMPANY | 139 |
| STAIRCASE_MANUFACTURER | 67 |
| REFURBISHMENT_SERVICE_SPECIALIST | 15 |
| REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER | 11 |
| STAIRCASE_INSTALLER | 9 |
| REFACING_SERVICE_SPECIALIST | 5 |

## Quality bands

| Band | State | Count |
|---|---|---:|
| A | FULLY_VERIFIED | 165 |
| B | SERVICE_EVIDENCED | 15 |
| C | DIRECTLY_REACHABLE | 2 |
| D | SEARCH_DISCOVERED | 64 |

## Cross-source dedup vs live 521 production

0 US candidates matched a live production row. Clean · USA is genuinely a new country dataset.

## Manual review queue

- SEARCH_DISCOVERED: 64
- DIRECTLY_REACHABLE only: 2
- Cross-production duplicates: 0
- Total: 66 · preserved in `stage4-us-manual-review-queue.json`

## Recommended production import count

**180 records (A + B band)** ready for Stage 5-USA · 165 FULLY_VERIFIED + 15 SERVICE_EVIDENCED. Remaining 66 preserved in review queue.

## What Stage 4-USA did NOT do

- Did NOT modify any of the 521 production rows
- Did NOT write to Supabase
- Did NOT contact any US company
- Did NOT delete any candidate
- Did NOT flip any Stage 2 claim to false based on absence of evidence
- Did NOT touch NEX brain / M4 freeze
- Did NOT start Stage 5-USA · blocked pending Philip's review