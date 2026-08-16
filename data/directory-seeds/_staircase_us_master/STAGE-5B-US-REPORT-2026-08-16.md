# UK Staircase Trade Market · Stage 5B-USA · Production Import + Audit

_Executed against NEX Supabase directory_seeds · Philip 5-step protocol · 2026-08-16T16:16:45.724Z_

## Result summary

| Metric | Value |
|---|---:|
| Before row count | 521 |
| US inserted | 375 |
| Insert exceptions | 0 |
| Deferred (review queue) | 158 |
| After row count | 896 |
| Net change | +375 |

## Commercial inventory · LIVE

| Market | Production listings |
|---|---:|
| 🇬🇧 United Kingdom | 471 |
| 🇮🇪 Ireland | 50 |
| 🇺🇸 USA | 375 |
| **Total** | **896** |

## Rules preserved

| Rule | Result |
|---|---|
| UK 471 unchanged | ✓ frozen |
| Ireland 50 unchanged | ✓ frozen |
| US records with verified=true | 0 (must be 0) |
| US records with claimed=true | 0 (must be 0) |
| Preflight hard errors | 0 |
| Preflight warnings | 0 |

## Reconciliation · every source record has exactly one final state

| Final state | Count |
|---|---:|
| INSERTED | 375 |
| DEFERRED | 158 |
| **TOTAL** | **533** (must equal 533 = 375 production + 158 review) |

## Backup

- File: `C:/Users/Victus/trades/data/directory-seeds/_staircase_us_master/backups/directory_seeds-2026-08-16-pre-stage5b-us.json`
- Rows captured: 521
- Checksum: `e89eff31e4ef8d49097d54879b8d1dc8…`

## What Stage 5B-USA did NOT do

- Did not modify any UK 471 or Ireland 50 record
- Did not contact any US company
- Did not set verified=true or claimed=true on any US record
- Did not touch the 158 review-queue records
- Did not elevate Stage 2 claims to capabilities='yes' without direct evidence
- Did not touch NEX brain / M4 freeze