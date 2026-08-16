# UK Staircase Trade Market · Stage 5A-USA · Master Dataset (DRY-RUN)

_533 US master records built from 533 Stage 4-USA combined records · DRY-RUN · no Supabase writes · Stage 5B-USA blocked pending review · 2026-08-16_

## Reconciliation · every source record has exactly one final disposition

| Tier | Count |
|---|---:|
| **production_ready.json** (A+B ready to INSERT) | **375** |
| **manual_review_queue.json** (D + C · preserved · NOT auto-imported) | **158** |
| **TOTAL** | **533** (matches 533 discovered) |

## Split by discovery pass

| Pass | Records |
|---|---:|
| v1 | 246 |
| expansion | 287 |

## Stricter capability discipline (Ireland-style · Philip 2026-08-15)

Only direct-evidenced capabilities land as `capabilities.<cap>='yes'`. Stage 2 claims that Stage 4 couldn't confirm stay `unknown` at top level · preserved in evidence trail.

### Capabilities with direct evidence ('yes' at top level)

| Capability | Count |
|---|---:|
| design | 332 |
| installation | 300 |
| balustrade | 271 |
| refurbishment | 257 |
| manufacture | 229 |
| bespoke | 205 |
| handrail | 158 |
| metal | 145 |
| glass | 76 |
| kit_or_product_supplier | 23 |
| refacing | 14 |

### Capabilities claimed in Stage 2 but not directly confirmed (preserved · NOT elevated to 'yes')

| Capability | Claims preserved |
|---|---:|
| handrail | 146 |
| railings | 142 |
| custom_staircase | 112 |
| bespoke | 108 |
| wood_stairs | 107 |
| installation | 102 |
| manufacture | 102 |
| design | 79 |
| balustrade | 73 |
| stair_remodel | 67 |
| commercial | 64 |
| metal_stairs | 59 |
| refacing | 58 |
| metal | 57 |
| custom | 56 |
| wood | 46 |
| railing | 46 |
| refurbishment | 45 |
| residential | 41 |
| repair | 40 |
| renovation | 37 |
| stair_installation | 30 |
| staircase_installation | 28 |
| railings_balustrades | 28 |
| iron | 27 |
| custom_stairs | 26 |
| wrought_iron | 26 |
| custom_staircase_design | 26 |
| floating | 23 |
| custom_staircase_manufacture | 22 |
| curved | 20 |
| glass | 19 |
| spiral | 19 |
| custom_ironwork | 19 |
| spiral_stairs | 18 |
| remodel | 18 |
| metal_stair | 18 |
| commercial_projects | 18 |
| wood_stair | 16 |
| iron_railing | 16 |
| spiral_staircase | 15 |
| metal_railing | 14 |
| commercial_stairs | 14 |
| curved_stairs | 12 |
| wood_treads | 12 |
| restoration | 12 |
| renovation_refinishing | 12 |
| staircase_remodel | 11 |
| cable_railing | 11 |
| curved_staircase | 10 |
| floating_staircase | 10 |
| new_build_staircases | 9 |
| staircase_repair | 9 |
| glass_stairs | 8 |
| wrought_iron_railing | 8 |
| cable | 7 |
| spiral_staircases | 7 |
| curved_staircases | 7 |
| floating_stairs | 6 |
| manufacturing | 4 |
| floating_staircases | 2 |
| supply_only | 2 |
| glass_railing | 1 |

## Business type distribution (all 533)

| business_type | Count |
|---|---:|
| MULTI_SERVICE_COMPANY | 296 |
| STAIRCASE_MANUFACTURER | 119 |
| REFURBISHMENT_SERVICE_SPECIALIST | 54 |
| STAIRCASE_INSTALLER | 24 |
| REFACING_SERVICE_SPECIALIST | 22 |
| REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER | 18 |

## Language discipline

| Internal state | Count | Customer-facing label |
|---|---:|---|
| FULLY_VERIFIED | 337 | Business information checked |
| SEARCH_DISCOVERED | 154 | _(no badge)_ |
| SERVICE_EVIDENCED | 38 | Business information partially checked |
| DIRECTLY_REACHABLE | 4 | _(no badge)_ |

> `verified: true` and `claimed: true` set to `false` on every record. Language caution enforced.

## Geographic distribution (top 25 states of 533)

| State | Count |
|---|---:|
| CA | 79 |
| TX | 56 |
| FL | 35 |
| NY | 33 |
| CO | 26 |
| PA | 23 |
| NC | 21 |
| IL | 21 |
| NJ | 20 |
| WA | 20 |
| MI | 19 |
| AZ | 17 |
| GA | 16 |
| OH | 16 |
| CT | 7 |
| OK | 7 |
| NV | 7 |
| VA | 6 |
| LA | 6 |
| AK | 6 |
| MA | 5 |
| NH | 5 |
| MO | 5 |
| UT | 5 |
| ID | 5 |

## Preflight

- Duplicate slugs within production_ready: **0** 
- Cross-source duplicates vs live 521: **0** (per Stage 4-USA-EXP)

## Stage 5B-USA import plan preview

**PREREQUISITE:** migration 053 (drop region CHECK) already applied for Ireland · region field will accept US state codes without additional migration.

| Action | Count |
|---|---:|
| INSERT (new records with country='USA') | 375 |
| MERGE (into existing rows) | 0 (USA has no legacy) |
| DEFERRED (preserved in review queue) | 158 |

### Post-import commercial inventory

| Market | Production listings |
|---|---:|
| 🇬🇧 UK | 471 (frozen) |
| 🇮🇪 Ireland | 50 (frozen) |
| 🇺🇸 USA | 375 (after 5B-USA) |
| **Total** | **896** |

## What Stage 5A-USA did NOT do

- Did NOT write to Supabase directory_seeds table
- Did NOT modify any UK 471 or Ireland 50 records (both remain frozen)
- Did NOT contact any US company
- Did NOT elevate Stage 2 claims to capabilities='yes' without Stage 4 direct evidence
- Did NOT set `verified: true` on any record
- Did NOT delete any of the 158 review-queue records
- Did NOT touch NEX brain / M4 freeze
- Did NOT start Stage 5B-USA · blocked pending Philip's review

## Ask · Stage 5B-USA approval

On approval, Stage 5B-USA will:
1. Backup all 521 production rows (per migration protocol)
2. Preflight all 375 US inserts · no slug/domain collisions with UK/IE
3. INSERT 375 records with country='USA' · claimed=false · verified=false · lifecycle_status='unclaimed' · directory_state='listed'
4. Emit before/after row counts + reconciliation (INSERTED · DEFERRED · EXCEPTION)
5. Never contact any US company · Never modify UK/IE production