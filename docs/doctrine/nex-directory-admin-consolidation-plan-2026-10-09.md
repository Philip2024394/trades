# NEX Directory · Admin Consolidation Plan · 2026-10-09

**Status:** Design proposal (next-run implementation).
**Scope:** Workstream D-1 of the directory completion ledger.

## Context

The directory-related admin surfaces are currently split across many pages.
Each was authored for a specific pre-spine purpose. With the sealed canonical
spine (migrations 166-183) now in place, we have the opportunity — and the
need — to consolidate curator operations into one coherent surface that
reads/writes the sealed primitives, not legacy per-vertical tables.

## Current state inventory

Enumerated by walking `src/app/nex-head-quarters/*` (excluding non-directory
surfaces like audit, calling, agents, chat, email, etc.):

| Admin surface | Reads | Writes | Spine coverage |
|---|---|---|---|
| `/nex-head-quarters/directory` | legacy food_business + accommodation_business + mp_seller + 6 service subtypes | — | pre-spine |
| `/nex-head-quarters/directory-factory` | nex.category_candidate (migrations 083-086) | approve/reject candidates | pre-spine (taxonomy) |
| `/nex-head-quarters/food-ops` + `promotion-queue` | nex.food_business WHERE claim_status | promote: claim_status='discovered'→'listed' | pre-spine (food-only) |
| `/nex-head-quarters/claim-review` | nex.food_claim_code (migration 058) | admin claim verify | pre-spine (food-only) |
| `/nex-head-quarters/discovery` | multi-table discovery rotation | — | pre-spine |
| `/nex-head-quarters/media` | nex.business_image + nex.media_object | approve media | pre-spine (polymorphic by business_type) |
| `/nex-head-quarters/image-intake` | nex.business_image awaiting approval | approve/reject per-image | pre-spine |

**Common pattern:** each surface reads its own table directly, applies its own
business logic, and writes its own narrow mutation. No surface reads the
sealed `nex.business_canonical` or `nex.business_evidence`.

## Target architecture

**One unified `/nex-head-quarters/directory-review` surface.** Reads the sealed
primitives directly. Composes legacy curator operations as sub-flows WITHOUT
duplicating their underlying DB access.

### Reader surface

```
/nex-head-quarters/directory-review

  ├─ Tab: Pending canonicals          (reads nex.business_canonical WHERE lifecycle_state IN ('DISCOVERED','ENRICHED'))
  ├─ Tab: Open fact conflicts         (reads nex.business_fact_conflict WHERE resolution_state='OPEN')
  ├─ Tab: Pending media               (reads nex.business_media WHERE approved=false)
  ├─ Tab: Pending claims              (reads nex.business_claim WHERE state='PENDING')
  ├─ Tab: Source policy               (reads nex.source_registry; admin can view can_display state)
  └─ Tab: Lifecycle audit             (reads nex.business_canonical_lifecycle_log)
```

Each tab is a thin reader over the sealed primitive — no fallback to legacy
tables. Row counts come from the sealed primitives only. Rows link to a
detail view that composes all evidence + media + conflict + claim rows for
one canonical.

### Writer surface

The writer surface is **small and intentional**:

- **Promote lifecycle state** — reads `business_canonical`, writes
  `business_canonical.lifecycle_state` + inserts `business_canonical_lifecycle_log`
  row in one transaction. Promotion from `DISCOVERED` → `ENRICHED` → `VERIFIED`
  → `OWNER_VERIFIED` requires admin.
- **Resolve fact conflict** — reads `business_fact_conflict`, writes
  `resolution_state` + `resolution_choice` + optional canonical UPDATE
  (if resolution_choice is `left` or `right`).
- **Approve/reject media** — reads `business_media`, writes `approved` boolean.
- **Verify/revoke claim** — reads `business_claim`, writes via the claim
  service module (`src/lib/nex-native/claims/claim-service.ts` from this run).
- **Flip source `can_display`** — reads `source_registry`, writes `can_display`
  per source (A-3 wave authorisation required; separate migration).

### Legacy coexistence rules

- `/nex-head-quarters/directory` (legacy multi-table view) stays operational
  as a read-only legacy surface for pre-canonical-backfill transparency.
- `/nex-head-quarters/food-ops` + `claim-review` + `image-intake` stay
  operational until their equivalent flow in `/directory-review` is tested
  on real data. After that: deprecate (header banner) → remove (next release).
- `/nex-head-quarters/directory-factory` keeps its taxonomy-candidate
  responsibility. It is NOT subsumed; the new surface focuses on
  **canonical business** curation, not **category taxonomy** curation.

## Why not touch the legacy surfaces in this run

- The orchestrator rule "do not delete functioning legacy admin before
  replacement is tested" applies.
- The sealed primitives are not yet applied to the live DB. A new UI reading
  tables that don't exist yet would be dead code.
- The admin consolidation is an iterative replacement, not a big-bang swap.

## Next-run work

1. Author `src/app/nex-head-quarters/directory-review/page.tsx` scaffold with
   6 tabs (pending canonicals, open conflicts, pending media, pending claims,
   source policy, lifecycle audit). All read-only in this scaffold.
2. Author the data-access modules per tab in `src/lib/nex-hq/directory-review/`.
   Each module takes a `pg Pool` and reads one sealed primitive.
3. Author the writer surfaces as separate client modules, each importing the
   corresponding service (claim service, lifecycle promoter, etc.).
4. Deprecate the legacy surfaces (banner at top of each page pointing at the
   new one) ONLY AFTER the new surface is wired to live data from applied
   migrations.

## Risk register

- **Permission split (DP-3).** The unified surface reads sealed primitives
  directly — it needs a role with direct SELECT on `nex.business_canonical`,
  `nex.business_evidence`, etc. The sealed `nex_directory_reader` role is
  REVOKED from those tables (migration 183). The admin surface must use a
  different role — proposal: `nex_directory_admin` with direct read access.
  Author migration 184 (admin role GRANT) in a separate wave.
- **Cross-DB admin.** When admin verifies a claim, the write path spans the
  Postgres canonical + the Supabase account. The cross-DB owner-link ADR
  (`docs/doctrine/adr-nex-cross-db-owner-link-2026-10-09.md`) governs this.
- **Audit history.** Every admin action on a canonical must write a
  `lifecycle_transition_log` row (migration 168) with
  `transitioned_by = 'admin:<id>'`. The surface must enforce this invariant;
  dropping an action without a log entry is a sealed-doctrine violation.

## Acceptance criteria

The admin consolidation is complete when:

- A single `/directory-review` page exists at the admin surface.
- Every lifecycle promotion, conflict resolution, media approval, and claim
  verification goes through it OR through its backing service module.
- Legacy per-table admin surfaces are either read-only (deprecated banner)
  or removed.
- Every write produces a lifecycle_transition_log row.
- Every writer has test coverage against a disposable DB fixture.

Until all five hold, the consolidation is INCOMPLETE and the legacy
surfaces stay in-tree.
