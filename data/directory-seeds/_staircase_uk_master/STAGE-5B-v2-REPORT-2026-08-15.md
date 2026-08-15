# UK Staircase Trade Market · Stage 5B v2 · Live-Supabase-Aware Import

_Executed against NEX Supabase directory_seeds · live-dedup engine · Philip Option 1 · 2026-08-15T11:42:01.208Z_

## Result summary

| Metric | Value |
|---|---:|
| Before row count | 302 |
| Inserted (new) | 169 |
| Live-merged (auto · name matched) | 0 |
| Planned-merged (Stage 4 target) | 0 |
| Ambiguous review (deferred) | 12 |
| Original review queue (deferred) | 84 |
| Insert exceptions | 0 |
| Merge exceptions | 0 |
| After row count | 471 |
| Net change | +169 |

## Live-dedup classification (v2 addition)

Before writing, all 211 production_ready records were cross-checked against the LIVE 302-row Supabase snapshot (not just legacy JSON archives).

| Verdict | Count |
|---|---:|
| INSERT (no live collision) | 169 |
| LIVE_MERGE (collision + identity confirmed) | 30 |
| LIVE_AMBIGUOUS_REVIEW (collision + name differs) | 12 |

## Rules preserved

| Rule | Result |
|---|---:|
| Rows with verified=true | 0 |
| Rows with claimed=true | 0 |
| Rows with non-unclaimed lifecycle | 1 |

## Reconciliation · every source record ended in exactly one state

| Final state | Count |
|---|---:|
| INSERTED | 169 |
| DEFERRED | 84 |
| AMBIGUOUS_REVIEW | 12 |
| **TOTAL** | **265** |

## Ambiguous review queue · 12 records need human decision

These are collisions where the domain/phone/email matches a live row BUT the business_name is different. Preserved in `stage5b-v2-ambiguous-review.json` for manual triage.

| Incoming business | Signals | Live target (name) |
|---|---|---|
| ATG Contracts Ltd | domain | Staircase Design Blackpool (`staircase-design-blackpool-atgcontractsltd`) |
| Complete Stair Systems Ltd | domain, phone, email | Spiral Staircases UK (`spiral-staircases-uk-completestairsystems`) |
| Spittlywood Ltd | fuzzy-name | tt (`tt-new-ross`) |
| Brighton Stairs | phone | South Coast Steel (`south-coast-steel-southcoaststeel`) |
| Hampshire Staircase Refurbishments | domain, phone, email | Staircase Refurbishment & Understairs Storage Hampshire (`staircase-refurbishment-and-understairs-storage-hampshire-hampshirestaircase`) |
| Brian R Homes Joinery | fuzzy-name | Home (`home-yeovalleyjoinery`) |
| Stairplan Ltd | phone, email | Staircases made to measure UK Staircase Manufacturers (`staircases-made-to-measure-uk-staircase-manufacturers-stairplan`) |
| Central Joinery Group Ltd | domain, phone, email | Bespoke Staircases & Specialist Joinery Manufacturers UK (`bespoke-staircases-and-specialist-joinery-manufacturers-uk-centraljoinerygroup`) |
| White's Staircases | domain, phone, email | Versatile handmade staircases (`versatile-handmade-staircases-whites-staircases`) |
| Pettitt Joinery Company Ltd | fuzzy-name | tt (`tt-new-ross`) |
| Jason Gittus Carpentry & Joinery | fuzzy-name | tt (`tt-new-ross`) |
| Bisca | domain | Bisca Staircase Design (`bisca-staircase-design-bisca`) |

## Backup

- File: `C:\Users\Victus\trades\data\directory-seeds\_staircase_uk_master\backups\directory_seeds-2026-08-15-pre-stage5b-v2.json`
- Row count captured: 302
- Checksum: `c2dd18c31b040d760e69dde1df67f85e…`

## What Stage 5B v2 did NOT do

- Did not contact any company
- Did not set verified=true or claimed=true on any record
- Did not touch the 84 review-queue records or the 12 new ambiguous-review records
- Did not overwrite stronger existing data on any merge
- Did not touch NEX brain / M4 freeze