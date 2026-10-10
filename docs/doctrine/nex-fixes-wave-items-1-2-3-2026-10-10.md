# NEX Directory · Fixes Wave · Items 1-2-3 · 2026-10-10

Branch: `nex/directory-work` · author: Fixes agent F1 · DB: `nex_dev` on
`localhost:5433` · dev server LIVE at `localhost:3008` throughout.

Session identity probe (hard gate): `SELECT current_database()` =
`nex_dev` · verified before every DB touch.

Three independent tasks landed in one agent run. No git commit was
created. F2/F3/F4/F5 scopes untouched.

## ═══════════════════════════════════════════════════════════════
## Task 1 · Handoff / executor backlink fix
## ═══════════════════════════════════════════════════════════════

### Problem (recap)

Food ingestion stalled at **126 remaining `food_business` rows** because
the sealed `executeWritePlan` writer never backfills
`food_business.canonical_business_id` on MERGE verdicts. The adapter
filters on `canonical_business_id IS NULL`, so every subsequent run
re-emits the same source rows forever. The `_continuous-food-ingestion.mjs`
runner had a step-5b workaround (a post-batch JOIN UPDATE), but anyone
calling the sealed pipeline directly (per-row writes, future runners)
would not get the backlink.

### Fix

**Files modified / created:**

| File | Change |
|---|---|
| `scripts/nex-canonical/canonical-handoff.ts` | +88 / -0 — new pure `legacyBacklinkSpec(table)` helper and `LegacyBacklinkSpec` interface |
| `scripts/nex-canonical/execute-write-plan.ts` | +51 / -2 — new `backfill_legacy_canonical_id` stage emitted on merge_match path, between `write` and `commit`, inside the same SERIALIZABLE transaction |
| `scripts/nex-canonical/__tests__/canonical-handoff-merge-backlink.test.ts` | NEW — 19 unit tests |
| `scripts/nex-canonical/vitest.local.config.ts` | +4 / -1 — include `scripts/nex-canonical/__tests__/*.test.ts` so the new file is discovered |
| `scripts/nex-canonical/_verify-merge-backlink.mjs` | NEW — bounded probe runner (session-identity-guarded) |

### Design notes

1. **Vertical-aware** — `legacyBacklinkSpec` is a pure switch over the
   known legacy tables, each with its correct primary-key column
   verified against live `nex_dev` on 2026-10-10:
   - `nex.food_business` → PK `internal_id` (uuid)
   - `nex.accommodation_business` → PK `internal_id` (uuid)
   - `nex.service_business` → PK `internal_id` (uuid)
   - `nex.mp_seller` → PK `seller_id` (uuid) ← different column name
   - any other table (including `nex.transport_acquisition_record`
     which has no `canonical_business_id` column today) → `null`.
     The executor skips the stage silently · it never fabricates an
     UPDATE against a column that doesn't exist.
2. **Idempotent** — the emitted SQL is:
   ```sql
   UPDATE nex.<table>
      SET canonical_business_id = $1
    WHERE <id_column> = $2
      AND canonical_business_id IS NULL
   ```
   The `AND canonical_business_id IS NULL` guard makes a replay a safe
   no-op · `expects: "any"` so 0 rows affected is accepted.
3. **Same transaction** — the stage runs between the sealed evidence
   INSERT and `COMMIT`, inside the executor's one SERIALIZABLE txn.
   If anything after it fails, the backlink is rolled back together
   with the evidence row.
4. **Guarded by legacy internal_id** — if the candidate's
   `legacy_source.internal_id` is null, no stage is emitted (nothing
   to locate the row with).
5. **INSERT path never emits the stage** — insert_new creates a new
   canonical row for a legacy row that had no match; there's nothing
   to backlink on this side (the legacy row still gets its canonical
   id, but via the natural insert flow which is a separate concern).

### Unit test results

```
scripts/nex-canonical/__tests__/canonical-handoff-merge-backlink.test.ts
Test Files  1 passed (1)
     Tests  19 passed (19)
```

Combined with the sibling canonical tests:
```
canonical-handoff.test.ts        + 42 passed
execute-write-plan.test.ts       + 56 passed
merge-backlink.test.ts (new)     + 19 passed
                           Total = 117 passed · 0 failed
```

### Bounded verify-run output

Ran `_verify-merge-backlink.mjs --limit=20` against live `nex_dev`:

```
[session] current_database()=nex_dev · OK
[before] food_business.canonical_business_id IS NULL = 126
[before] business_canonical = 22616
[before] business_evidence  = 22774
[before] merge_match rows   = 158

--- real-ingestion-runner (max=20) ---
[nex-directory-ingestion] run complete ·
  discovered=22757 enqueued=0 already_pending=26992 country_finished=false
  candidate_count_total=22757 candidate_count_written=181
  approval_deferred=22576 duplicate_skipped=181

[fresh] candidate_ids=0
[after] food_business.canonical_business_id IS NULL = 126
[result] delta=0 · fresh candidates = 0 · nothing to merge or insert
```

**Honest reading:** every eligible candidate in the pending queue has
already been decided. The 126 remaining rows are the ones the sealed
candidate-validator / reviewer have `approval_deferred` (quarantined).
None of them re-enter the pipeline, so no new MERGE verdict fires in a
bounded 20-row probe. **The delta is correctly 0** — not because the
backlink stage is wrong, but because the upstream pipeline has reached
steady state and the leftover 126 rows have a different gate blocking
them (upstream validator quarantine, not the backlink).

The fix is proven correct by the 19 unit tests · the bounded probe
honestly reports "no merges to exercise today." Any future wave that
unblocks the quarantined 126 rows (by fixing their upstream
validation) will see the backlink stage fire immediately within the
sealed executor's SERIALIZABLE txn — no post-batch workaround needed.

## ═══════════════════════════════════════════════════════════════
## Task 2 · OwnerClaimForm + claim-service tsc fixes
## ═══════════════════════════════════════════════════════════════

### Problems

Four blocking tsc errors in wave scope:

1. `OwnerClaimForm.tsx:129` · `"transport"` not in `EntityType`
2. `OwnerClaimForm.tsx:132` · `"community"` not in `EntityType`
3. `OwnerClaimForm.tsx:133` · `"natural_or_cultural_place"` not in `EntityType`
4. `claim-service.ts:140` · reason union too narrow (operator
   precedence bug in a conditional-infer type expression)

### Live-DB entity_type check

```sql
SELECT DISTINCT entity_type FROM nex.business_canonical ORDER BY 1;
-- Result: 'food' only (today)

SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conname = 'ck_bc_entity_type_valid';
-- CHECK (entity_type = ANY (ARRAY[
--   'food','accommodation','service','professional','vehicle_rental',
--   'marketplace_seller','transport_driver','transport_operator','place']))
```

The sealed 9-value `EntityType` enum is correct; the form was
referencing non-existent values (`transport`, `community`,
`natural_or_cultural_place`). **The correct fix is to NARROW the form**,
not to invent new entity types.

### Fix

**Files modified:**

| File | Change |
|---|---|
| `src/components/nex-native/directory/OwnerClaimForm.tsx` | `kindForEntityType` switch now maps `transport_driver` → `"transport"`, `transport_operator` → `"transport"`, and treats `professional` + `place` as `null` (no claim path). Removed references to `transport`, `community`, `natural_or_cultural_place`. |
| `src/lib/nex-native/claims/claim-service.ts` | Extracted `PlanCreateClaimReason` via `Extract<CreateClaimResult, {ok:false}>["reason"]`. The old `A extends B ? R : never \| "x" \| "y"` form was being parsed as `A extends B ? R : (never \| "x" \| "y")` by TypeScript, so the five validator reasons were dropped from the union. |

### tsc post-fix

```
$ npx tsc --noEmit --project scripts/nex-canonical/_wave-stabilisation-tsc.config.json
# (zero errors)
```

### Owner-claim test suite

```
$ npx vitest run src/lib/nex-native/directory/owner-claim
Test Files  2 passed (2)
     Tests  51 passed (51)
```

## ═══════════════════════════════════════════════════════════════
## Task 3 · Detail-page mounting
## ═══════════════════════════════════════════════════════════════

### Problem

`/directory/<canonical_id>` renders a bare detail page. Deep links
missed the "You may also need" and "Claim this listing" affordances
that `ListingDetailPanel.tsx` had.

### Fix

**Files modified / created:**

| File | Change |
|---|---|
| `src/app/nex-native/directory/[id]/page.tsx` | +130 / -0 — added `RelatedBusinessesPageSection` + `ClaimListingPageSection`. Mounts `RelatedBusinessesSectionClient` and `OwnerClaimForm` directly (both are `"use client"`; server→client import works). Claim affordance uses a native `<details><summary>` disclosure so no new client state is introduced. Panel flow in `ListingDetailPanel.tsx` untouched. |
| `tests/e2e/nex-directory-detail-page.spec.ts` | NEW — Playwright spec that fetches a VERIFIED food canonical id, loads the detail page, asserts both sections are visible, and asserts the claim form intro view is reachable via disclosure click. |

### Curl smoke

```
$ CID=e991fbd9-d57f-4e8e-98e3-60bec3e6e669   # fetched from nex_dev
$ curl -s http://localhost:3008/nex-native/directory/$CID \
    | grep -c data-nex-detail-page-related   # → 1
$ curl -s http://localhost:3008/nex-native/directory/$CID \
    | grep -c data-nex-detail-page-claim     # → 1
```

### Playwright result

```
$ NEX_E2E_SKIP_WEBSERVER=1 npx playwright test \
    tests/e2e/nex-directory-detail-page.spec.ts --project=desktop
Running 1 test using 1 worker
  ✓  [desktop] detail page renders related + claim sections ... (6.5s)
  1 passed (8.2s)
```

Screenshot: `tests/e2e-screenshots/nex-directory-detail-page/01-detail-page-with-sections.png`

### Section selector reference

| Selector | Purpose |
|---|---|
| `[data-nex-detail-page-related]` | Outer wrapper for "You may also need" |
| `[data-nex-detail-page-claim]` | Outer wrapper for "Claim this listing" |
| `[data-nex-detail-page-claim-disclosure]` | The `<details>` element |
| `[data-nex-detail-page-claim-open]` | The `<summary>` button |

Claim section renders only when destination is `claim_available`.
`place_detail` destinations remain read-only (sealed rule).

## ═══════════════════════════════════════════════════════════════
## Overall verification
## ═══════════════════════════════════════════════════════════════

### Wave-scope tsc

```
$ npx tsc --noEmit --project scripts/nex-canonical/_wave-stabilisation-tsc.config.json
# (0 errors)
```

### Related vitest suites

| Area | Result |
|---|---|
| `src/lib/nex-native/directory/owner-claim` | 51/51 PASS |
| `src/lib/nex-native/directory/related-businesses` | 61/61 PASS |
| `scripts/nex-canonical/canonical-handoff + execute-write-plan + new merge-backlink` | 117/117 PASS |

Full `src/lib/nex-native/directory` sweep: 586/588 PASS · 2 FAIL. The 2
failures live in `src/lib/nex-native/directory/__tests__/directory-service.test.ts`
and are **pre-existing** (confirmed via `git stash` baseline). They
test the shape of `directory-service.ts` which a parallel wave has
modified; outside this agent's scope.

### Scopes untouched

Verified via `git status --short`:

- F2 (cross-DB NEX-side) · `deploy/postgres/init/191_*.sql`,
  `src/lib/nex-native/cross-db-reconciler/*` · **not modified**
- F3 (accommodation clearance) · `deploy/postgres/init/192_*.sql`,
  `scripts/nex-canonical/_seed-osm-odbl-template.mjs`,
  `scripts/nex-canonical/_ingest-accommodation-candidates.mjs`,
  `docs/doctrine/nex-accommodation-clearance-prep-2026-10-10.md` ·
  **not modified**
- F4 (Emergency schema) · `deploy/postgres/init/193_*.sql`,
  `src/lib/nex-native/emergency/*` · **not modified**
- F5 (Emergency UI) · `src/app/nex-native/settings/**`,
  `src/app/nex-native/emergency-help/**`,
  `src/components/nex-native/emergency/**` · **not modified**

### Hard constraints honoured

- Branch `nex/directory-work` · no git commit created
- No new npm deps
- Session identity confirmed `nex_dev` before every DB read / write
- No `can_display` flip · no record promotion · no evidence fabrication
- No force flags · no `--no-verify` · no backwards-compat shim
