# UK Staircase Trade Market · Stage 5A-IE · Ireland Master Dataset (DRY-RUN)

_87 Irish master records built from 87 Stage 4-IE records · DRY-RUN · no Supabase writes · Stage 5B-IE blocked pending review + migration 053 · 2026-08-16_

## Tier split

| Tier | Count | Notes |
|---|---:|---|
| **production_ready.json** | **50** | A + B band · ready to INSERT with country='Ireland' |
| **manual_review_queue.json** | **37** | SEARCH_DISCOVERED / DIRECTLY_REACHABLE · preserved · NOT auto-imported |

## Stricter capability discipline (Philip 2026-08-16)

Unlike UK Stage 5A (which let claim-only records land as capabilities.<cap>='yes'), Ireland enforces: **only direct-evidenced capabilities earn 'yes' at the top level. Stage 2 claims that weren't directly confirmed stay as 'unknown' but are preserved in the evidence trail.**

### Capabilities with direct evidence ('yes' at top level)

| Capability | Count |
|---|---:|
| design | 53 |
| manufacture | 35 |
| bespoke | 35 |
| installation | 30 |
| refurbishment | 19 |
| glass | 16 |
| handrail | 15 |
| balustrade | 14 |
| metal | 7 |
| kit_or_product_supplier | 5 |

### Capabilities claimed in Stage 2 but not directly confirmed (preserved in evidence · NOT elevated to 'yes')

| Capability | Claims preserved |
|---|---:|
| bespoke | 42 |
| installation | 41 |
| manufacture | 35 |
| design | 29 |
| balustrade | 25 |
| handrail | 21 |
| metal | 18 |
| glass | 16 |
| refurbishment | 11 |
| refacing | 9 |

> Trade Centre filters for "who does refacing" will surface only the directly-evidenced ones. Admins reviewing individual records still see the Stage 2 claim in the evidence trail.

## Business type distribution

| business_type | Count |
|---|---:|
| STAIRCASE_MANUFACTURER | 52 |
| MULTI_SERVICE_COMPANY | 21 |
| REFACING_SERVICE_SPECIALIST | 6 |
| REFURBISHMENT_SERVICE_SPECIALIST | 3 |
| STAIRCASE_INSTALLER | 3 |
| REFACING_OR_REFURB_KIT_OR_PRODUCT_SUPPLIER | 2 |

## Language discipline

| Internal state | Count | Customer-facing label |
|---|---:|---|
| FULLY_VERIFIED | 40 | Business information checked |
| SEARCH_DISCOVERED | 30 | _(no badge)_ |
| SERVICE_EVIDENCED | 10 | Business information partially checked |
| DIRECTLY_REACHABLE | 7 | _(no badge)_ |

> `verified: true` and `claimed: true` set to `false` on every record.

## Geographic distribution

| County | Count |
|---|---:|
| Dublin | 23 |
| Cork | 12 |
| Galway | 7 |
| Donegal | 5 |
| Meath | 4 |
| Wexford | 4 |
| Limerick | 4 |
| Cavan | 4 |
| Louth | 3 |
| Sligo | 3 |
| Mayo | 3 |
| Monaghan | 3 |
| Tipperary | 2 |
| Kerry | 2 |
| Carlow | 1 |
| Kilkenny | 1 |
| Wicklow | 1 |
| Kildare | 1 |
| Westmeath | 1 |
| Waterford | 1 |
| Clare | 1 |
| Leitrim | 1 |

## Stage 5B-IE import plan preview

**PREREQUISITE:** apply `deploy/postgres/init/053_drop_region_check.sql` via Supabase Dashboard first (drops the UK-only region CHECK · scales to Germany/USA/etc.).

| Action | Count |
|---|---:|
| INSERT (new records with country='Ireland') | 50 |
| MERGE (into existing rows) | 0 (Ireland has no legacy) |
| DEFERRED (preserved in review queue · not imported) | 37 |

### Post-import commercial inventory

| Market | Production listings |
|---|---:|
| 🇬🇧 United Kingdom | 471 |
| 🇮🇪 Ireland | 50 (after 5B-IE) |
| **Total** | **521** |

## What Stage 5A-IE did NOT do

- Did NOT write to Supabase directory_seeds table
- Did NOT modify any UK 471 records (they remain frozen)
- Did NOT contact any Irish company
- Did NOT elevate Stage 2 claims to capabilities='yes' without Stage 4 direct evidence
- Did NOT set `verified: true` on any record
- Did NOT touch NEX brain / M4 freeze
- Did NOT start Stage 5B-IE · blocked pending Philip's review + migration 053 apply

## Files produced

- `production_ready.json` — 50 records ready to INSERT
- `manual_review_queue.json` — 37 records preserved
- `stage5b-ie-import-plan.json` — full Supabase import plan preview
- `STAGE-5A-IE-REPORT-2026-08-16.md` — this report

## Ask · Stage 5B-IE approval

On approval, Stage 5B-IE will:
1. Verify migration 053 (drop region CHECK) is applied
2. Backup current 471 UK production rows (per migration protocol)
3. Preflight: validate all 50 IE inserts · no slug/domain collisions with UK
4. INSERT 50 Irish records with country='Ireland' · claimed=false · verified=false · lifecycle_status='unclaimed' · directory_state='listed'
5. Emit before/after row counts + reconciliation (INSERTED · DEFERRED · EXCEPTION)
6. Never contact any Irish company
7. Never modify any UK 471 record