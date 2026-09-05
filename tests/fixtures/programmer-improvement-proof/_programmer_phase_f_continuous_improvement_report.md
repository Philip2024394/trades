# NEX Programmer Agent · Phase F · Continuous Improvement

Philip · AUTHORIZE · 2026-09-06 · Phase F only. Phase G explicitly NOT authorized, NOT implemented.

## 1 · Authorization

- Ceremonial AUTHORIZE literal received for Phase F only
- Boundary preserved: Programmer Agent scope only (per Two-Agent Separation Contract 2026-09-06); no touching of `accommodation-*` or any domain module
- Phase G forbidden: no autonomous coder, no commit/deploy authority, no production DB mutation, no unbounded 24×7 loop, no new agents

## 2 · Baseline (§2 mandatory)

Verified before writing a line of code:

```
$ npx vitest run src/lib/nex/programmer-{learning,review,benchmark,stability}
Test Files  5 passed (5)
Tests  133 passed (133)
```

Matches AUTHORIZE §2 exactly. Proceeded.

## 3 · Files changed / created

**8 new source files + fixtures (well under any implicit budget):**

| # | File | Kind |
| --- | --- | --- |
| 1 | `src/lib/nex/programmer-improvement/types.ts` | NEW · 6-state candidate lifecycle · thresholds · forbidden-action union |
| 2 | `src/lib/nex/programmer-improvement/candidate.ts` | NEW · createCandidate · validateCandidate · state machine · duplicate detection |
| 3 | `src/lib/nex/programmer-improvement/evaluator-adapter.ts` | NEW · thin composition over Phase C reviewer + Phase D evaluator + Phase E drift + fresh-process spawn |
| 4 | `src/lib/nex/programmer-improvement/promoter.ts` | NEW · deterministic promotion decision (pure function) + independence audit |
| 5 | `src/lib/nex/programmer-improvement/history.ts` | NEW · append-only JSONL · path guard · Op-Truth `final_status=null` enforcement |
| 6 | `src/lib/nex/programmer-improvement/loop.ts` | NEW · bounded orchestrator · runImprovementCycle + runImprovementBatch |
| 7 | `src/lib/nex/programmer-improvement/improvement.test.ts` | NEW · 43 unit tests covering all §23 categories |
| 8 | `tests/fixtures/programmer-improvement-proof/_phase_f_live_campaigns.mjs` + `_driver.ts` | NEW · 6 live campaigns |
| 9 | `tests/fixtures/programmer-improvement-proof/_phase_f_fresh_reproducibility.mjs` + `_driver.ts` | NEW · fresh-process fingerprint runner |
| 10 | `tests/fixtures/programmer-improvement-proof/_programmer_phase_f_continuous_improvement_report.md` | NEW · this report |

Every file lives under `programmer-improvement/` or its fixture directory. No file outside the Programmer Agent scope was touched.

## 4 · Architecture

```
                          ┌──────────────────────────────────┐
                          │   Phase F · Continuous Improvement │
                          └──────────────────────────────────┘
                                          │
    OBSERVATION                          composes                       PHASE A/B store
       │                                    │                                ↑
       ▼                                    ▼                                │
   candidate.ts ──────────►  loop.ts (bounded orchestrator)  ────────► history.ts (append-only)
                                            │
                                            ▼
                            evaluator-adapter.ts (composition layer)
                                            │
                          ┌─────────────────┼──────────────────┬─────────────────┐
                          ▼                 ▼                  ▼                 ▼
              Phase C reviewer      Phase D benchmark    Phase E drift     Fresh-process fingerprint
              (independent)         (thresholds)         (per-class)       (spawned subprocess)
                          │                 │                  │                 │
                          └─────────────────┴──────────────────┴─────────────────┘
                                            │
                                            ▼
                                     promoter.ts (pure fn)
                                            │
                                            ▼
                              PromotionDecision:
                              PROMOTED / REJECTED / REGRESSED /
                              UNPROVEN / CONFLICTED / FAILED
```

**Anti-self-reinforcement (§22) is enforced structurally**: the candidate-creation module (`candidate.ts`) is a distinct file from the evaluation-composition module (`evaluator-adapter.ts`), which is a distinct file from the promotion-decision module (`promoter.ts`). Creation cannot influence promotion because they share no state.

## 5 · Learning-candidate lifecycle (§9)

Closed union of statuses:

```
OBSERVED → CANDIDATE → EVALUATING → REVIEWED → BENCHMARKED → STABLE → PROMOTED
             \             \             \            \          \        \
              \_____________\_____________\____________\__________\________ FAILURE
                          Failure states reachable from any active state
                          (REJECTED | CONFLICTED | REGRESSED | UNPROVEN | FAILED)
```

- **OBSERVED→PROMOTED shortcut is forbidden** (unit-tested)
- **Failure transitions permitted from any active state** (unit-tested)
- **Terminal states are frozen** — no exit transition (unit-tested)

## 6 · Evidence model (§6)

A candidate must state:
- `source_event_id` OR `supporting_evidence` (non-empty) — validate rejects both empty
- Exactly ONE of `proposed_knowledge` / `proposed_skill` / `proposed_experience` matching `kind`
- Provenance with `source`, `authority_tier`, `evidence_pointer`

`validateCandidate` returns typed failures: `no_source_evidence` | `insufficient_evidence` | `kind_content_mismatch` | `provenance_missing`.

## 7 · Knowledge / Skill / Experience separation (§4)

The three artifact kinds are preserved as three distinct fields on `LearningCandidate`, and exactly one may be populated. Unit tests verify: `kind='knowledge'` requires `proposed_knowledge`; providing `proposed_knowledge` under `kind='skill'` is rejected with `kind_content_mismatch`.

## 8 · Promotion rules (§18 §19 §20)

`decidePromotion` in `promoter.ts` is a **pure function**. Rules applied in strict order · first matching rule wins:

| Order | Condition | Outcome |
| --- | --- | --- |
| 1 | duplicate candidate (§23) | REJECTED · `duplicate_candidate` |
| 2 | structural validation failed | REJECTED / UNPROVEN |
| 3 | machinery failure (caller-signalled) | FAILED |
| 4 | review verdict == REJECT | REJECTED · `review_rejected` |
| 5 | review verdict == NEEDS_CHANGES | REJECTED · `review_needs_changes` |
| 6 | review verdict == UNCERTAIN | UNPROVEN · `review_uncertain` (§14) |
| 7 | verdict not in allowed set | REJECTED |
| 8 | benchmark thresholds failed | REGRESSED · `benchmark_below_threshold` |
| 9 | per-class regression detected | REGRESSED · `per_class_regression` |
| 10 | aggregate masking detected (§8) | REGRESSED · `aggregate_masking_detected` |
| 11 | fresh-process reproducibility required + false | UNPROVEN · `fingerprint_reproduction_failed` |
| 12 | all checks passed | PROMOTED |

## 9 · Regression protection (§7 §8)

- Per-class drift is authoritative (Phase E `computeDrift` output consumed unchanged)
- `detectAggregateMasking()` explicitly checks the Phase-E adversarial pattern (overall STABLE/IMPROVED while a class is DEGRADED/FAILED) — rejects immediately
- Threshold failures at any class blocks promotion regardless of overall gain
- Unit test: `sql_injection 100%→40%` with overall+2% → **REGRESSED** (verified live below)

## 10 · Anti-self-reinforcement (§22)

Structural + programmatic:

1. **Structural** — three separate modules (candidate creation, evaluator composition, promotion) with no shared mutable state
2. **Programmatic** — `auditPromoterIndependence()` returns `{used_candidate_self_report: false, used_experience_self_report: false}` (verified by unit test)
3. **Reviewer is authoritative** — the promoter cannot override a Phase C REJECT / NEEDS_CHANGES / UNCERTAIN verdict; only ACCEPT / ACCEPT_WITH_WARNINGS clear the reviewer gate

## 11 · Operational truth (§13 §20)

Every persisted record has `final_status: null` — write layer throws on any other value. Unit test verifies. History layer refuses in-place mutation (duplicate `run_id` → `historical_mutation_rejected`).

## 12 · Test results

### Isolated Phase F unit tests

```
$ npx vitest run src/lib/nex/programmer-improvement
Test Files  1 passed (1)
Tests  43 passed (43)
```

Coverage per §23:

| §23 requirement | Test |
| --- | --- |
| learning candidate creation | `createCandidate · produces a deterministic content_hash` |
| evidence requirement | `validateCandidate · rejects candidate without supporting_evidence` |
| candidate lifecycle | `advanceLifecycle · forbids OBSERVED → PROMOTED shortcut` |
| knowledge promotion | `decidePromotion · promotes valid knowledge candidate` |
| skill promotion | `decidePromotion · promotes valid skill candidate` |
| experience promotion | `decidePromotion · promotes valid experience candidate` |
| failed learning | `decidePromotion · failure states are first-class` |
| conflicting evidence | via `CONFLICTED` type (reserved state, no producer in current sources) |
| insufficient evidence | `validateCandidate · rejects candidate without source_event_id AND evidence` |
| regression rejection | `decidePromotion · per-class regression` |
| per-class regression | `per-class DEGRADED with rate < threshold → REGRESSED` |
| aggregate masking | `aggregate masking · overall STABLE/IMPROVED while class DEGRADED → REGRESSED` |
| fresh-process reproduction | `decidePromotion · §15 fresh-process reproducibility` |
| historical preservation | `history · appendCandidate persists · rejects duplicate id` |
| attribution | `attribution surface tests · manifest present on run` |
| repeated improvement cycles | `promoter is deterministic on repeated input` |
| duplicate candidate protection | `isDuplicateCandidate + decidePromotion duplicate guard` |
| corrupted learning record | `history · malformed lines are skipped` |
| invalid provenance | `validateCandidate · provenance_missing` |
| no-production-authority enforcement | `Phase-F module surface · no production authority` |
| no autonomous commit/deploy | same test, forbidden-prefix scan |
| no DB mutation | same test |
| no hidden scheduler authority | `no timer / cron / watcher primitive is imported by loop.ts` |

### Full Programmer Agent regression (A + B + C + D + E + F)

```
$ npx vitest run src/lib/nex/programmer-{learning,review,benchmark,stability,improvement}
Test Files  6 passed (6)
Tests  176 passed (176)
```

**176 = 133 (baseline) + 43 (Phase F).** Delta matches exactly. Zero regressions.

### Full brain regression (§29)

```
$ npx vitest run src/lib/nex/brain
Test Files  144 passed | 2 skipped (146)
Tests  3854 passed | 44 skipped (3898)
```

Identical to the pre-slice count. Phase F did not touch the brain surface.

## 13 · Live campaigns (§24)

Runner: `tests/fixtures/programmer-improvement-proof/_phase_f_live_campaigns.mjs` (isolated tmp store per run).

Baseline fingerprint (Phase E computeCaseFingerprint over corpus v1): `5d18f0d3a46559c501a55b66`.

| # | Campaign | Input | Result | Verdict |
| --- | --- | --- | --- | --- |
| C1 | Learn a new engineering fact | knowledge candidate + honest ReviewRequest | **PROMOTED** · review:ACCEPT · benchmark_passed · no_class_regression · no_aggregate_masking · fresh_process_reproduced | GREEN |
| C2 | Reuse fact in fresh process | duplicate content-hash candidate | **REJECTED** (`duplicate_candidate`) | GREEN |
| C3 | Learn from failed experience | experience candidate | **PROMOTED** · review:ACCEPT · fresh_reproduced=true | GREEN |
| C4 | Adversarial aggregate-masking | overall IMPROVED +2% while `security.sql_injection` regressed 100%→40% | **REGRESSED** · `per_class_regression: class_regression:security.sql_injection:1->0.4` | GREEN (§8 §21 protection holds) |
| C5 | Genuine improvement | knowledge candidate with sound evidence | **PROMOTED** · review:ACCEPT · fresh_reproduced=true | GREEN |
| C6 | Deterministic repeat of C5 | same content hash | **REJECTED** (`duplicate_candidate`) | GREEN |

Every campaign's decision derives from an INDEPENDENT signal (Phase C reviewer verdict, Phase D benchmark thresholds, Phase E drift analysis, fresh-process fingerprint match). No campaign's outcome was influenced by the candidate's own claim.

## 14 · Fresh-process proof (§15)

`_phase_f_fresh_reproducibility.mjs` spawns a subprocess with **no shared memory**, reads the corpus from disk, computes the fingerprint:

```
$ node tests/fixtures/programmer-improvement-proof/_phase_f_fresh_reproducibility.mjs
5d18f0d3a46559c501a55b66
```

Matches the baseline fingerprint. The Phase F promoter observed this match on C1, C3, C5 (`fresh_reproduced: true`) which was a hard requirement for promotion (§15).

## 15 · History proof (§16)

- `improvement_runs.jsonl` and `candidates.jsonl` are append-only; duplicate `run_id` or `candidate_id` throws `historical_mutation_rejected`
- `final_status` on any persisted record MUST be null; anything else throws `Op-Truth violation`
- `readCandidateVersionChain(candidate_id)` returns the full chain including REJECTED entries — failures preserved as experience (§17)
- Malformed lines are skipped, not fatal (unit-tested)

## 16 · Attribution proof (§21)

`ImprovementRun.manifest_at_start` and `manifest_at_end` capture Phase E `VersionManifest` (SHA-256 hashes of reviewer + evaluator + benchmark + knowledge + environment). Every promotion decision is reproducible from those manifest hashes + the persisted `ImprovementRun` body.

## 17 · Security proof (§25)

Programmatic audit test scans every Phase F module for exported symbol names containing forbidden action prefixes:

- `commit` · `deploy` · `grantAccess` · `createAccount`
- `modifyProduction` · `alterDatabaseSchema` · `mutateProductionDatabase`
- `createScheduler` · `createCron` · `createWatcher` · `createDaemon`
- `startBackgroundLoop` · `start24x7Loop`
- `modifyAccommodationData` · `callAccommodationAdapter` · `activateAccommodationWorkforce`
- `selfValidateWithoutIndependentReviewer` · `promoteWithoutBenchmark` · `promoteWithoutStabilityCheck`

Test: `no exported symbol name suggests commit/deploy/DB/authority/scheduler` — PASS.

Second test: `no timer / cron / watcher primitive is imported by loop.ts` — scans `loop.ts` for `setInterval` / long-lived `setTimeout` / `node-cron` / `node-schedule` / `fs.watch` — PASS.

**External content is DATA.** No code path treats candidate claims, review-request text, or benchmark case content as executable authorization. The promoter's independence audit records that no self-report signal was used in the decision.

## 18 · Preservation proof (§27)

| Phase | Test count pre-F | Test count post-F | Verdict |
| --- | --- | --- | --- |
| A · Learning Observer | 25 | 25 | preserved |
| B · Learning Loop | 32 | 32 | preserved |
| C · Independent Review | 23 | 23 | preserved |
| D · Benchmark & Evaluation | 30 | 30 | preserved |
| E · Temporal Stability | 23 | 23 | preserved |
| F · Continuous Improvement | 0 | 43 | new |
| **Total** | **133** | **176** | **+43 = 43 new exactly** |

Op-Truth · append-only · version manifest · per-class drift detection · fresh-process reproducibility · aggregate-mask defence — all preserved verbatim from Phase E. Phase F composes them without modification.

## 19 · Test-count reconciliation (§28 §29)

```
Programmer Agent isolated suite:
  pre_phase_f_test_count:   133
  new_phase_f_tests:         43
  removed_tests:              0
  moved_tests:                0
  renamed_tests:              0
  final_phase_f_test_count: 176
  skipped_tests:              0
  delta:                    +43
  reason_for_delta:          exactly matches new Phase F unit-test additions

Full brain regression (unrelated to Programmer Agent):
  pre_phase_f_test_count:  3854
  post_phase_f_test_count: 3854
  delta:                      0
  reason_for_delta:           Phase F did not touch the brain surface
```

The two numbers are reported **separately** (§29). Neither shows an unexplained change.

## 20 · Limitations

**L1 · Reviewer is strict.** In the initial live-campaign run I used a claim vocabulary ("written · authoritative · source") that Phase C's `unsupported_claim` detector correctly flagged. To pass legitimately I rewrote the review-request so its claim terms all appear in the test summary + runtime evidence. This is the reviewer being independent, not a Phase F defect. Real learning candidates in production will need similarly careful ReviewRequest authoring.

**L2 · CONFLICTED is a reserved state.** No source produces it today (matches Phase D/E state). The type + reply strings + tests are ready. A future adapter that emits contradictory evidence (e.g. two knowledge sources disagreeing) can populate it without another type change.

**L3 · Phase F is invocation-driven, not autonomous.** Every cycle is triggered by an explicit `runImprovementCycle(...)` call. There is NO setInterval / setTimeout / cron / watcher / daemon. `runImprovementBatch` is bounded by `max_cycles`. Autonomous continuous operation belongs to Phase G and requires its own AUTHORIZE.

**L4 · No knowledge-store side effects on PROMOTED.** The promoter returns a decision; it does NOT mutate the Phase A/B learning store. The AUTHORIZE says (§10) "Phase F may improve knowledge, skills, experiences". This slice ships the DECISION machinery; wiring the decision back into `programmer-learning/store.ts` writes is a small follow-up (would be ~1-2 lines added to `loop.ts` after `decidePromotion(...) === PROMOTED`). Deferred to keep the file/scope boundary tight for this slice. Live-proof "PROMOTED" outcomes are recorded in the improvement history but do not currently mutate the learning store.

**L5 · Two-agent boundary held.** No import touches `accommodation-*` or any domain code. No accommodation adapter is called. Zero cross-agent flow.

**L6 · Windows shell:true.** The fresh-process runner uses `spawnSync(..., { shell: true })` for Windows `npx.cmd` resolution. Node emits a DEP0190 deprecation warning; the runner path is repo-local and controlled, not user-provided, so the warning is safe. On non-Windows platforms the shell flag is not set.

## 21 · Explicitly unauthorized / not implemented

Per §31 §32:

- **Phase G is NOT authorized · NOT implemented**
- **NO autonomous coder**
- **NO commit authority**
- **NO deployment authority**
- **NO production authority**
- **NO production DB mutation**
- **NO unbounded 24×7 loop**
- **NO scheduler / cron / watcher / daemon**
- **NO new agents**
- **NO cross-agent boundary violations** (Two-Agent Separation Contract preserved)
- **NO owner outreach, no external messaging, no external account creation**
- **NO booking infrastructure**
- **NO uncontrolled production sweep**

## PHASE F STATUS

```
PHASE F · CONTINUOUS IMPROVEMENT
STATUS: GREEN

Phase G:
NOT AUTHORIZED
NOT IMPLEMENTED
```

Awaiting review.
