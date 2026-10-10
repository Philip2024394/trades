# NEX Directory · Accommodation Clearance Prep · 2026-10-10

**Authored by** · F3 agent (Accommodation Clearance Prep)
**Branch** · `nex/directory-work`
**Status** · Prep artefacts landed · publication activation NOT authorised
**Scope** · Accommodation vertical only (`nex_accommodation_business_legacy`)

## Purpose

Prepare — but do NOT execute — the publication of accommodation listings
in `nex.business_directory_v`. The F3 wave delivers the artefacts an
operator needs to make an informed activation decision:

1. A reviewable catalog of candidate attribution templates (migration 192).
2. A clearance-prep-scoped discovery-only ingestion wrapper.
3. A read-only publication dry-run that answers "how many rows would
   become visible if we flipped `can_display = TRUE` right now?"
4. This doctrine note describing remaining founder blockers and the
   three-step activation runbook.

The F3 wave does NOT flip `can_display`, does NOT write to
`nex.source_registry`, does NOT promote any canonical to `VERIFIED`,
and does NOT run `bulk-approve-runner` or `write-approved-candidates`.

## 1 · Current state

| Fact | Value |
|---|---|
| Legacy table | `nex.accommodation_business` |
| Row count | **9,230** (all `country = 'ID'`) |
| Source `source_id` | `nex_accommodation_business_legacy` |
| Source registry row | present (migration 185) |
| `can_derive` | TRUE (migration 185) |
| `can_display` | **FALSE** (publication blocked) |
| `attribution_required` | TRUE |
| `attribution_template` | **NULL** on `source_registry` |
| Candidate eligibility | 100% (per vertical audit, 2026-10-10) |
| Category-detail mapping | READY (sealed adapter) |
| Source provenance | `osm_overpass` 9,206 rows + `osm_overpass_via_lab` 24 rows |

Pre-F3 directory state (confirmed via live probe, nex_dev):

```
nex.business_canonical          · 22,616 rows (all entity_type=food)
nex.business_directory_v        · 22,615 rows visible
nex.business_evidence (source=accommodation) · 0 rows
```

## 2 · Attribution templates seeded (migration 192 result)

Migration 192 creates a NEW table `nex.attribution_template` that acts
as a reviewable staging catalog, **separate from and non-authoritative
against** the sealed `nex.source_registry.attribution_template` column
(migrations 180 + 181 + 182).

The catalog was authored because the publication gate consults
`source_registry.attribution_template` directly — any non-blank value on
that column admits publication the next time D-5 evaluates. There is no
"pending review" state on the sealed column. The migration-192 catalog
gives the operator a space where candidate wordings can be drafted,
reviewed, revised, and marked approved (`simulated = FALSE`) without any
risk of accidental publication.

Applied via `scripts/nex-canonical/_apply-migration-192.mjs --apply` on
2026-10-10 against `nex_dev`.

Seeded rows (all `simulated = TRUE`):

| template_id | display_short | license |
|---|---|---|
| `osm_odbl_v1` | `© OpenStreetMap contributors` | ODbL 1.0 |
| `osm_cc_by_sa_v1` | `© OpenStreetMap contributors (CC-BY-SA 2.0 legacy)` | CC-BY-SA 2.0 |
| `openstreetmap_contributor_v2` | `© OpenStreetMap contributors` | OSMF guidance (`openstreetmap.org/copyright`) |
| `osm_derived_via_overpass_v1` | `Derived from OpenStreetMap contributors (ODbL)` | ODbL 1.0 · reduced-field distribution · requires `source_reference` substitution |

Verification:

```
SELECT template_id, simulated, license_name
  FROM nex.attribution_template
 ORDER BY template_id;
```

Expected: four rows, every row `simulated = TRUE`.

Structural test · 22 assertions · passes via:

```
npx vitest run --config scripts/nex-canonical/vitest.local.config.ts \
  scripts/nex-canonical/migration-192.test.ts
```

## 3 · Discovered-only ingestion test

Wrapper · `scripts/nex-canonical/_ingest-accommodation-candidates.mjs`.

The wrapper enforces:
- clearance-prep-scoped generation-run-id prefix (`clearance-prep-accommodation-<iso>`)
- clearance-prep-scoped pending queue / decision / checkpoint files
- `--limit` ceiling of 100 for live runs (dry-runs may probe larger)
- discovery-only guarantees from the sealed `_vertical-ingestion-core.ts`

Dry-run (2026-10-10, nex_dev):

```
discovered_count = 0
enqueued_count = 0
runtime_notes = ["dry-run"]
pending_queue_lines_before/after = 0/0
```

Live run (2026-10-10, nex_dev, `--limit=100`):

```
discovered_count = 100
enqueued_count = 100
already_pending_count = 0
candidate_count_by_outcome = { approval_deferred: 100 }
pending_queue_lines_before/after = 0/100
```

Pending queue · `data/nex-canonical/pending-review-accommodation-clearance-prep.jsonl`
· 100 lines added · zero duplicates skipped on first run.

Confirmed invariants during + after the live run:
- `nex.business_canonical` row count unchanged (22,616 → 22,616)
- `nex.business_directory_v` row count unchanged (22,615 → 22,615 · publication gate honoured)
- `nex.business_evidence` rows for `nex_accommodation_business_legacy` unchanged (0 → 0)
- `nex.source_registry.can_display` unchanged (`FALSE`)

## 4 · Publication dry-run

Script · `scripts/nex-canonical/_accommodation-publication-dry-run.mjs`.

READ-ONLY simulation of the sealed publication gate (migrations 175 +
181) with two targeted substitutions on the accommodation
`source_registry` row:

- `can_display → TRUE`
- `attribution_template → osm_odbl_v1.display_short = '© OpenStreetMap contributors'`

Everything else — D-1 lifecycle set, supersession guard, D-2 chain-walk,
D-5 attribution-present predicate — uses the real schema and real data.

Point-in-time answer (2026-10-10, nex_dev):

```
eligible_accommodation_IF_flipped_now = 0
```

**Why zero?** The F3 wave only runs discovery-only ingestion. The 100
candidates landed in `pending-review-accommodation-clearance-prep.jsonl`
and are NOT in `business_canonical`. Promotion from the pending queue to
`business_canonical` + `business_evidence` is a downstream operator-
attested action (`bulk-approve-runner` or founder review) that F3 does
NOT execute. Once that review runs, the eligible count rises; the
asymptotic ceiling is **9,230** (the row count of the legacy table).

Side-check captured by the dry-run:
- template `osm_odbl_v1` present in catalog · `simulated = TRUE`
- source registry row `nex_accommodation_business_legacy` present · `can_display = FALSE`
- business_directory_v real count: 22,615 (unchanged by dry-run)
- legacy ceiling: 9,230

No FAIL marker was raised — the attribution template referenced is
present in the catalog. If a future run cites a template not present in
the catalog, the dry-run exits non-zero so the operator fixes it before
activation.

## 5 · Remaining blockers before publication

The following items are strictly OUTSIDE F3's scope and must be cleared
before any `can_display = TRUE` flip:

1. **Founder sign-off on `osm_odbl_v1` wording**
   Currently simulated. Expected UPDATE after legal review:
   ```
   UPDATE nex.attribution_template
      SET simulated = FALSE
    WHERE template_id = 'osm_odbl_v1';
   ```
   (Or whichever template wording the founder approves.)

2. **Founder review of 24 `via_lab` provenance rows**
   Per the Clearance Paths doctrine (R-A3): 24 rows in
   `nex.accommodation_business` carry `source = 'osm_overpass_via_lab'`
   suggesting an internal processing lab step. Confirm this did not
   strip ODbL metadata. Quarantine or re-tag before publication.

3. **Attribution rendering integration into card UI**
   The sealed `business_directory_attribution_v` (migration 181) emits
   `(canonical_business_id, source_id, text)` rows. The listing card
   must render `text` next to each business (e.g. a `©` chip or a
   per-page credits block). This UI is NOT yet wired in the F3 scope.

4. **Founder authorisation to flip `can_display = TRUE`**
   The single UPDATE statement that activates publication (see runbook
   below). F3 explicitly does not apply this.

5. **Candidate promotion into `business_canonical`**
   The 100 candidates in `pending-review-accommodation-clearance-prep.jsonl`
   stay in the queue until an operator-attested review path promotes
   them. Even with `can_display = TRUE`, zero rows would be visible
   until promotion begins. The ceiling is **9,230**; the floor is
   **0** until review starts.

## 6 · Activation runbook (three steps)

Once blockers 1–5 above are cleared, activation is three statements:

### Step 1 · operator approves the attribution template

```
UPDATE nex.attribution_template
   SET simulated = FALSE
 WHERE template_id = 'osm_odbl_v1';
```

Then verify:

```
SELECT template_id, simulated FROM nex.attribution_template
 WHERE simulated = FALSE;
```

### Step 2 · operator writes the sealed `source_registry` column + flips the gate · ONE atomic statement

```
BEGIN;
  UPDATE nex.source_registry
     SET attribution_template = (
           SELECT display_short
             FROM nex.attribution_template
            WHERE template_id = 'osm_odbl_v1'
              AND simulated = FALSE
         ),
         can_display = TRUE
   WHERE source_id = 'nex_accommodation_business_legacy';
COMMIT;
```

Note · the sealed `ck_sr_attribution_template_present` CHECK (migration
180) refuses the flip if `attribution_template` is blank. Doing both
columns in one UPDATE is required.

### Step 3 · verify the first 50 accommodation listings appear in `business_directory_v` within 60 seconds

```
SELECT entity_type, COUNT(*) AS visible
  FROM nex.business_directory_v
 GROUP BY entity_type
 ORDER BY visible DESC;

SELECT canonical_business_id, name_canonical, city
  FROM nex.business_directory_v
 WHERE canonical_business_id IN (
   SELECT be.canonical_business_id
     FROM nex.business_evidence be
    WHERE be.source_id = 'nex_accommodation_business_legacy'
 )
 LIMIT 50;
```

If no rows appear and `business_canonical` still has zero accommodation
rows: promotion from the pending-review queue has not yet run.

## 7 · Rollback

The flip is instantly reversible:

```
UPDATE nex.source_registry
   SET can_display = FALSE
 WHERE source_id = 'nex_accommodation_business_legacy';
```

Listings disappear from `business_directory_v` on the next SELECT (the
view is non-materialised; migration 181 confirms). No row data is
lost · only the view predicate flips. No cascade effects on
`business_canonical`, `business_evidence`, or any downstream card
component — the removal is purely a visibility change.

`attribution_template` can be left in place or cleared:

```
UPDATE nex.source_registry
   SET attribution_template = NULL
 WHERE source_id = 'nex_accommodation_business_legacy';
```

Clearing the template is only required if the operator wants to
re-stage the wording for another review. The CHECK is satisfied once
`can_display = FALSE`.

## 8 · Files landed by this wave

| File | Role |
|---|---|
| `deploy/postgres/init/192_nex_osm_odbl_attribution_template.sql` | New catalog table + four seeded templates (`simulated = TRUE`) |
| `scripts/nex-canonical/_apply-migration-192.mjs` | Identity-gated idempotent applier (verify / --apply) |
| `scripts/nex-canonical/migration-192.test.ts` | 22-assertion structural test · follows `migration-182.test.ts` convention |
| `scripts/nex-canonical/_ingest-accommodation-candidates.mjs` | Clearance-prep-scoped discovery-only wrapper (`--limit` ceiling 100 for live) |
| `scripts/nex-canonical/_accommodation-publication-dry-run.mjs` | Read-only simulation of the sealed publication gate |
| `docs/doctrine/nex-accommodation-clearance-prep-2026-10-10.md` | This note |

## 9 · What F3 did NOT touch

- The sealed source adapter `scripts/nex-canonical/source-legacy-accommodation-business.ts`
- The sealed `_vertical-ingestion-core.ts` and `_vertical-ingestion-runner.ts`
- The sealed `directory-ingestion-runner.ts` (food reference pattern)
- The sealed `nex.source_registry` row for accommodation
- The sealed `nex.business_directory_v` view
- Migrations 185–188 (vertical source registrations)
- Any F1 / F2 / F4 / F5 agent scope
- Any owner-claim, related-businesses, or cross-DB reconciler surface

The scope is strictly: author one additive migration, two run scripts,
one structural test, and this prep summary. No row's `can_display` was
flipped. No candidate was promoted to VERIFIED. No founder authority
was asserted beyond the published prep artefacts.
