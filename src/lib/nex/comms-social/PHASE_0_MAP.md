# Phase 0 · Foundation + Enforcement

**Scope:** the minimum footprint that proves tenant isolation · adapter isolation · Predictive isolation · role boundary · audit foundation are mechanically enforceable.

**Explicitly out-of-scope for Phase 0:** content generation · OAuth · publishing · analytics · autonomous posting · merchant UI · HQ mission-control UI · providers.

## What lands in Phase 0

| # | Artifact | Purpose |
|---|---|---|
| 1 | Namespace `src/lib/nex/comms-social/` | Home for the Comms Centre Social Engine (distinct from Hammerex `src/lib/nex/social/`) |
| 2 | Migration `deploy/postgres/init/029_comms_social_foundation.sql` | Base tables · RLS default-deny · admin_read wrapper · roles |
| 3 | `types.ts` | Shared types (TenantId, SocialAccount stub, PublishIntent stub, canonical enums) |
| 4 | `db.ts` | Tenant-scoped query helpers (`withTenantClient`) — every query MUST take tenant_id |
| 5 | `adapters/interface.ts` | The `SocialProvider` interface + capability shape · the ONLY shape the engine sees |
| 6 | `adapters/simulator.ts` | The single Phase-0 adapter · in-memory · no external calls · used for tests |
| 7 | `audit.ts` | Emit rows to `nex.social_audit_events` (append-only INSERT-only) |
| 8 | `roles.ts` | Role enum + permission-check helpers (`canEnableAutomatic`, `canConnectAccount`, etc.) |
| 9 | `controls.ts` | Global kill-switch state read/write (singleton row) |
| 10 | `scripts/verify-comms-social-boundaries.mjs` | Pre-commit/CI enforcement script — greps for forbidden imports; exit 1 on violation |
| 11 | `tests/tenant-isolation.test.mjs` | Proves at DB level that Tenant A cannot read/write/update/delete Tenant B's rows |
| 12 | `tests/adapter-isolation.test.mjs` | Proves no non-adapter file imports a provider SDK |
| 13 | `tests/predictive-boundary.test.mjs` | Proves no comms-social file imports Predictive |
| 14 | `tests/role-permission.test.mjs` | Proves the role-permission helpers reject unauthorised actions |
| 15 | `tests/admin-audit.test.mjs` | Proves `admin_read` wrapper writes an audit row and RLS blocks direct cross-tenant reads outside the wrapper |
| 16 | `PHASE_0_EVIDENCE.md` | Report of test outcomes · created at end of Phase 0 |

## Enforcement layers (three, redundant)

1. **DB layer** — RLS default-deny on every `nex.social_*` table · `admin_read()` wrapper as only cross-tenant path · schema-level constraint on rights_status etc.
2. **CI layer** — `verify-comms-social-boundaries.mjs` script scans for forbidden imports (Hammerex `../social/`, `@/lib/supabaseAdmin`, `@/lib/nex/predictive/**`, provider SDKs outside `adapters/`). Failing = exit 1.
3. **Runtime layer** — `withTenantClient(tenant_id, fn)` requires tenant_id at call site; missing = TypeScript error.

## Stop conditions

Any of the following triggers a §23 STOP AND REPORT:

- RLS test fails to prove cross-tenant deny.
- CI enforcement script fails to detect a forbidden import.
- Any provider SDK can be reached from outside `adapters/`.
- Any Predictive import possible from `comms-social/**`.
- Role helper permits an unauthorised action.

## Success criteria for Phase 0

- All 5 test suites (11-15 above) pass.
- Boundary-verification script exits 0 on the current tree, exits 1 if a forbidden import is introduced.
- `PHASE_0_EVIDENCE.md` documents test outcomes with actual PG output.
- Seven v1.0.0 frozen interface hashes still match manifest.

Then Phase 1 (OAuth + accounts) may begin — not before.
