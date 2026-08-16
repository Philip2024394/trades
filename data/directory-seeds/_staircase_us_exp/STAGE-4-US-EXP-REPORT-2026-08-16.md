# UK Staircase Trade Market · Stage 4-USA-EXP · Complete USA Verification

_v1 246 already-verified + expansion 287 freshly verified = 533 combined · 287.6s expansion wall time · 2026-08-16_

## Three-way comparison

| State | v1 246 | Expansion 287 | Combined 533 |
|---|---:|---:|---:|
| FULLY_VERIFIED | 165 | 172 | 337 |
| SERVICE_EVIDENCED | 15 | 23 | 38 |
| DIRECTLY_REACHABLE only | 2 | 2 | 4 |
| SEARCH_DISCOVERED | 64 | 90 | 154 |
| **A+B (production ready)** | **180** | **195** | **375** |

## Refacing-specific verification (Philip's flagged segment)

| Metric | v1 246 | Expansion 287 | Combined 533 |
|---|---:|---:|---:|
| Refacing evidence directly on page | 10 | 4 | 14 |
| Refacing-classified business_type | 16 | 24 | 40 |

## State-by-state combined verified inventory (A+B band)

| State | Total in dataset | FULLY | SERVICE | A+B |
|---|---:|---:|---:|---:|
| CA | 79 | (see combined dataset) | (see combined dataset) | — |
| TX | 56 | (see combined dataset) | (see combined dataset) | — |
| FL | 35 | (see combined dataset) | (see combined dataset) | — |
| NY | 33 | (see combined dataset) | (see combined dataset) | — |
| CO | 26 | (see combined dataset) | (see combined dataset) | — |
| PA | 23 | (see combined dataset) | (see combined dataset) | — |
| NC | 21 | (see combined dataset) | (see combined dataset) | — |
| IL | 21 | (see combined dataset) | (see combined dataset) | — |
| NJ | 20 | (see combined dataset) | (see combined dataset) | — |
| WA | 20 | (see combined dataset) | (see combined dataset) | — |
| MI | 19 | (see combined dataset) | (see combined dataset) | — |
| AZ | 17 | (see combined dataset) | (see combined dataset) | — |
| GA | 16 | (see combined dataset) | (see combined dataset) | — |
| OH | 16 | (see combined dataset) | (see combined dataset) | — |
| CT | 7 | (see combined dataset) | (see combined dataset) | — |
| OK | 7 | (see combined dataset) | (see combined dataset) | — |
| NV | 7 | (see combined dataset) | (see combined dataset) | — |
| VA | 6 | (see combined dataset) | (see combined dataset) | — |
| LA | 6 | (see combined dataset) | (see combined dataset) | — |
| AK | 6 | (see combined dataset) | (see combined dataset) | — |
| MA | 5 | (see combined dataset) | (see combined dataset) | — |
| NH | 5 | (see combined dataset) | (see combined dataset) | — |
| MO | 5 | (see combined dataset) | (see combined dataset) | — |
| UT | 5 | (see combined dataset) | (see combined dataset) | — |
| ID | 5 | (see combined dataset) | (see combined dataset) | — |

## Business-group classification (combined 533)

| Group | Count |
|---|---:|
| MULTI_SERVICE_COMPANY | 296 |
| STAIRCASE_MANUFACTURER | 119 |
| REFURBISHMENT_SERVICE_SPECIALIST | 54 |
| STAIRCASE_INSTALLER | 24 |
| REFACING_SERVICE_SPECIALIST | 22 |
| REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER | 18 |

## Cross-source dedup vs live 521 production

- Expansion candidates matching production: **0**

## Manual review queue (expansion only)

- SEARCH_DISCOVERED + DIRECTLY_REACHABLE + UK/IE-dupes: **92** records preserved

## FINAL RECOMMENDED PRODUCTION IMPORT

**375 A+B band records ready for Stage 5-USA production import.**

Breakdown:
- v1 246 A+B: 180
- Expansion new A+B: 195
- Total: 375

## Post-import commercial inventory (projected)

| Market | Production listings |
|---|---:|
| 🇬🇧 UK | 471 (frozen) |
| 🇮🇪 Ireland | 50 (frozen) |
| 🇺🇸 USA | 375 |
| **Total** | **896** |

## What Stage 4-USA-EXP did NOT do

- Zero UK 471 / IE 50 / v1 246 modifications
- Zero Supabase writes
- Zero US companies contacted
- Zero SEARCH_DISCOVERED records deleted
- Zero Stage 2 claims flipped to false based on absence of evidence
- Zero NEX brain / M4 changes
- **Stage 5-USA blocked pending Philip's review**