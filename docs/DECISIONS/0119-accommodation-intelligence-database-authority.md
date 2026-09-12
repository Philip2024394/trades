# ADR-0119 · Accommodation Intelligence Database Authority
**Status**: ACCEPTED · **Date**: 2026-09-07 · **Author**: Philip

## Context

NEX operates two distinct persistence tiers today:

1. **Supabase Project B** (`ijvqdvsvwtwxzcqmoqit`) — the sole NEX
   application/Social/Auth authority. Established by the NEX Supabase
   Authority Reset (2026-09-07 · doctrine_nex_authority_y_p2_foundation).
   Currently hosts: `hammerex_nex_users`, and — subject to a separately
   authorized migration — the Y-P3 friend edge + private data tables.

2. **Local PostgreSQL 17** at `localhost:5433` · database `nex_dev` — hosts
   the NEX Accommodation Intelligence system. `nex.accommodation_business`
   plus its four companion tables (source_snapshot, field_provenance,
   enrichment_evidence, recovered_evidence column) plus the Workforce v2
   persistence boundary (`nex_workforce.*` schema · evidence_record ledger,
   candidate_staging, persist_batch generic wrapper, city_catalogue, job
   registry, work_item queue, rotation_eligible view, role-based persister
   isolation). 9,203 accommodation rows already exist here historically.

Slice A2 (2026-09-07) adds the real `nex_workforce.persist_to_accommodation_business`
function and the `nex_workforce_persister_accommodation_business` role.
Both live on local PG :5433. Slice A2 does NOT create any accommodation
footprint on Project B.

The audit that preceded A2 authorization surfaced an ambiguity: because the
NEX Supabase Authority Reset established Project B as "the sole NEX Supabase
authority," a naive reading would demand accommodation migrate to Project B.

## Decision

**NEX Accommodation Intelligence remains on the existing local PostgreSQL
`nex_dev` database during the Workforce v2 acquisition build.**

Supabase Project B remains the sole NEX application/Social/Auth authority.
Accommodation intelligence data is NOT migrated to Project B as part of A2.

This gives a clean, explicit two-tier separation:

```
NEX PRODUCT · SOCIAL · AUTH · FRIENDS · PRIVATE DATA
              │
              ▼
    Supabase Project B (ijvqdvsvwtwxzcqmoqit)


NEX ACCOMMODATION INTELLIGENCE · WORKFORCE v2 · ACQUISITION
              │
              ▼
    PostgreSQL :5433 · nex_dev
              │
              ├── nex.accommodation_business (canonical)
              ├── nex.accommodation_business_source_snapshot (raw evidence)
              ├── nex.accommodation_business_field_provenance (per-field trust)
              ├── nex.accommodation_enrichment_evidence (candidate evidence)
              ├── nex_workforce.evidence_record (immutable ledger)
              ├── nex_workforce.persist_to_accommodation_business (Slice A2)
              └── nex_workforce_persister_accommodation_business (role)
```

## Rationale

- **Zero-migration principle**: 9,203 accommodation rows already live on
  local PG. Migrating them to Project B without a business need would risk
  data integrity, alter operational latency characteristics, and consume
  Project B's Supabase quotas for data that does not need to be there.
- **Workforce v2 was designed for this DB**: `nex_workforce.*` schema, role
  hierarchy, persister boundary, and food_business persister already work
  on local PG. Splitting the accommodation persister across a different
  database would violate the "same persistence boundary" invariant that
  makes v2 safer than the quarantined P1 launcher.
- **Separation of concerns**: NEX-user-facing data (auth, friends, private)
  has fundamentally different access patterns (RLS-heavy, per-user, small
  rows, low throughput) than acquisition-workforce data (bulk write,
  eventual-consistent, large rows, high throughput). Two databases with
  distinct authorities is a reasonable operational shape.
- **P1 quarantine holds**: this ADR does NOT unquarantine P1. It merely
  states where the newer v2 persister writes.

## What this ADR does not authorize

- Migration of accommodation data to Project B (would require a separately
  authorized slice with schema + RLS + storage + capacity + performance +
  rollback + data-integrity proofs)
- Any acquisition activation
- Any 518-city seeding
- Any Overpass HTTP calls
- Any change to the `NEX-Acquisition-Workforce` Windows Scheduled Task
- Any change to the P1 quarantine
- Any additional persister function beyond `persist_to_accommodation_business`
- Any change to Project B's schema, roles, or RLS policies

## Consequences

- **Positive**: Existing accommodation infrastructure (9,203 rows, 4 tables,
  identity resolver, location intelligence, recovered evidence) is preserved
  and immediately usable by the new persister. Workforce v2 pattern extends
  cleanly to accommodation without cross-database orchestration.
- **Positive**: The doctrinal "NEX Supabase = Project B" invariant is
  preserved for the application layer where it matters (auth, users,
  friends, private data).
- **Trade-off**: NEX now runs against two distinct Postgres endpoints in
  production. Operators must maintain both. Backup, disaster recovery, and
  monitoring dashboards must cover both.
- **Trade-off**: Cross-tier queries (e.g., "which NEX users have interacted
  with which accommodation properties") require application-layer join, not
  a SQL join. This is acceptable because the two tiers have fundamentally
  different access models.

## Future migration path (if ever authorized)

If a future business need requires migrating accommodation intelligence to
Project B, the required slice must include:

1. **Schema**: full application of migrations 078, 079, 081, 087, 088, 106,
   114, plus the A2 persister migration, plus any A3-A9 schema additions,
   into a Project B schema (likely renamed `nex_accommodation` to avoid
   colliding with the `nex` schema convention Project B currently uses).
2. **RLS**: full policy audit — Project B enforces RLS by default; the
   local PG relies on role isolation which does NOT translate directly.
3. **Storage capacity**: 9,203 rows + snapshots + evidence + provenance is
   modest but not trivial once B is loaded up with millions of Y-P3
   ciphertext blobs.
4. **Rollback**: dual-write shadow period, then hard cutover, then
   deprecation of local PG accommodation tables.
5. **Data integrity**: byte-for-byte proof that every row (and its evidence
   history) round-trips.

None of the above is authorized by this ADR.

## Related

- doctrine_nex_authority_y_p2_foundation_2026_09_07 · NEX Supabase Authority Reset
- **docs/doctrine/nex_accommodation_intelligence_agent_world_class_doctrine_2026_09_07.md** · The world-class doctrine that governs A3-A9 (canonical model, entity resolution, evidence/verification/confidence, freshness/change detection, image intelligence, controlled acquisition, 518-city rotation). Establishes the "Accommodation Intelligence Agent, not crawler" principle.
- deploy/postgres/init/078_nex_accommodation_business.sql · original accommodation schema
- supabase/migrations/_slice_a2_accommodation_business_persister.sql · A2 real persister
- scripts/nex-workforce-v2/PERSISTER-INTEGRITY.md · fail-closed invariants
- Slice A2 contract test suite · scripts/nex-workforce-v2/tests/accommodation_persister_contract.test.mjs
