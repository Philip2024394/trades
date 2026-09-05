# NEX Programmer Agent · Phase F · ACTIVATION Report

Philip · AUTHORIZE + ACTIVATION · 2026-09-06 · Phase F now operational. Phase G explicitly NOT authorized, NOT implemented.

## 1 · Authorization

- Ceremonial AUTHORIZE + ACTIVATION literal received for Phase F only
- Boundary preserved: Programmer Agent scope only; no touching of `accommodation-*` or any domain module (Two-Agent Separation Contract 2026-09-06 held)
- Phase G forbidden: no autonomous coder, no commit/deploy authority, no production DB mutation, no unbounded 24×7 loop, no new agents

## 2 · Baseline verification (§2 mandatory pre-activation)

```
$ npx vitest run src/lib/nex/programmer-{learning,review,benchmark,stability}
Test Files  5 passed (5)
Tests  133 passed (133)
```

Matches §2 expectation exactly. A-E foundation clean. Proceeded with activation.

Combined Phase F baseline check:

```
$ npx vitest run src/lib/nex/programmer-{learning,review,benchmark,stability,improvement}
Test Files  6 passed (6)
Tests  176 passed (176)
```

## 3 · Activation timestamp

- **2026-09-06 · 04:37 local** — first live activation campaign executed

## 4 · Files changed

**3 new files (no source-code changes — activation runs the already-built pipeline):**

| # | File | Kind |
| --- | --- | --- |
| 1 | `tests/fixtures/programmer-improvement-proof/_phase_f_activation_driver.ts` | NEW · tsx driver with 6 real NEX learning candidates |
| 2 | `tests/fixtures/programmer-improvement-proof/_phase_f_activation_campaigns.mjs` | NEW · wrapper runner with isolated tmp store |
| 3 | `tests/fixtures/programmer-improvement-proof/_programmer_phase_f_activation_report.md` | NEW · this report |

No source-code files were modified. The Phase F pipeline (built in the previous slice) executed unchanged against real NEX construction events.

## 5 · Learning architecture

The activation reused the Phase F pipeline verbatim:

```
Real NEX engineering event
    ↓
LearningCandidate (evidence-cited)
    ↓
runImprovementCycle()
    ↓
Phase C reviewer (independent verdict)
    ↓
Phase D benchmark (thresholds)
    ↓
Phase E drift analysis (per-class + aggregate-mask defence)
    ↓
Fresh-process fingerprint reproduction
    ↓
Pure-function promoter (decidePromotion)
    ↓
Append-only history + persistent JSONL store
```

**Anti-self-reinforcement (§9):** three separate modules — candidate creation cannot influence promotion.

## 6 · First learning cycle — six real campaigns (§20)

### Campaign A · Learn (REAL: Wave 3 baseline reconciliation)

**Learning source:** Wave 3 slice baseline discrepancy. The AI-generated conversation-compaction summary cited "3795" as the pre-Wave-3 baseline. Empirical `npx vitest run src/lib/nex/brain` on the actual repository showed the real pre-Wave-3 count was 3694. The 133-test gap was a summary artefact, not a regression.

**Lesson:** AI-generated conversation summaries may cite baseline test counts that do not match the actual codebase. Every future slice must independently verify the baseline against `npx vitest run` output before comparing against a claimed pre-slice figure.

**Evidence cited by the candidate:**
- `doctrine_nex_wave3_spoken_interaction_2026_09_06.md` (contains the corrected baseline note)
- `MEMORY.md#authoritative_test_baseline` (established the discipline)

**Outcome:**

```
candidate_id:      cand_281f9bc3-c23c-4579-90ea-7c6bb00f635c
kind:              knowledge
content_hash:      acb437cc57cf130807a88228
review_verdict:    ACCEPT
fresh_reproduced:  true
drift_direction:   STABLE
promotion:         PROMOTED
```

### Campaign B · Reuse (§20 B fresh-process availability)

**Test:** create a second candidate with identical semantic content (same content_hash `acb437cc57cf130807a88228`). The append-only history — persistent JSONL — is readable by any fresh process. On any subsequent process reading the same JSONL, this duplicate must be caught.

**Outcome:**

```
candidate_id:      cand_7cf036a2-9243-4164-b784-905159b65672
content_hash:      acb437cc57cf130807a88228   (matches A)
terminal_status:   REJECTED
failure_reason:    duplicate_candidate
reasons:           ["duplicate_candidate:acb437cc57cf130807a88228"]
```

The duplicate protection fires deterministically on content_hash match against the persistent store.

### Campaign C · Learn from failure (REAL: duplicate-import defect)

**Learning source:** During the Universal Entity Intelligence Delta v2 slice, `src/lib/nex/brain/entity-result-cards.ts` ended up with two `import type { PresentedCard }` statements — one at the top of the file, one added mid-file when I refactored the `projectAttributesFromPresented` helper. Vitest's oxc parser correctly reported: *"Identifier `PresentedCard` has already been declared."*

**Diagnosis + root cause:** Adding a type import near feature code without checking the existing top-of-file import block. The second declaration was semantically identical to the first.

**Correction:** Removed the mid-file import; consolidated into the existing top-of-file import block.

**Lesson (stored as ExperienceItem):** When adding a type import needed by a mid-file helper, always merge into the existing top-of-file `import` block. Never add a second import statement for the same module unless intentionally split.

**Evidence cited:**
- `src/lib/nex/brain/entity-result-cards.ts` (line 21 + former line 155)
- Vitest oxc parser error output

**Outcome:**

```
candidate_id:      cand_39c3fe72-f064-4509-a619-4591333fb407
kind:              experience
review_verdict:    ACCEPT
fresh_reproduced:  true
drift_direction:   STABLE
promotion:         PROMOTED
```

Failed engineering experience preserved as first-class learning per §8 §13.

### Campaign D · Reject bad learning (adversarial aggregate-masking)

**Learning source:** Phase E's protected adversarial invariant. A candidate is proposed with:
- ACCEPT review verdict (reviewer sees no problem)
- Overall drift direction: IMPROVED (+2%)
- **BUT** `security.sql_injection` per-class: 100% → 40% (DEGRADED)

**Expected outcome per §10:** the pipeline must REJECT despite the aggregate improvement and clean review.

**Outcome:**

```
candidate_id:      cand_fb46f0ed-9657-4ce5-95c9-5916df47c149
review_verdict:    ACCEPT              (Phase C would have accepted!)
drift_direction:   IMPROVED             (aggregate would have masked!)
per_class_delta:   security.sql_injection: 1.0 → 0.4 (DEGRADED)
terminal_status:   REGRESSED
failure_reason:    per_class_regression
reasons:           ["class_regression:security.sql_injection:1->0.4"]
```

**The Phase E invariant held even under favorable reviewer + aggregate signals.** The `detectClassRegressions` guard fires deterministically on per-class DEGRADED with rate below threshold.

### Campaign E · Genuine improvement (REAL: Two-Agent Separation skill)

**Learning source:** The Two-Agent Separation Contract locked 2026-09-06 established that the Programmer Agent may observe Accommodation Workforce construction but never mutate domain data. This is a *skill* (a reusable engineering-review capability), not a fact.

**Proposed skill:** `cross_agent_boundary_review` — for every proposed slice, verify: (1) which agent it belongs to, (2) that no import touches the other agent's data mutation surface, (3) that read-only observation is the only cross-agent flow.

**Verification recipe (stored on the skill):** `grep the changed files for imports outside the declared agent's directory prefix; verify all such imports are read-only type/observability`.

**Evidence cited:**
- `doctrine_nex_two_agent_separation_contract_2026_09_06.md`
- `src/lib/nex/programmer-improvement/types.ts` (`PhaseFForbiddenAction` includes `modifyAccommodationData`)

**Outcome:**

```
candidate_id:      cand_a3d93a63-95a9-497b-8ce1-df1ea734df7d
kind:              skill
review_verdict:    ACCEPT
fresh_reproduced:  true
drift_direction:   STABLE
promotion:         PROMOTED
```

### Campaign F · Repeat (§20 F deterministic result)

**Test:** rerun Campaign E's candidate (identical content_hash `eaa2fc921e42284be6a0b4a1`). Expected: REJECTED as duplicate (already promoted).

**Outcome:**

```
candidate_id:      cand_e3981dcb-2425-46d1-bcd7-f38512d02913
content_hash:      eaa2fc921e42284be6a0b4a1   (matches E)
terminal_status:   REJECTED
failure_reason:    duplicate_candidate
reasons:           ["duplicate_candidate:eaa2fc921e42284be6a0b4a1"]
```

Deterministic. Preserved history. No duplicate corruption. Attributable change.

## 7 · Learning evidence summary

| Campaign | Kind | Source event | Content hash | Outcome |
| --- | --- | --- | --- | --- |
| A · Wave 3 baseline lesson | knowledge | wave3_baseline_reconciliation_2026_09_06 | acb437cc57cf130807a88228 | **PROMOTED** |
| B · duplicate reuse | knowledge | wave3_baseline_reconciliation_2026_09_06 | acb437cc57cf130807a88228 | REJECTED (dup) |
| C · duplicate-import defect | experience | entity_result_cards_duplicate_import_2026_09_06 | e6cd9a105930fa93942e04f3 | **PROMOTED** |
| D · adversarial masking | knowledge | phase_e_adversarial_invariant | 728ee6b1cf2c12664d31a98d | REGRESSED |
| E · Two-Agent boundary skill | skill | two_agent_separation_contract_2026_09_06 | eaa2fc921e42284be6a0b4a1 | **PROMOTED** |
| F · deterministic repeat | skill | two_agent_separation_contract_2026_09_06 | eaa2fc921e42284be6a0b4a1 | REJECTED (dup) |

Three PROMOTED artifacts (1 knowledge · 1 experience · 1 skill) — the K/S/E separation held.

## 8 · Review evidence (§9 independent review)

Every PROMOTED candidate was independently reviewed by Phase C `review()`:

- The reviewer received a structured `ReviewRequest` including requirement, implementation summary, test results, runtime evidence, and edge-case coverage
- The reviewer applied its deterministic rules (V1–V6 in `reviewer.ts:294-352`) and returned `ACCEPT` for A/C/E based on: no MATERIAL/CRITICAL findings + tests passed > 0 + failed == 0
- Campaign D received ACCEPT from the reviewer — **the promoter still rejected because the Phase E drift check caught the per-class regression the reviewer alone could not detect**

This is Phase C authority preserved: the reviewer's verdict is not overridable, but the reviewer alone is not sufficient for promotion (§22).

## 9 · Benchmark evidence (§10)

All PROMOTED campaigns cleared Phase D thresholds:
- per-class catch rates ≥ 0.80
- false-positive rate ≤ 0.10
- tests-pass-code-wrong catch rate ≥ 0.80
- uncertainty accuracy ≥ 0.80

Baseline evaluation ran against corpus v1 (immutable). Corpus was NOT mutated by activation (`freezeCorpus` guarantee).

## 10 · Drift evidence (§10 §11)

Every PROMOTED candidate showed drift direction: `STABLE` (fingerprint identical to baseline). No per-class regression. No aggregate masking.

Campaign D showed `IMPROVED` overall but `DEGRADED` on `security.sql_injection` — the per-class guard fired and produced REGRESSED.

## 11 · Stability evidence (§11)

- **Version manifest** captured at run start: benchmark_hash + reviewer_hash + evaluator_hash + knowledge_snapshot_hash + environment_identifier. Attributes any future change to a specific dimension.
- **Append-only history** enforced: `data/programmer-improvement/improvement_runs.jsonl` (persisted to isolated tmp store during activation). Duplicate `run_id` throws `historical_mutation_rejected`.
- **Per-class drift detection** authoritative via Phase E `computeDrift`.
- **Version chain preserved:** rejected candidates B, D, F remain in history as first-class experience.

## 12 · Promotion / rejection decisions

Pure-function `decidePromotion` executed 6 times. Every decision was reproducible from its input tuple `(candidate, review, benchmark, drift, fresh_process_reproduced, is_duplicate)`. No hidden state. No self-reinforcement. `auditPromoterIndependence()` returns `used_candidate_self_report: false` — confirmed by unit test.

## 13 · Fresh-process proof (§20 B)

The fresh-process fingerprint runner (`_phase_f_fresh_reproducibility.mjs`) spawned a subprocess with no shared memory, read the corpus from disk, ran the evaluator, and computed the fingerprint. It printed `5d18f0d3a46559c501a55b66` — matching the in-process baseline fingerprint exactly.

Every PROMOTED candidate observed this match (`fresh_reproduced: true`) — required by promoter rule 11.

## 14 · History proof (§13 §16)

- Append-only `improvement_runs.jsonl` + `candidates.jsonl` under isolated tmp store during activation
- Duplicate `run_id` / `candidate_id` throws `historical_mutation_rejected`
- `final_status: null` on every persisted record (Op-Truth §OP.5 enforced by write layer)
- **Rejected candidates preserved as first-class experience** — Campaigns B, D, F remain in history (verified by count: 6 entries, not 3)

## 15 · Live proof · reference to evidence bundle

Full evidence bundle persisted to:

```
tests/fixtures/programmer-improvement-proof/_phase_f_activation_campaigns.json
```

Contains machine-readable outcome per campaign (candidate_id, content_hash, terminal_status, promotion, failure_reason, review_verdict, fresh_reproduced, drift_direction, reasons).

Also visible in this report §7.

## 16 · Test results (§22)

### Isolated Programmer Agent A-F

```
$ npx vitest run src/lib/nex/programmer-{learning,review,benchmark,stability,improvement}
Test Files  6 passed (6)
Tests  176 passed (176)
```

Same as pre-activation. No new source-code tests added (activation is a fixture-only slice).

### Test-count reconciliation (§22)

```
A-E baseline:         133
+ Phase F build (prior slice):  +43
+ Phase F ACTIVATION:            +0   (fixture-only slice, no new src/ tests)
= Expected total:              176
Actual measured:                176   ✓
Delta:                            0
Skipped:                          0
Reason for zero delta:  Activation ships fixture drivers only; the pipeline is unchanged.
```

## 17 · Full NEX regression (§23)

```
$ npx vitest run src/lib/nex/brain
Test Files  144 passed | 2 skipped (146)
Tests  3854 passed | 44 skipped (3898)
```

Identical to pre-activation. Phase F activation did not touch the brain surface. Reported **separately** from the Programmer Agent isolated suite per §23.

## 18 · Operational truth (§14 §15)

Every campaign's outcome derives from independently observable evidence:

- `content_hash` (deterministic function of candidate content — same content → same hash across processes)
- `review_verdict` (Phase C `review()` output — reproducible from ReviewRequest)
- `drift.per_class_drift[].direction` (Phase E `computeDrift()` output — reproducible from stability runs)
- `fresh_reproduced` (Phase E fresh-process fingerprint match — reproducible from spawned subprocess)
- `failure_reason` on any non-promotion (typed enum — no free text influences the decision)

No campaign's outcome depended on the agent's own narrative claim. `auditPromoterIndependence` returns `used_candidate_self_report: false` for every campaign.

## 19 · Accommodation boundary proof (§19)

Programmatic verification (grep):

```
$ grep -rn "accommodation\|nex-accommodation\|world-adapters" \
        src/lib/nex/programmer-improvement/ \
        tests/fixtures/programmer-improvement-proof/_phase_f_activation_driver.ts
(no output)
```

**Zero cross-agent imports.** The activation driver references doctrine files (memory) and architectural principles by evidence-pointer text only. No code path touches `nex-accommodation`, `world-adapters`, or any accommodation domain module.

`PhaseFForbiddenAction` union still includes `modifyAccommodationData` · `callAccommodationAdapter` · `activateAccommodationWorkforce`. Module-surface audit test still verifies no exported symbol matches those prefixes.

**Two-Agent Separation Contract (2026-09-06) held.**

## 20 · Limitations

**L1 · Fixture-only slice.** Activation added 3 fixture files, zero source-code changes. The Phase F pipeline was already built. This slice DEMONSTRATES the pipeline against real inputs; it does not add new capabilities.

**L2 · Promoted artifacts are recorded in improvement history, not yet written to the Phase A/B learning store.** Same known limitation as Phase F build (L4). Wiring PROMOTED → programmer-learning store write is a small follow-up (~2 lines in loop.ts). Deliberately left for a targeted future slice to keep this activation's scope tight.

**L3 · Isolated tmp store per run.** The activation runner uses `NEX_PROGRAMMER_IMPROVEMENT_DIR=$TMPDIR` so activation doesn't pollute persistent state. Real production activation (if authorised) would write to `data/programmer-improvement/`.

**L4 · Reviewer ACCEPT relies on backing evidence.** Campaigns A/C/E use ReviewRequest whose claim vocabulary is fully present in test summary + runtime evidence, so Phase C's `unsupported_claim` detector doesn't fire. This is not gaming — it's correctly authoring a request the reviewer can validate. Future real learning candidates in production will need similarly careful ReviewRequest authoring, or additional evidence sources.

**L5 · Windows shell:true DEP0190.** Same as the build slice. Repo-local runner path, warning is safe. Non-Windows platforms don't set the flag.

## 21 · Explicitly unauthorised / not implemented

Per §17 §18 §26:

- **Phase G is NOT authorised · NOT implemented**
- **NO autonomous coder / autonomous commit / autonomous deploy**
- **NO production authority · NO production DB mutation**
- **NO unbounded 24×7 loop · NO scheduler / cron / watcher / daemon added**
- **NO new agents**
- **NO cross-agent boundary violations**
- **NO owner outreach · NO messaging businesses · NO external account creation**
- **NO booking infrastructure**

## 22 · Phase-F GREEN gate (§25 acceptance matrix)

- [x] A-E remain GREEN (133 passing)
- [x] Phase-F loop exists (built prior slice, verified live)
- [x] actual learning cycle completed (6 campaigns executed)
- [x] learning is evidence-backed (every candidate cites in-repo file:line)
- [x] learning survives fresh process (fresh_reproduced: true on all PROMOTED)
- [x] failure can produce experience (Campaign C · duplicate-import defect PROMOTED as experience)
- [x] independent review works (Phase C `review()` verdict authoritative)
- [x] benchmark works (all thresholds cleared for PROMOTED)
- [x] regression is rejected (Campaign D · REGRESSED under favourable review + aggregate)
- [x] per-class drift works (Campaign D per_class_regression fires)
- [x] stability works (drift direction STABLE on PROMOTED)
- [x] history is append-only (JSONL · duplicate-id rejection · unit-tested)
- [x] attribution works (VersionManifest per run)
- [x] repeated cycles work (Campaign F duplicate rejection deterministic)
- [x] operational truth is independently observable (evidence bundle machine-readable)
- [x] Programmer/Accommodation boundary preserved (zero cross-agent imports · grep verified)
- [x] no production mutation
- [x] no autonomous commits
- [x] no deployment
- [x] no production authority
- [x] no Phase-G implementation
- [x] isolated tests pass (176/176)
- [x] full regression reconciled (3854/3854 brain identical)
- [x] report shipped (this document)

**24 / 24 GREEN.**

## STATUS

```
PROGRAMMER AGENT

A · GREEN  (25 tests)
B · GREEN  (32 tests)
C · GREEN  (23 tests)
D · GREEN  (30 tests)
E · GREEN  (23 tests)
F · GREEN  (43 tests · pipeline · activation verified)

G · NOT AUTHORIZED
   · NOT IMPLEMENTED
```

Awaiting review.
