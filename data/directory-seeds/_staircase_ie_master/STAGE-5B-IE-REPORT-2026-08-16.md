# UK Staircase Trade Market · Stage 5B-IE · Ireland Production Import + Audit

_Executed against NEX Supabase directory_seeds · 5-step Philip protocol · 2026-08-16T11:12:08.806Z_

## Result summary

| Metric | Value |
|---|---:|
| Before row count | 471 |
| Ireland inserted | 50 |
| Insert exceptions | 0 |
| Deferred (review queue) | 37 |
| After row count | 521 |
| Net change | +50 |

## Commercial inventory (post-Stage 5B-IE)

| Market | Production listings |
|---|---:|
| 🇬🇧 United Kingdom | 471 |
| 🇮🇪 Ireland | 50 |
| **Total** | **521** |

## Rules preserved

| Rule | Result |
|---|---|
| UK 471 unchanged | ✓ frozen |
| Ireland records with verified=true | 0 (must be 0) |
| Ireland records with claimed=true | 0 (must be 0) |
| Preflight errors | 0 |

## Reconciliation

| Final state | Count |
|---|---:|
| INSERTED | 50 |
| DEFERRED | 37 |
| **TOTAL** | **87** (must equal 87 = 50 production + 37 review) |

## Backup

- File: `C:/Users/Victus/trades/data/directory-seeds/_staircase_ie_master/backups/directory_seeds-2026-08-16-pre-stage5b-ie.json`
- Rows captured: 471
- Checksum: `905aeca5daf9de6379de29f043381b08…`

## What Stage 5B-IE did NOT do

- Did not modify any UK 471 record
- Did not contact any Irish company
- Did not set verified=true or claimed=true on any Irish record
- Did not touch the 37 review-queue records
- Did not elevate Stage 2 claims to capabilities='yes' without direct evidence
- Did not touch NEX brain / M4 freeze