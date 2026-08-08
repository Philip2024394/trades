# Phase 3 · Evidence Report

**Date:** 2026-08-08
**Scope:** Safety Validator Pipeline (Charter §S-VIII · Fact → Rights → Policy → Brand → Platform).
**Status:** ✅ PHASE 3 COMPLETE.

## Charter §S-VIII compliance summary

| Requirement | Phase 3 status |
|---|---|
| Fixed-order 5-stage pipeline | ✅ `[fact, rights, policy, brand, platform]` · order verified by test VP2 |
| Fail-closed on timeout · error · ambiguity | ✅ per-stage timeouts (default 500-2000 ms) · every stage wraps its work with `withTimeout` · exceptions caught in pipeline orchestrator and re-classed as `fail_closed` |
| Fail-closed on missing configuration | ✅ empty forbidden-claims list → policy `fail_closed` (VPO3) · missing brand profile → brand `fail_closed` (VB1) · unknown platform → platform `fail_closed` (VPL3) · zero source_refs → rights `fail_closed` (VR7) |
| Each stage independently enforced | ✅ five separate modules under `validators/` · no shared state · each declares its own `stage` field |
| Preserve rejection reasons + evidence | ✅ `StageRejection` shape: `{code, detail, offending_claim?, stage_specific?}` · every reject/fail persisted in `nex.social_validator_runs.stages` JSONB |
| Re-check Rights + Policy at T-adapter-call | ✅ `reCheckAtAdapterCall(tenant_id, subject)` runs only `[rights, policy]` · Phase 4 worker will call it before adapter dispatch |
| Do not trust generator's own output | ✅ Fact stage re-classifies the RENDERED text · does not consult `subject.claims` (VF5 proves it rejects when `claims=[]` but caption contains "guaranteed for life") |
| Maintain tenant isolation | ✅ every stage runs inside `withTenantClient` · RLS enforces DB-level · VP8 proves cross-tenant leak fails |
| No prediction · ranking · optimisation · learning | ✅ all stages rule-based · no historical-outcome learning · no ranking · no scoring above threshold-only checks · verified by predictive-boundary suite still passing |
| Reuse Phase 2 grounding, not duplicate | ✅ Fact stage wraps `classifyClaims` from `content/claims.ts` · no rules duplicated in validator code |

## Files added / changed

### Migration
- `deploy/postgres/init/033_comms_social_validators.sql` — three schema changes:
  - `nex.social_brand_profiles` (per-tenant tone · forbidden terms · required hashtags · required disclaimers · CTA defaults)
  - `nex.social_validator_runs` (INSERT-only audit · one row per pipeline execution · `stages` JSONB per-stage outcomes · `outcome` enum passed|rejected|failed_closed)
  - `nex.social_content_drafts` ALTER ADD `validator_run_id` FK
  - RLS default-deny + `nex_social_app` grants

### Runtime (8 new files)
- `validators/interface.ts` — `SafetyValidator` · `ValidatorSubject` · `StageResult` · `PipelineRun` · `DEFAULT_STAGE_TIMEOUTS_MS`
- `validators/fact.ts` — wraps `content/claims.classifyClaims` · re-classifies rendered text · does NOT trust subject's claims
- `validators/rights.ts` — re-queries `nex.social_content_sources` for every `source_ref` · six distinct rejection codes (`rights_source_missing` · `rights_source_ineligible` · `rights_source_inactive` · `rights_source_expired` · `rights_pii_no_release`) + `fail_closed` when zero refs
- `validators/policy.ts` — reads `data/nex-comms-social/forbidden-claims-v1.json` · empty list = `fail_closed`
- `validators/brand.ts` — reads `nex.social_brand_profiles` · whole-word forbidden term match · required hashtag enforcement · missing profile = `fail_closed`
- `validators/platform.ts` — reads adapter capabilities via `getAdapter(platform).capabilities()` · caption + hashtag caps enforced · unknown platform = `fail_closed`
- `validators/pipeline.ts` — orchestrator · runs stages in strict order · terminates on first non-pass · defensive try/catch treats thrown exceptions as `fail_closed` · persists run + updates `draft.validator_run_id` · exports `reCheckAtAdapterCall()` for Phase 4 hook
- `content/brand-profiles.ts` — brand profile CRUD

### API routes (3 new)
- `POST /api/nex/comms-social/content/brand-profiles` · upsert
- `GET  /api/nex/comms-social/content/brand-profiles?tenant_id=` · fetch
- `POST /api/nex/comms-social/content/validate` · run pipeline against draft OR ad-hoc subject
- `GET  /api/nex/comms-social/content/validator-runs?tenant_id=&draft_id=&limit=` · list

### Tests (6 new suites · 33 additional assertions)
- `validator-fact.test.mjs` (5/5) · adversarial: does NOT trust `subject.claims`
- `validator-rights.test.mjs` (7/7) · deletes/mutates source between generate and validate to trigger each rights rejection code
- `validator-policy.test.mjs` (4/4) · covers defence-in-depth vs Fact + empty-list fail_closed via source inspection
- `validator-brand.test.mjs` (5/5) · uses merchant-specific "wobbly" so Brand stage is exercised in isolation
- `validator-platform.test.mjs` (4/4) · over-limit caption + over-limit hashtags + unknown platform
- `validator-pipeline.test.mjs` (8/8) · order verification · reject-terminates · fail_closed marker · draft update · tenant isolation

## Database changes

| Table | Change |
|---|---|
| `nex.social_brand_profiles` | Created |
| `nex.social_validator_runs` | Created · INSERT-only |
| `nex.social_content_drafts` | Altered · added `validator_run_id` FK |

Zero changes to Phase 0-2 tables' existing columns.

## Test evidence (aggregate 115/115 assertions across 19 suites)

```
════════ SUMMARY ════════
  PASS tenant-isolation       · 10/10
  PASS adapter-isolation      · 5/5
  PASS predictive-boundary    · 4/4
  PASS role-permission        · 9/9
  PASS envelope-encryption    · 7/7
  PASS oauth-state            · 6/6
  PASS token-redaction        · 5/5
  PASS oauth-e2e              · 5/5
  PASS content-sources        · 9/9
  PASS claim-taxonomy         · 10/10
  PASS template-fill          · 6/6
  PASS grounding-validation   · 6/6
  PASS generation-e2e         · 5/5
  PASS validator-fact         · 5/5
  PASS validator-rights       · 7/7
  PASS validator-policy       · 4/4
  PASS validator-brand        · 5/5
  PASS validator-platform     · 4/4
  PASS validator-pipeline     · 8/8
```

## Adversarial / security evidence

### Rights re-check catches every mutation between generate and validate

Six proofs (VR2-VR6):
- **VR2** source deleted between generation and validation → `rights_source_missing`.
- **VR3** `rights_status` flipped from `owned` → `unknown` → `rights_source_ineligible`.
- **VR4** `active` flipped to `FALSE` → `rights_source_inactive`.
- **VR5** `expires_at` flipped to past → `rights_source_expired`.
- **VR6** `contains_identifiable_persons=TRUE` set without release evidence → `rights_pii_no_release`.
- **VR7** zero `source_refs` → `fail_closed` with `no source_refs supplied · cannot verify rights`.

### Fact stage does NOT trust the subject's own claim list

VF5 explicitly proves this: subject with `claims=[]` but caption `"guaranteed for life"` still rejects. Fact re-runs the classifier against rendered text; the generator's output is never treated as proof.

### Pipeline distinguishes rejection from fail-closed

- `outcome='rejected'` = merit rejection · a stage said "this is bad."
- `outcome='failed_closed'` = we couldn't determine an answer · configuration missing OR timeout OR error.

Both terminate the pipeline. The distinction lives in `nex.social_validator_runs.outcome` for post-hoc audit. VP4 verifies missing brand profile → `failed_closed` with `brand` stage outcome `fail_closed`.

### Fail-closed markers (4 distinct sources)

| Cause | Stage | Rejection body |
|---|---|---|
| Zero source_refs | rights | `no source_refs supplied · cannot verify rights` |
| Empty forbidden-claims list | policy | `forbidden-claims list is empty · Automatic mode blocked until Nex publishes a starter list` |
| Missing brand profile | brand | `no brand profile · Automatic mode blocked until merchant sets one` |
| Unknown platform | platform | `no adapter registered for platform 'X'` |

### Defence-in-depth · Fact and Policy overlap

Fact rescues grounded values via provenance substring match. Policy does NOT — it fires on the RULE regardless of provenance. VPO2 exploits this: a subject with `provenance.hack.value = "cheapest"` tricks Fact into passing "cheapest," but Policy still rejects. This is intentional: qualifications and superlatives cannot be self-asserted.

### Pipeline persistence + draft linkage

VP6 confirms `nex.social_validator_runs` row appears in the API list. VP7 confirms `nex.social_content_drafts.validator_run_id` is updated to the latest run. Together they satisfy the audit requirement: every draft has a traceable latest validator run.

### Cross-tenant isolation

VP8 verifies tenantB's `/validator-runs` list does NOT contain tenantA's runs — RLS enforces at the DB layer as designed in Phase 0.

## Architectural conflicts encountered

None new. Two known items unchanged from earlier phases:
1. RLS enforcement requires the `nex_social_app` role — runtime `SET LOCAL ROLE` handles this.
2. Charter v0.2 §S-II path (`social/adapters/*` vs actual `comms-social/adapters/*`) — recorded for future charter amendment.

## Doctrine faith kept

- ✅ Canonical charter · v1.0.5 architecture doc · Amendment #16 draft — all untouched.
- ✅ Hammerex `src/lib/nex/social/**` — not modified · not imported.
- ✅ Predictive OBSERVATION mode active — validator code contains no prediction · ranking · scoring above threshold checks · learning · or historical-outcome analysis. Predictive-boundary test suite still green.
- ✅ Seven v1.0.0 frozen interface hashes verified matching manifest.
- ✅ Boundary verifier zero violations.
- ✅ Phase 4 code NOT written (no worker · no scheduler · no adapter-call re-check integrated) — Phase 3 only exposes the `reCheckAtAdapterCall()` function; Phase 4 will consume it.
- ✅ Adapter interface unchanged from Phase 1 · Platform stage consumes existing `capabilities()` metadata.

## Bugs found and fixed during Phase 3

| ID | Symptom | Root cause | Fix |
|---|---|---|---|
| P3-B1 | VB2 (Brand forbidden term) fails · `code=undefined` | Test used "cheap" as forbidden term · but "cheap" is on the global explicit-reject list · Fact stage rejects first · Brand stage never runs | Changed forbidden term to fabricated "wobbly" (not on any global list) so Brand stage is exercised in isolation. Not a code bug · test-design bug. |

## Phase 3.5 candidates (documented but not built)

The following are recognised gaps in Phase 3 and deferred:

- **LLM-composed generation mode** (§S-III mode 2) — Phase 3 delivers Fact-checker independent of the generator; when LLM-composed mode lands, Fact will already be positioned as the independent validator.
- **Policy hot-reload** on data file changes — currently the policy loader caches at module init; a full reload requires a process restart. VPO3 proves the fail-closed branch exists in source but cannot dynamically prove it in a running server without restart.
- **Adapter-call re-check integration** — `reCheckAtAdapterCall()` is exported; the Phase 4 worker will call it inside the publish flow.

## What is NOT delivered in Phase 3 (deferred)

- Publishing worker · scheduling · pause propagation (Phase 4)
- Real provider adapters beyond simulator (Phase 5)
- Merchant onboarding UI (Phase 6)
- HQ mission-control panel (Phase 7)
- Attribution integration (Phase 8)
- End-to-end adversarial + performance testing (Phase 9)

## Whether Phase 4 is ready

**No.** Phase 4 (scheduling · workers · pause propagation · S-V behavioural half + S-VII two-phase publish integration) requires explicit Philip greenlight. Phase 3 is complete and pushed-ready; nothing autonomously proceeds. Predictive OBSERVATION mode still active. Hammerex untouched. Frozen kernel untouched.

## Commit ready

Awaiting push authorisation.
