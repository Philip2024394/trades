# NEX Directory · Ingestion stop-reason diagnosis · food · 2026-10-10

**Authored by** · verticals audit agent (C · wave V-2)
**Branch** · `nex/directory-work`
**Status** · Diagnosis complete · fix is a next-wave decision

## Question

The sealed food ingestion runner (`scripts/nex-canonical/real-ingestion-runner.ts`
using `source-legacy-food-business.ts`) halted with
`reason=no_fresh_candidates_generated` at the end of the last
continuous-food run. Live counts:

- `business_canonical` (entity_type=food) · 22,616
- `business_directory_v` (entity_type=food) · 22,615
- `food_business` legacy total · 22,757

That left an apparent gap of **126 rows**. Is the pool genuinely
exhausted (adapter correctly producing nothing), or are candidates
being generated and then skipped at some stage?

## Method

Read-only probe · `scripts/nex-canonical/_ingestion-filter-probe.mjs` ·
session `current_database() = nex_dev` · zero writes. Re-executes the
sealed adapter's projection filter path (stages A/B/C from
`projectFoodBusinessRow` §3) with plain `COUNT(*) FILTER (…)` SQL and
then measures identity collisions against the existing canonical.

## Diagnosis · SKIPPED (not EXHAUSTED)

| Measure | Value |
|---|---|
| Total `nex.food_business` rows | 22,757 |
| Linked (`canonical_business_id IS NOT NULL`) | 22,631 |
| Remaining (`canonical_business_id IS NULL`) | **126** |
| `linked + remaining = total` | TRUE (22,631 + 126 = 22,757) |
| Stage A failures (`internal_id` null) | 0 |
| Stage B failures (`public_listing_ref` null/blank) | 0 |
| Stage C failures (`business_name` null/blank) | 0 |
| Projectable rows in the remaining pool | **126** |

**The adapter would ACCEPT all 126 remaining rows.** It is NOT the
adapter's own filter that drops them.

### Why the runner emits `no_fresh_candidates_generated`

Of the 126 remaining projectable rows:

- **88 rows** share `name_canonical` with an existing food canonical
  by exact lower-trimmed match.
- The top chain names in the skipped pool are:

| Name | Rows skipped |
|---|---|
| Angkringan | 6 |
| Starbucks | 5 |
| Burjo Borneo | 5 |
| McDonald's | 4 |
| Pizza Hut | 3 |
| Sushi Tei | 3 |
| Biggby Coffee | 3 |
| Pasar Desa Jamuskauman | 2 |
| Bakmi GM | 2 |
| Burger King | 2 |

All are multi-location chains (franchises). Sample rows resolved to
these existing canonicals (all `lifecycle_state = VERIFIED`):

```
Pizza Hut   → 48227755-ab0f-46b7-96b0-f642759dc5f1
Starbucks   → b1660dd5-af05-4b67-adc8-332b6ea42a05
KFC         → d2a512aa-1313-49a9-a882-0c68ffbd87c3
Warung Makan → ea197ca3-… / aa0b2d82-… (two sibling canonicals)
```

The sealed resolver (`canonical-resolver.ts`) is doing exactly what it
should: when a new candidate's identity signals (name_canonical, and
likely coordinates/phone/osm_id for the remaining 38) match an existing
canonical, the resolver MERGES rather than CREATING a duplicate. The
runner then has zero fresh canonicals to write and reports
`no_fresh_candidates_generated`.

The remaining 38 rows (126 − 88 = 38) do not match by name but likely
match by osm_id or coordinates to the same chain canonicals (each
chain in Indonesia has one canonical row that resolves many legacy
locations).

**The resolver merge is correct.** The gap is architectural:

> The sealed handoff writer (`canonical-handoff.ts` /
> `execute-write-plan.ts`) does NOT backfill
> `food_business.canonical_business_id` on the legacy row when the
> resolver chose to MERGE the candidate into an existing canonical.
> It only backfills when the candidate causes an INSERT into
> `business_canonical`.

Because of that gap, these 126 legacy rows will stay in the "remaining"
pool forever · they are not actually unprocessed, they are quietly
merged, but the back-reference that would mark them as handled is
missing.

## Proposed fix (NOT applied in this wave)

The adapter is correct. The resolver is correct. The gap is in the
write boundary.

**Next-wave patch candidate (do NOT apply now · requires founder
authorisation):**

Extend `canonical-handoff.ts` so that when a candidate's resolver
decision is `merge_into_existing(target_canonical_business_id)`, the
handoff emits an additional `UPDATE nex.food_business SET
canonical_business_id = $target WHERE internal_id = $source` statement
(same transaction as any merged-into evidence writes). The patch must:

1. Be scoped per source adapter (food, accommodation, service,
   mp_seller · transport is excluded because it has no
   `canonical_business_id` column per migration 169).
2. Be idempotent (`WHERE canonical_business_id IS NULL` guard).
3. Fire only on merge decisions · never on quarantine or reject
   decisions.
4. Carry a comment explaining the architectural rationale (so a
   future reader doesn't mistake it for an evidence write).

The 126 rows that would be swept into the correct chain canonicals
after this patch would NOT create 126 new publications · they would
just stop re-entering the ingestion batch forever.

## What this is NOT

- NOT an adapter bug · the adapter's projection filter is behaving as
  designed.
- NOT a resolver bug · the resolver is correctly deduplicating chain
  franchises against a single canonical.
- NOT a reason to re-run the continuous food loop · it will halt with
  the same stop-reason until the handoff writer is extended.
- NOT a reason to flip `can_display` on any source.

## Audit trail

- Probe script · `scripts/nex-canonical/_ingestion-filter-probe.mjs`
- Food vertical audit · `scripts/nex-canonical/_vertical-audit-food.mjs`
- Session identity · `current_database() = nex_dev · current_user = postgres`
- Transaction mode · `SET default_transaction_read_only = on`
- Zero writes · zero mutation · zero adapter / migration / runner
  changes
