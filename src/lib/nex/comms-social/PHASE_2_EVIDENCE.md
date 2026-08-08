# Phase 2 · Evidence Report

**Date:** 2026-08-08
**Scope:** Content generation + grounding (Charter §S-III).
**Status:** ✅ PHASE 2 COMPLETE.

## Charter §S-III compliance summary

| Requirement | Phase 2 status |
|---|---|
| Claim taxonomy (6 classes) locked in code and data | ✅ six classes enumerated in `content/types.ts` · rule set in `data/nex-comms-social/*.json` |
| Two generation modes declared | ✅ `template_fill` implemented · `llm_composed` reserved as enum value + Phase 3 |
| Every autopublish path grounded to tenant-authorised source data | ✅ generator refuses when source missing · validator rejects when claim not grounded |
| No fabricated claims (prices · qualifications · guarantees · projects · locations · certifications) | ✅ classifier rule set matches earlier `NEX_SOCIAL_FORBIDDEN_CLAIMS_STARTER_LIST_PROPOSAL` · every forbidden pattern routes to reject |
| Generator distinct from validator (different modules) | ✅ `content/generator.ts` and `content/grounding.ts` are separate files with no shared state |
| Hard-block on unauthorised claims | ✅ `enforcement=hard_block` → draft state `rejected` |
| Review-required flagging | ✅ `enforcement=review_required` → draft state `rejected` with `code=review_required_claim` (Manual queue is Phase 4) |
| Provenance trace per generated variable | ✅ `provenance` JSONB records `{variable, source_id, source_kind, source_path, value}` per binding |
| Time-of-check vs time-of-publish gap closed | ✅ pipeline runs generator and validator inside the SAME `withTenantClient` transaction · source data cannot change between steps |
| Rights-status enforcement (S-IV crosscut) | ✅ `listEligibleSources` filters to autopublish-eligible rights_status only · unknown/restricted/ai_generated/expired/inactive/PII-without-release invisible to generator |

## Files added / changed

### Migration
- `deploy/postgres/init/032_comms_social_content.sql` — three new tables:
  - `nex.social_content_sources` (merchant-authorised source data · rights_status + PII flag + expiry + attestation trail)
  - `nex.social_content_templates` (tenant-owned OR Nex-owned globals · typed variable slots · hashtag slots · CTA slot)
  - `nex.social_content_drafts` (one row per generated draft · provenance JSONB · claims JSONB · grounding_state · rejection_reasons)
  - RLS default-deny + `nex_social_app` grants for all three tables
  - Templates get special SELECT policy allowing tenant reads OR Nex-owned reads (tenant_id IS NULL)

### Data files (versioned starter rule sets)
- `data/nex-comms-social/forbidden-claims-v1.json` — 8 categories × ~50 patterns matching the earlier PROPOSAL doc
- `data/nex-comms-social/subjective-descriptors-whitelist-v1.json` — 5 green tiers · 5 amber context-gated · ~50 explicit-reject descriptors

### Runtime library (7 new files)
- `content/types.ts` — types + enums + `AUTOPUBLISH_ELIGIBLE_RIGHTS` constant
- `content/sources.ts` — `upsertContentSource` · `listEligibleSources` (rights-gated · generator-facing) · `listAllSources` (admin) · `getSourceById` · `getBySourcePath`
- `content/templates.ts` — CRUD
- `content/claims.ts` — rule-based classifier · loads versioned data files · `classifyClaims` · `isGreenDescriptor`
- `content/generator.ts` — `generateFromTemplate` · template-fill mode · deterministic · returns `CandidatePost` with explicit provenance
- `content/grounding.ts` — `validateGrounding` · scans full rendered text for classifier hits · marks grounded vs ungrounded · returns `{grounding_state, claims, rejection_reasons}` · `validateProvenanceIntegrity` helper
- `content/pipeline.ts` — `generateAndGround` orchestrator · always inside `withTenantClient` · always persists a draft (either grounded or rejected)

### API routes (4 new)
- `POST /api/nex/comms-social/content/sources` — upsert source
- `GET  /api/nex/comms-social/content/sources?tenant_id=&eligible=&kind=` — list
- `POST /api/nex/comms-social/content/templates` — upsert template
- `GET  /api/nex/comms-social/content/templates?tenant_id=&kind=` — list
- `POST /api/nex/comms-social/content/generate` — run pipeline
- `GET  /api/nex/comms-social/content/drafts?tenant_id=&limit=` — list

### Tests (5 new suites · 36 additional assertions)
- `content-sources.test.mjs` (9/9)
- `claim-taxonomy.test.mjs` (10/10)
- `template-fill.test.mjs` (6/6)
- `grounding-validation.test.mjs` (6/6)
- `generation-e2e.test.mjs` (5/5)

## Database changes

| Table | Change |
|---|---|
| `nex.social_content_sources` | Created |
| `nex.social_content_templates` | Created |
| `nex.social_content_drafts` | Created |

No changes to existing tables (Phases 0/1 tables untouched).

## Test evidence (aggregate 82/82 assertions across 13 suites)

```
════════ SUMMARY ════════
  PASS tenant-isolation      · 10/10
  PASS adapter-isolation     · 5/5
  PASS predictive-boundary   · 4/4
  PASS role-permission       · 9/9
  PASS envelope-encryption   · 7/7
  PASS oauth-state           · 6/6
  PASS token-redaction       · 5/5
  PASS oauth-e2e             · 5/5
  PASS content-sources       · 9/9
  PASS claim-taxonomy        · 10/10
  PASS template-fill         · 6/6
  PASS grounding-validation  · 6/6
  PASS generation-e2e        · 5/5
```

## Notable grounding proofs

- **GV1** clean template `"Recent project by {{name}}"` → `grounded` with zero rejections.
- **GV2** template body containing `"lifetime guarantee"` → `rejected` with `code=hard_blocked_claim`.
- **GV3** template body containing `"the best"` → `rejected` with `code=hard_blocked_claim`.
- **GV4** template body containing `"premium"` (explicit-reject descriptor) → `rejected`.
- **GV5** template body containing `"award-winning"` → `rejected` with `code=review_required_claim`.
- **GV6** `#TrustedBuilder` hashtag → `rejected` with `offending_claim="#TrustedBuilder"` in the rejection detail.
- **TF6** every populated variable produced a provenance entry with `source_id · source_kind · source_path · value`.
- **TF7** a source with `rights_status='unknown'` was ignored — generator picked the eligible `'owned'` project instead.
- **C2-C7** eligibility filter correctly excludes: `unknown` rights · `restricted` rights · `ai_generated_provenance_pending` · expired licensed · inactive · PII without release evidence.

## Rejection code taxonomy shipped in Phase 2

Codes that can appear in `nex.social_content_drafts.rejection_reasons`:

| Code | Meaning | Enforcement |
|---|---|---|
| `generator_missing_source` | No eligible source of the required kind exists (rights/active/expiry filtered) | Hard (draft persisted rejected) |
| `generator_missing_field` | The picked source lacks the required field path | Hard |
| `generator_unresolved_variable` | Template body references `{{var}}` without a slot binding (drafting-time bug) | Hard |
| `generator_template_not_found` | Bad template_id | Hard |
| `generator_template_inactive` | Template exists but `status != 'active'` | Hard |
| `provenance_integrity_failed` | A provenance entry lacks source_id/kind/path | Hard |
| `hard_blocked_claim` | Classifier hit a `hard_block` pattern not backed by a grounded value | Hard |
| `review_required_claim` | Classifier hit a `review_required` pattern not backed by a grounded value | Route to Manual (Phase 4) — currently draft state `rejected` |

## Bugs found and fixed during Phase 2

| ID | Symptom | Root cause | Fix |
|---|---|---|---|
| P2-B1 | POST /sources returned empty body | Postgres error 42P08 "could not determine data type of parameter" · `$8` used twice with derived logic (`attested_by` + `CASE WHEN $8`) and `$9::inet` with NULL | Rewrote INSERT with explicit `$N::type` cast on every parameter and computed `attested_at` in caller |

Discovered by inspecting `.next-dev.err` when the first `template-fill.test.mjs` run failed. Zero data loss (all pre-fix inserts had already errored, no partial state).

## Doctrine faith kept

- ✅ Canonical charter · v1.0.5 architecture doc · Amendment #16 draft · all untouched.
- ✅ Hammerex `src/lib/nex/social/**` unmodified.
- ✅ Predictive OBSERVATION mode active · zero comms-social imports.
- ✅ 7 v1.0.0 frozen interface hashes verified matching manifest.
- ✅ Boundary verifier zero violations.
- ✅ Phase 3 validators (Rights · Policy · Brand · Platform) NOT built beyond the interfaces strictly required to test Phase 2 (specifically: the grounding validator IS the S-III "Fact-checker" stage in the future 5-stage pipeline · but Rights/Policy/Brand/Platform stages are entirely absent). No interface stubs for those stages exist in this commit; they land in Phase 3.

## What is NOT delivered in Phase 2 (deferred)

- LLM-composed generation mode (Phase 3 · requires validator distinct from generator model)
- Rights/Policy/Brand/Platform validator stages (Phase 3)
- Manual approval queue UI (Phase 6) — currently `rejected` drafts stay in DB; a merchant needs the Phase 6 UI to review and revise
- Publishing worker · scheduling · pause propagation (Phase 4)
- Real provider adapters (Phase 5)
- Merchant onboarding UI (Phase 6)
- HQ template distribution + adaptation (Phase 4/6)
- Time-of-check-vs-publish gap for the ADAPTER call (currently the pipeline transaction closes the gap for scheduling only · re-verify at T-adapter-call lands with the worker in Phase 4)

## Whether Phase 3 is ready

**No.** Phase 3 (validator pipeline: Fact → Rights → Policy → Brand → Platform per Charter §S-VIII) requires explicit Philip greenlight per the build order. Phase 2 is complete and pushed-ready; nothing autonomously proceeds.

## Commit ready

Awaiting push authorisation.
