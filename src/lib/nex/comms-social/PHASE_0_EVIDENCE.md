# Phase 0 · Evidence Report

**Date:** 2026-08-08
**Scope:** Foundation + enforcement for the NEX Comms Centre Social Engine at `src/lib/nex/comms-social/`.
**Status:** ✅ PHASE 0 COMPLETE.

## Success criteria (per PHASE_0_MAP.md)

| Criterion | Status |
|---|---|
| All boundary test suites pass | ✅ 4/4 suites · 28/28 assertions |
| Boundary-verification script exits 0 on clean tree, 1 on violation | ✅ verified in tests A4, P3 |
| PHASE_0_EVIDENCE.md documents test outcomes | ✅ this file |
| Seven v1.0.0 frozen interface hashes unchanged | ✅ verified `All 7 v1.0.0 hashes still match after Phase 0` |

## Test evidence

### tenant-isolation (DB layer · 10/10)

Proves at Postgres 17 with RLS + `nex_social_app` non-superuser role:

```
PASS T1 A reads own accounts · count=1
PASS T2 A cannot read B · count=0
PASS T3 A cannot INSERT into B · new row violates row-level security policy for table "social_accounts"
PASS T4 A cannot UPDATE B · rowCount=0
PASS T5 A cannot DELETE B · rowCount=0
PASS T6 Missing tenant GUC → zero rows · count=0
PASS T7a Admin bypass permits cross-tenant SELECT · count=1
PASS T7b Admin bypass does NOT permit cross-tenant INSERT
PASS T8 admin_read refuses empty reason · reason required for cross-tenant admin read
PASS T9 Boundary-3 audit row captured · resource=account_status_only
```

**Key finding:** RLS enforcement requires the connecting role to be non-superuser. The application MUST connect (or `SET LOCAL ROLE`) as `nex_social_app`. Superusers bypass RLS regardless of `FORCE ROW LEVEL SECURITY`. This is baked into `withTenantClient()` and `withAdminBypass()` at the runtime layer (`SET LOCAL ROLE nex_social_app` on every transaction).

### adapter-isolation (5/5)

```
PASS A1 boundary verifier passes on clean tree
PASS A2 SocialProvider interface complete
PASS A3 simulator exports SocialProvider factory
PASS A4 verifier detects provider-SDK outside adapters/
PASS A5 verifier green after cleanup
```

### predictive-boundary (4/4)

```
PASS P1 no predictive import in comms-social/**
PASS P2 no local-learning column patterns in comms-social/**
PASS P3 verifier catches synthetic predictive import
PASS P4 verifier green after cleanup
```

### role-permission (9/9)

```
PASS R1 permission matrix has every required role
PASS R2 SOCIAL_ACTIONS contains all required actions
PASS R3 nex_admin_publish documented as time-bounded
PASS R4 manage_roles is owner-only
PASS R5 staff cannot publish or enable Automatic
PASS R6 viewer restricted to read_analytics
PASS R7 nex_admin_support: read-only cross-tenant
PASS R8 nex_admin_publish: has administer_publish
PASS R9 permits() is default-deny
```

### Frozen v1.0.0 kernel hashes

`All 7 v1.0.0 hashes still match after Phase 0` — the 7 frozen interface files (delivery/types · analytics/types · compliance/types · alerts/types · composer/types · campaigns/types · segments/types) all match `docs/COMMUNICATIONS_CENTRE_v1.0.0_MANIFEST.json`.

## Charter compliance summary (S-I through S-XII)

| Invariant | Phase 0 status | Enforcement in place |
|---|---|---|
| S-I Tenant isolation | ✅ | RLS default-deny · six §0 boundaries · non-superuser role + tenant GUC · admin_read wrapper + audit |
| S-II Provider adapter isolation | ✅ | `adapters/` folder present · CI verifier rules R6 + import-lint · SocialProvider interface defined |
| S-III Content grounding | ⏳ Phase 2 · not in Phase 0 scope | n/a |
| S-IV Rights classification | ⏳ Phase 2 · not in Phase 0 scope | n/a |
| S-V Approval-default-ON | Partial · role scoping enforceable (permits/requirePermits helpers); pause propagation lands in Phase 4 | Phase 4 |
| S-VI One-way publishing | Structural · schema shape supports it; enforcement lands with worker (Phase 4) | Phase 4 |
| S-VII Idempotency two-phase | Structural · `nex.social_publish_intents` UNIQUE (tenant,post,platform,account,epoch) present · verify-loop lands in Phase 5 | Phase 5 |
| S-VIII Multi-stage safety | ⏳ Phase 3 · not in Phase 0 scope | Phase 3 |
| S-IX OAuth-only + encrypted tokens | Structural · columns exist (`access_token_dek_ref`, `access_token_ct`, `refresh_token_*`); real KMS wired in Phase 1 | Phase 1 |
| S-X Analytics grounded in providers | ⏳ Phase 7 · not in Phase 0 scope | Phase 7 |
| S-XI Business ROI via Attribution | ⏳ Phase 7 · not in Phase 0 scope | Phase 7 |
| S-XII Social 1.x does NOT consume Predictive | ✅ | CI verifier rule R3 · schema/code lint tests P1/P2 · no import path in comms-social |

Phase 0 delivers the foundation that MAKES the invariants enforceable. Full behavioural enforcement of every invariant lands progressively in Phases 1-9. No invariant is silently deferred; every one has a named phase where its enforcement lands.

## Doctrine faith kept

- No canonical documents touched (charter v0.1 · v1.0.5 architecture doc · Amendment #16 draft all unchanged).
- Predictive OBSERVATION mode active · zero imports · zero reads · zero writes.
- Hammerex Nex social module (`src/lib/nex/social/**`) untouched.
- 7 v1.0.0 frozen hashes unchanged.
- Zero code duplication with existing Nex subsystems: pg pool reused from `src/lib/nex/db.ts` · migration numbering sequential · RLS pattern mirrors existing convention.

## What is NOT delivered in Phase 0 (deliberate)

- No provider adapters beyond `simulator`.
- No OAuth flow.
- No content generation.
- No safety validators.
- No publishing worker.
- No merchant UI.
- No HQ mission-control panel.
- No analytics.
- No campaigns.
- No autonomous behaviour.

## Migrations landed

- `deploy/postgres/init/029_comms_social_foundation.sql` — tenants · role grants · accounts (shell) · publish_intents · audit events · controls (singleton) · admin_access_log · admin_readable_resource enum · RLS default-deny · admin_read() wrapper.
- `deploy/postgres/init/030_comms_social_app_role.sql` — non-superuser `nex_social_app` role with scoped grants (required for RLS to actually enforce against the application connection).

## Files landed

Runtime:
- `src/lib/nex/comms-social/README.md`
- `src/lib/nex/comms-social/PHASE_0_MAP.md`
- `src/lib/nex/comms-social/PHASE_0_EVIDENCE.md` (this file)
- `src/lib/nex/comms-social/types.ts`
- `src/lib/nex/comms-social/db.ts`
- `src/lib/nex/comms-social/audit.ts`
- `src/lib/nex/comms-social/roles.ts`
- `src/lib/nex/comms-social/controls.ts`
- `src/lib/nex/comms-social/adapters/interface.ts`
- `src/lib/nex/comms-social/adapters/simulator.ts`

Tests:
- `src/lib/nex/comms-social/tests/tenant-isolation.test.mjs`
- `src/lib/nex/comms-social/tests/adapter-isolation.test.mjs`
- `src/lib/nex/comms-social/tests/predictive-boundary.test.mjs`
- `src/lib/nex/comms-social/tests/role-permission.test.mjs`
- `src/lib/nex/comms-social/tests/run-all.mjs`

CI:
- `scripts/verify-comms-social-boundaries.mjs`

Total: 2 migrations · 10 runtime files · 5 test files · 1 CI script.

## Recommended next step

Phase 0 is complete. Phase 1 (OAuth + real accounts + KMS-wrapped tokens) may begin only after Philip's explicit greenlight. Nothing autonomously proceeds.
