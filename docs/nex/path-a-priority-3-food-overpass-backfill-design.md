# Path A · Priority 3 · Food Overpass Re-Hit Backfill · DESIGN SPEC

**Status:** DRAFT · design only · awaiting explicit greenlight before execution
**Doctrine anchor:** `project_nex_priority_greenlight_accommodation_path_a_food_walker_preservation_2026_08_23`
**Companion:** Priority 1 (accommodation persistence · applied) · Priority 2 (food Walker code change · in place · restart-pending)

---

## The problem

- **806 existing food_business rows** in Yogyakarta have snapshots in FLAT format (no raw OSM tags)
- Path A cannot recover any OSM richness for these rows (nothing to re-parse)
- Priority 2's code change preserves raw tags for FUTURE discoveries — but food is currently dedupe-saturated (0 new food discoveries in the last hour of 100 cycles), so no new snapshots are being produced
- **The only way to unlock OSM richness for the existing 806 food rows is to re-query Overpass for each row's OSM element and persist the raw tags**

## What this design does

1. For each of the 806 food_business rows, re-query the Overpass API for the OSM element that originally produced it (identified by `source_reference` which contains the OSM id, e.g. `node/12345`)
2. Extract the raw tags from the Overpass response
3. UPSERT into `nex.food_business_source_snapshot` with the new raw-tag format
4. Then run Path A extraction against the newly-populated snapshots to persist `recovered_evidence` (same worker as accommodation Priority 1)

## Non-negotiable safeguards

- **Respectful Overpass rate limiting**: 2 requests/second sustained maximum (per Overpass usage policy). Even that is aggressive · start with 1 req/sec.
- **Exponential backoff** on 429 (Too Many Requests) and 5xx (server errors): 1s → 2s → 4s → 8s → 16s → 32s → cap at 60s
- **Circuit breaker**: if 5 consecutive 429s OR 3 consecutive 5xxs · pause worker · report · exit
- **Resumable / idempotent**: cursor file (`data/nex-enrichment/food-overpass-backfill-cursor.json`) records last-processed business_ref · rerun starts from cursor
- **Never modify the business row** — only writes new snapshot rows + provenance rows
- **Respectful stop signal**: SIGINT (Ctrl+C) triggers clean shutdown that saves cursor before exit
- **Reports exactly** how many rows recovered · how many failed · why

## Cost estimate

| Metric | Value |
|---|---|
| Total requests | 806 (one per existing food row) |
| Rate limit target | 1-2 req/sec sustained |
| Wall-clock time (1 req/sec) | ~13-14 minutes |
| Wall-clock time (2 req/sec) | ~7 minutes |
| External API cost | $0 (Overpass is free · usage policy is politeness) |
| DB writes | 806 new snapshot rows + ~4,000-8,000 provenance rows |
| Storage | ~5-10 MB |

## Execution mode

**Scoped to Yogyakarta food_business only.** Does NOT touch accommodation (already done in Priority 1). Does NOT touch food outside Yogyakarta (there is none currently).

**Standalone script** — separate from the acquisition scheduler. Does NOT run inside the non-stop Walker chain. Run once, monitored, then done.

## Provenance shape

Each re-fetched snapshot writes:

```
nex.food_business_source_snapshot INSERT:
  business_ref     = <existing food_business.public_listing_ref>
  source           = 'osm_overpass_rehit'         (distinguishes from original 'openstreetmap_overpass_v1')
  source_reference = <existing OSM id · same as original>
  raw_payload      = { lat, lng, tags: {...}, osmId, rehit_at: ISO, rehit_reason: 'path-a-priority-3-backfill' }
  cycle_run_id     = NULL (not a Walker cycle · one-off backfill operation)
```

**Original flat snapshot is PRESERVED** — the re-hit adds a NEW snapshot row, doesn't overwrite. Historical evidence intact.

After all snapshots are refreshed, run the same Path A extraction worker used for accommodation Priority 1 (parameterised to food_business + food_business_source_snapshot).

## Failure modes handled

| Failure | Behaviour |
|---|---|
| Overpass 429 (rate limit) | Exponential backoff · retry same row |
| Overpass 5xx | Same as 429 |
| Overpass timeout | Retry once · then skip + log |
| OSM element deleted (empty response) | Log "OSM element removed" · skip · move on |
| source_reference malformed | Log · skip · move on |
| Ctrl+C during run | Save cursor · exit cleanly |
| Sustained 429s (>5 consecutive) | Circuit breaker · pause · exit |
| DB pool exhausted | Backoff on DB errors · retry |

## What could go wrong (honest inventory)

1. **Overpass IP-throttle** — if we're mistakenly aggressive · Overpass could block Victus's IP for a period. Mitigation: start at 1 req/sec · circuit breaker at 5 consecutive 429s
2. **OSM data has changed since original discovery** — some businesses may have been renamed / moved / deleted in OSM since 2026-08-21 acquisition. Mitigation: this is FINE · the re-hit captures the CURRENT truth · the original flat snapshot preserves history
3. **Concurrent Walker cycle** — the running food Walker (chained mode) could hit Overpass at the same time as the backfill. Mitigation: consider pausing the Walker's chained loop during backfill · OR accept the shared Overpass rate limit
4. **Existing snapshot dedupe** — if we re-hit and the OSM element hasn't changed, we could get duplicate provenance rows. Mitigation: use `ON CONFLICT DO NOTHING` on provenance · UPSERT on snapshot with distinct rehit_at

## Estimated recovery rate

Based on accommodation Path A finding · roughly **30% of rows** will yield NEW OSM attributes beyond what was originally typed. So expect ~240 food rows to gain new intelligence.

The remaining ~566 rows either:
- Have OSM tags that were already fully typed at acquisition (name · phone · website · address · coordinates)
- Have no additional tags in OSM (bare minimum entries)

**Zero improvement on some rows is a valid outcome.** Report it honestly.

## Pre-flight checklist (before execution greenlight)

- [ ] Migration 088 applied ✅ (recovered_evidence column exists on food_business)
- [ ] Priority 2 code change in place ✅ (future discoveries preserve raw tags)
- [ ] Standalone script written and syntax-verified
- [ ] Cursor file location decided
- [ ] Circuit-breaker thresholds locked
- [ ] Rate-limit target locked (1 or 2 req/sec)
- [ ] Concurrent-Walker policy decided (pause chained loop during backfill · OR accept shared rate limit)
- [ ] Log destination decided
- [ ] Rollback documented (DELETE FROM food_business_source_snapshot WHERE source='osm_overpass_rehit')

## What is FORBIDDEN

- Aggressive rate above 2 req/sec sustained
- Skipping the circuit breaker
- Non-idempotent operations (no `DELETE THEN INSERT` cycles)
- Modifying the business row itself
- Silent failures (every skipped row logged with reason)
- Continuing past the circuit breaker without operator review

## Recommended sequencing (when greenlit)

1. Pause the food Walker's chained loop (just food · accommodation continues)
2. Run backfill script (13-14 min at 1 req/sec)
3. Run Path A extraction against refreshed food snapshots (~1 second · same worker as accommodation)
4. Report recovery counts
5. Resume food Walker's chained loop
6. Optional next: consider whether to migrate the doctrinal Business Knowledge Object polymorphic overlay

---

**Standing by for explicit execution greenlight.** No requests will be made to Overpass until you approve the specific plan.
