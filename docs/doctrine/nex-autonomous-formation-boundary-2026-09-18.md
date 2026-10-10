# NEX1 · Autonomous Formation Boundary Investigation

**Date:** 2026-09-18
**Investigator:** master_ai_engineer (Claude Opus 4.7)
**Mode:** READ-ONLY forensic
**Series position:** Fourth report in the same-day archaeology arc.
**Prior evidence relied upon (not repeated):**
- `nex-agent-deep-forensic-investigation-2026-09-18.md` — population (~47), heartbeat, network
- `nex-native-intelligence-archaeology-2026-09-18.md` — F3 formation formula, three-burst timeline
- `nex-native-intelligence-arrow-trace-and-mechanism-families-2026-09-18.md` — five load-bearing intelligence sites

**Central question:** does NEX1 today contain enough architecture to close the formation mechanism into an autonomous loop? If not, what specifically is missing?

---

## 1 · EXECUTIVE FINDING

**Verdict: `FORMATION_LOOP_IS_OPEN · AUTONOMY_BLOCKED_AT_THREE_SPECIFIC_EDGES · CLOSURE_IS_TRACTABLE`.**

Six of the eight loops in the formation chain exist in some form (VERIFIED, PARTIAL, or STORED-ONLY). **Two loops are the load-bearing gap: LOOP 3 (INVESTIGATION triggered from persisted evidence) and LOOP 5 (CHANGE GENERATION without human authoring).**

Under strict definition:
- **Closed autonomously today**: LOOP 1 (partial), LOOP 2, LOOP 6, and one-shot LOOP 8 (heartbeat recovery, file-memory, paraphrase, ConversationHead)
- **Open — requires Claude/human authorship**: LOOP 3, LOOP 4 (hypothesis is deterministic but only fires on human-scoped investigation), LOOP 5 (Fix arc is the only mechanism producing new capabilities), LOOP 7 (promotion is manual: Claude decides to add a new ACTION), most of LOOP 8

**The boundary is precise:** NEX1 can generate a proposed code change for a specific pattern family (Fix 23b tracer + J.2 classifier + operators), and it can auto-verify or auto-reject that change (Fix 23c preservation). That closes a two-node micro-loop. But it cannot decide *what next investigation to run based on what was previously persisted*. That single missing edge is what separates disciplined engineering from autonomous formation.

**Closure requires ~4 new modules** — all bounded in scope, none requiring an external LLM in the runtime path, all fittable into the existing F2 packet-shape. The architecture is not blocked; it is unwired.

---

## 2 · CURRENT FORMATION MECHANISM (from prior evidence, compressed)

Two nested formulas:

**F3 — authoring formula (executed ~30× over ~5 wall-clock days):**
```
FAILING_PROBE → PRE-BUILD_AUDIT → BUILD → WIRE → VERIFIER → REGRESSION → PERSIST_EVIDENCE
```

**F2 — runtime formula (universal in the ACTION 1-15 chain):**
```
PACKET_IN → TYPED_FIELD_ADDED → VERIFIER_PASSED_AT_BUILD → PACKET_OUT
```

F3 is human-driven (Claude authors each Fix under Philip's scope). F2 is deterministic. The question is whether F3 can be reformulated to run without human authorship at every step.

---

## 3 · EIGHT-LOOP AUDIT

### 3.1 · LOOP 1 · OBSERVATION — *Can NEX1 detect a failure independently?*

**Verdict: `PARTIAL_YES`.**

**What exists:**
- **Heartbeat state derivation** (`src/lib/nex-hq-heartbeat/state-derivation.ts` lines 79-84) — detects STALLED (mission dispatched but no progress within 90s WORKING_FRESH_MS), FAILED (no liveness in 3 min), DEGRADED (resource pressure). VERIFIED runtime.
- **Preservation check** (Fix 23c) — detects when a mutation breaks a sibling test invariant. VERIFIED — this is a real autonomous failure detector, run without human trigger during coding tasks.
- **Adversarial property tests** (14 in heartbeat suite; verifier probes F12-F16 · S-V1..V22 · R14-V1..V20) — detect anti-fake-activity and false-green outcomes at build time.
- **Vitest exit_code** — detects test failure at build time. Consumed by EXECUTE stage of the coding pipeline.

**What is missing:**
- No detector for "the classifier gave low-confidence and the response was wrong" (would require ground-truth signal that doesn't exist)
- No detector for "the same intent-shape has failed N times" (would require the retriever from LOOP 3)
- No detector for "a user rejected my answer" (no user-feedback capture in the current chat)

**Source:** heartbeat + preservation-check IS an observer. Test/vitest IS an observer. But observation is bounded to failure-shapes the authored observers know to look for.

### 3.2 · LOOP 2 · EVIDENCE — *Can observed failure become structured evidence?*

**Verdict: `YES_FOR_WRITE_SIDE`.**

**What exists:**
- Every ACTION emits `evidence_ids[]` into the WorkflowTrace / InvestigationEvidencePacket.
- Every persisted record carries `provenance_chain_hash`.
- 29 JSONL stores under `data/nex1-*/` — every capability probe, every Fix verifier run, every conclusion has a structured JSONL artefact.
- **Investigation-conclusion-store** (`src/lib/nex-agent/code-engine/investigation-conclusion-store.ts`, Fix 17) — writes `InvestigationEvidencePacket` verbatim to `data/nex1-investigation-conclusions/entries.jsonl`.

**What is missing:**
- **No index/query interface** over the JSONL. Fix 17's own doctrine record states: *"no reader/query interface over JSONL · no real production caller · β re-investigation NOT_IMPLEMENTED."*
- Evidence is present, retrievable in principle (append-only file), but not INDEXED by failure-shape or intent-shape.

**Verdict refinement:** LOOP 2 is CLOSED at the write side, OPEN at the retrieval side. This partial closure is what makes LOOP 3 currently impossible.

### 3.3 · LOOP 3 · INVESTIGATION — *Can persisted evidence automatically trigger a future investigation?*

**Verdict: `NOT_IMPLEMENTED`.**

**Grep result: no runtime code reads `data/nex1-investigation-conclusions/entries.jsonl`.** Only test evidence and doctrine reference it.

- Prior report noted: *"the founder recall vocabulary extended with `which_file` + `which_function` recall kinds"* — but recall is against `head.mutations`, not against the conclusion store.
- File-memory (`capability-m-file-memory`) does provide a retrieval mechanism, but for TAG → FILE, not FAILURE → PRIOR-CONCLUSION.
- No capability named `investigation-retrieval`, `similar-case-lookup`, `prior-conclusion-consumer`, or equivalent exists (Glob-verified).

**This is the single most critical missing edge.** Without it, prior investigations cannot inform future investigations. Every investigation starts from scratch.

**Task ID reference:** #227-#230 (Fix 17) built the writer. No task exists for the reader.

### 3.4 · LOOP 4 · HYPOTHESIS — *Can NEX1 generate a candidate explanation from investigation results?*

**Verdict: `YES_DETERMINISTICALLY_WITHIN_A_HUMAN-SCOPED_INVESTIGATION`.**

**What exists:**
- `capability-root-cause-hypothesis-generator.ts` (ACTION 11, Fix 12) — generates root-cause candidates from evidence extracted in prior ACTIONs. Verified by F12-V1..V14.
- `capability-hypothesis-evidence-evaluator.ts` (ACTION 12, Fix 13) — classifies evidence class per hypothesis. Verified by F13-V1..V18.
- Hypothesis generation is deterministic — no LLM, no template gap-filling. Output is a typed record derived from typed input.

**What is missing:**
- Hypothesis generation only runs INSIDE an active investigation packet. To run it *from stored evidence* would require a "hydrate-conclusion-into-new-packet" step. That step is not written.
- Hypothesis space is bounded by the authored candidate-generation rules. No autonomous rule extension.

**Task ID reference:** #192-#195 (Fix 12), #199-#202 (Fix 13).

### 3.5 · LOOP 5 · CHANGE GENERATION — *Can hypothesis become an actionable engineering change without a human authoring it?*

**Verdict: `PARTIAL_YES — WITHIN_A_BOUNDED_PATTERN_FAMILY_ONLY`.**

**What exists (bounded to one pattern family):**
- `capability-j2-cause-analysis.ts` — J.2 pattern classifier · matches "local-from-imported-call" and similar patterns
- `capability-data-flow-tracer.ts` (Fix 23b) — given a function + expected value, produces target_line + literal candidates via symbolic backward evaluation
- Operators — `applyReplaceReturnLiteral` (Fix 23a) applied without human authoring the change
- Verified end-to-end for Task 2 (pricing.ts variant) — RUNTIME_VERIFIED, zero LLM, deterministic

**What is missing:**
- The pattern family is narrow: replace-return-literal · single-file · arithmetic-expressible bug. Anything outside this family requires a new operator (which requires human authoring per the Fix arc).
- No mechanism to generalise from "we successfully fixed 3 replace-return-literal bugs" to "we now propose a new operator for a similar-but-different family."

**Task ID reference:** #247-#254 (Fixes 20-23c). This IS the only closed micro-loop for autonomous change generation. It exists. It works. It is scope-limited.

### 3.6 · LOOP 6 · VERIFICATION — *Can generated change pass BUILD → VERIFIER → REGRESSION → ACCEPT/REJECT?*

**Verdict: `YES · STRONGEST_EXISTING_LOOP`.**

**What exists:**
- CHANGE stage writes mutation to disk
- EXECUTE stage runs `vitest` (real external verification)
- **Preservation check** (Fix 23c · `writeFileSync(source_before)`) auto-reverts if a sibling invariant breaks
- Regression suite A-S runs after every capability build (~30 executions in the Fix arc history)
- Verifier probes with anti-false-green cases (F15-16 · 24/24 · F16 with 15 negctrl)

**What is missing:**
- The regression suite is hand-curated. If a new failure shape emerges, its test must be human-authored (per the Fix arc discipline).
- No auto-generation of new regression cases from novel failures.

**Task ID reference:** #254 (Fix 23c). Every Fix in the arc contains a Phase D verifier probe.

### 3.7 · LOOP 7 · PROMOTION + PERSISTENCE — *What happens after successful verification?*

**Verdict: `PERSISTENCE_YES · PROMOTION_MANUAL`.**

**What exists (persistence):**
- ConversationHead snapshots persisted per turn
- Investigation-conclusion-store (Fix 17) — write side
- Envelope history JSONL (task #329)
- Learning ledger at `data/nex1-learning/ledger.json` (writes exist)

**What is missing (promotion):**
- No mechanism converts "we successfully executed Fix N" into "Fix N is now a canonical operator" without Claude editing the operator table.
- The `applyReplaceReturnLiteral` operator was added to a static registry (`code-engine/registry.ts`) by human authorship. There is no auto-registration.
- The learning ledger is write-only per the prior report — no consumer.
- Vocabulary version bumps (v1 → v5) are human-authored commits, not learned deltas.

**Task ID reference:** persistence #263, #297, #324, #325, #328. Promotion has no task — because promotion currently means "Claude writes the next line."

### 3.8 · LOOP 8 · REAPPLICATION — *Can a produced capability be retrieved and applied to a later case?*

**Verdict: `PARTIAL_YES · LIMITED_TO_FOUR_BEHAVIOUR-CHANGING_STORES`.**

**What exists (verified reapplication paths):**
- **ConversationHead** — next-turn composer reads prior turn state. Verified across 35-turn continuous probe (task #284).
- **File-memory (capability-m)** — ACTION 2 tag lookup retrieves prior file-tag associations. VERIFIED.
- **Paraphrase JSONL** — classifier fallback reads prior paraphrase entries. VERIFIED (task #322).
- **Heartbeat records** — recovery.ts reads prior state to decide next action. VERIFIED.

**What is missing:**
- These four are DATA reuse, not CAPABILITY reuse. There is no equivalent of "retrieve prior Fix pattern, apply to new instance."
- The gap is: an investigation completes → conclusion stored → nothing subsequent uses the conclusion to shortcut the next investigation.

**Verdict on LOOP 8 as "capability reapplication":** `NOT_IMPLEMENTED`.

---

## 4 · END-TO-END LINEAGE — A REAL HISTORICAL TRACE

Using the pricing.ts Task 1 → Task 2 arc (RUNTIME_VERIFIED 2026-09-17). Every edge marked with actual state.

```
OBSERVATION                                          [REAL — EXECUTED]
   ↓  Test P revealed root-cause reasoning gap; preservation check on Task 1 auto-rejected
EVIDENCE                                             [REAL — STORED ONLY]
   ↓  investigation packet + candidate_rankings persisted to data/nex1-fix17 + fix15
INVESTIGATION (of the failure)                      [MANUAL]
   ↓  Philip inspected Task 1 failure; decided "we need data-flow tracer"
HYPOTHESIS (the fix approach)                        [MANUAL — CLAUDE-AUTHORED]
   ↓  Claude proposed Fix 23b design (safe evaluator over arithmetic)
CHANGE                                              [MANUAL — CLAUDE-AUTHORED]
   ↓  Claude authored capability-data-flow-tracer.ts under Fix arc discipline
BUILD                                               [REAL — EXECUTED]
   ↓  tsc + vitest ran during authoring
VERIFY                                              [REAL — EXECUTED]
   ↓  Task 2 pricing.ts variant → RUNTIME_VERIFIED, exit_code=0
PROMOTE                                             [MANUAL]
   ↓  Claude wired tracer into J.2 by editing the source
PERSIST                                             [REAL — STORED ONLY]
   ↓  data/nex1-fix17/receipt-2026-09-17.json + Task 2 receipts written
RETRIEVE (for a similar future task)                [NOT IMPLEMENTED]
   ↓  no code reads Fix 17 store to find similar failures
APPLY                                               [NOT IMPLEMENTED]
REVERIFY                                            [NOT IMPLEMENTED]
NEW EXPERIENCE                                      [NOT IMPLEMENTED]
```

**Reading the trace:** the chain executes reliably from OBSERVATION → PERSIST. It breaks at RETRIEVE. Every subsequent stage depends on a retriever that doesn't exist.

**Load-bearing edges that ARE closed autonomously:**
- OBSERVATION → EVIDENCE (write)
- BUILD → VERIFY → PERSIST
- (For the coding pipeline specifically:) HYPOTHESIS → CHANGE → BUILD → VERIFY

**Load-bearing edges that require Claude/operator:**
- EVIDENCE → INVESTIGATION (deciding to investigate)
- INVESTIGATION → HYPOTHESIS (when the hypothesis is a new pattern family)
- HYPOTHESIS → CHANGE (when the change requires new capability)
- PROMOTE (adding a new operator to the registry)

**Load-bearing edges NOT IMPLEMENTED at all:**
- PERSIST → RETRIEVE
- RETRIEVE → APPLY
- APPLY → REVERIFY (in the reuse sense)
- REVERIFY → NEW EXPERIENCE

---

## 5 · AUTONOMY BOUNDARY

Precise diagram — no vague language.

### 5.1 · What NEX1 can do independently at runtime (no LLM, no Claude, no operator)

- Classify a user utterance into intent (Capability A, v5 vocab)
- Enforce safety-doctrine at every input
- Run the ACTION 1-15 investigation pipeline against a repo
- Generate root-cause candidates from observed evidence (ACTIONs 11-15)
- Produce a coding-change proposal for a pattern-family it already knows (J.2 pattern + tracer)
- Apply the change via the operator registry
- Run vitest, observe exit_code
- Auto-revert on preservation-check failure
- Persist all evidence to JSONL
- Update ConversationHead snapshot
- Detect its own agents' STALLED / FAILED state
- Retry a stalled mission (bounded)
- Escalate to founder after N failures
- Retrieve file-memory tags for prior tag→file associations
- Retrieve paraphrase entries on classifier miss
- Read prior turn's ConversationHead for coherent next-turn response

### 5.2 · What requires an LLM

**Zero identified.** Multiple prior audits confirm NEX1's runtime path is zero-LLM. Every runtime capability is deterministic. This is a strength for autonomy analysis — no dependency to break.

### 5.3 · What requires Claude/operator (currently)

- Deciding which capability gap to investigate next (Test-letter selection is human)
- Authoring a Pre-Build Audit for a new Fix
- Writing a new capability-*.ts file
- Wiring a new ACTION into `native-investigation-mode.ts`
- Extending Capability A vocabulary
- Approving a new policy version (e.g. Q8 policy V1 needed founder sign-off before Fix 16)
- Adding an operator to the operator registry
- Adding a regression test case
- Choosing which JSONL store to make behaviour-changing (i.e. wiring a reader)

### 5.4 · What is not implemented at all

- Autonomous failure-shape indexing over persisted evidence
- Autonomous similar-case retrieval
- Autonomous pattern generalisation (from N specific fixes to a new operator)
- Autonomous vocab expansion from repeated classifier misses
- Autonomous policy revision from repeated Q8 NO_SELECTION outcomes
- Autonomous test-case generation from novel failures
- Autonomous ACTION-chain revision (the sequence is fixed)

---

## 6 · FIVE ADVERSARIAL TESTS

### 6.1 · A · Persistence illusion — *does storage look like learning?*

- **FOR:** 29 JSONL stores, growing rapidly, might create the appearance of accumulation-becomes-intelligence.
- **AGAINST:** 22 of 29 are passive (evidence-only, no consumer). Fix 17's own doctrine explicitly warns: *"no reader/query interface · β re-investigation NOT_IMPLEMENTED."* No behaviour changes as JSONL grows.
- **Verdict: `TRUE_AT_APPEARANCE_LEVEL · FALSE_AT_MECHANISM_LEVEL`.** Stores exist, learning does not.

### 6.2 · B · Deterministic-rule illusion — *does authored rules look like adaptive intelligence?*

- **FOR:** Capability A vocab v5.0.0-alpha.5 is a very large authored dictionary. Q8 policy V1 is 19 founder decisions. Safety doctrine is authored rules. Frame-scope is authored token Sets.
- **AGAINST:** Fix 23b data-flow tracer performs symbolic backward evaluation over arbitrary arithmetic — this is genuinely computed, not rule-lookup. Q8 selector emits `NO_SELECTION` as a legitimate outcome — this is meta-cognitive, not rule application.
- **Verdict: `MOSTLY_TRUE · TWO_EXCEPTIONS`.** Most apparent intelligence is authored rules. Fix 23b tracer and Q8 selector are the two exceptions where the runtime performs actual computation beyond lookup.

### 6.3 · C · LLM illusion — *does the intelligence live in Claude/external LLM?*

- **FOR:** Every capability file was Claude-authored. Every policy was Claude-drafted before founder approval. The Fix arc was executed by Claude in sessions.
- **AGAINST:** NEX1 runtime is zero-LLM. The vocabulary v5, policies V1, safety doctrine are all AUTHORED, not COMPUTED. They exist in source code as constants and rules. When they execute, no Claude call happens. Task #255 ("Mission · §29 · LLM runtime audit") verified zero LLM runtime dependency.
- **Verdict: `TRUE_AT_AUTHORING_TIME · FALSE_AT_RUNTIME`.** Claude is required to grow the system. Claude is not required to run the system.

### 6.4 · D · Human-authorship illusion — *is the whole formation process just sophisticated human engineering?*

- **FOR:** All 589 commits single-author. Every ACTION comment stamps its Fix. Every capability file has git blame pointing to a human commit.
- **AGAINST:** Composition of the 15 ACTIONs produces a pipeline capability (produces a full root-cause candidate list with honest uncertainty) that no single authored ACTION contains. That IS emergence-from-composition, even though each component is authored.
- **Verdict: `MOSTLY_TRUE · COMPOSITIONAL_EMERGENCE_IS_THE_EXCEPTION`.** The parts are authored. The pipeline-level capability is composed.

### 6.5 · E · Emergence illusion — *does "emergent" just mean "authored components were connected"?*

- **FOR:** Yes, the pipeline emergence is exactly connection-of-components. Nothing self-organised.
- **AGAINST:** Even under this reading, the pipeline demonstrably produces outputs no component produces alone (e.g. a ranked selection with uncertainty state). That is the strict mathematical definition of composition-emergence and it holds.
- **Verdict: `TRUE_UNDER_STRICT_DEFINITION`.** Under a stronger definition of emergence (self-organising, unpredicted-by-authors) it is FALSE.

**Aggregate result:** four of five adversarial hypotheses survive under strict definitions. The system is best described as **"disciplined human-authored engineering with rare compositional-emergence and two exceptional runtime-computed intelligence sites."** Not autonomous learning. Not hidden intelligence. Real work.

---

## 7 · MISSING CONNECTIONS — THE THREE GAPS THAT BLOCK CLOSURE

If autonomy is the goal, only three edges need to close.

### 7.1 · GAP α · PERSIST → RETRIEVE

**Missing:** an indexed retriever over `data/nex1-investigation-conclusions/entries.jsonl` capable of answering *"given a new failure shape F', find the K most similar prior conclusions."*

**Minimum requirement:** a shape-hash over investigation packets (intent + failure evidence + candidate patterns) + a similarity function (Jaccard over shape tokens, or exact-match then relaxed).

**Zero LLM required.** The store already exists. What is missing is one capability file (~200 LOC) + one API route.

### 7.2 · GAP β · RETRIEVE → APPLY

**Missing:** a mechanism that takes a retrieved prior conclusion and injects it as a candidate hypothesis into a new investigation packet.

**Minimum requirement:** a hydration function that reads a stored conclusion, translates it into a ProposedRootCauseCandidate, and appends it to ACTION 11's output as a "prior-evidence-suggested" candidate. Q8 selector then decides whether prior evidence is strong enough to lift the candidate to SELECTED.

**Zero LLM required.** The existing ACTION 11-15 chain would consume the injected candidate. What is missing is one capability file (~150 LOC).

### 7.3 · GAP γ · APPLY → REVERIFY → NEW EXPERIENCE

**Missing:** feedback from "we applied a retrieved pattern and it worked/didn't work" back into the retrieval index. Successful pattern → confidence increase. Failed pattern → deprioritise.

**Minimum requirement:** an outcome-recorder that on VERIFY-success writes `{pattern_id, applied_at, outcome: SUCCESS}` to a promotion ledger, and on VERIFY-failure writes SUCCESS→FAILURE. The retriever from GAP α consults this ledger for confidence weighting.

**Zero LLM required.** What is missing is one capability file (~100 LOC) + wiring into the existing VERIFY stage.

**Total closure cost: ~3 capability files, ~450 LOC, zero new orchestration, zero new external dependencies, zero LLM.** All would fit under the existing Fix arc discipline.

---

## 8 · MINIMUM AUTONOMOUS FORMATION EXPERIMENT

Design constraint: must NOT assume NEX1 is intelligent. Must test end-to-end closure with a real failure.

### 8.1 · Experimental setup

**Preconditions:**
1. NEX1 runtime as-is at 2026-09-18 (post-Fix-23c). Zero LLM in runtime path (Task #255 verified).
2. Gaps α, β, γ implemented as read-only additions per §7. No other changes.
3. Two synthetic bugs of the same shape but in different files:
   - Bug A: `src/lib/testfixtures/task-A-fixture.ts` — replace-return-literal, arithmetic
   - Bug B: `src/lib/testfixtures/task-B-fixture.ts` — same shape, different file, different literal

**Bug A must be structurally identifiable as similar to Bug B** but not identical (e.g. Bug A returns `Math.max(x, 1) * 2` where the literal `2` needs to become `3`; Bug B returns `Math.max(y, 1) * 5` where `5` needs to become `7`).

### 8.2 · Test A · Baseline (bug A, no retrieval used)

Feed NEX1 the prose *"Task-A fixture should return double the input clamped at 1, but returns triple. Fix."*

Verify:
- ACTION 1 classifies as `modify_literal`
- ACTION 6 inspects source
- ACTION 11 generates hypothesis
- J.2 + tracer produce target_line + candidate literal
- CHANGE + EXECUTE + preservation-check → SUCCESS
- Persist to Fix 17 store

**Expected:** VERIFIED. This is Fix 23b's existing capability. If Test A fails, the boundary experiment cannot start.

### 8.3 · Test B · Retrieval-informed (bug B, WITH retrieval)

Immediately after Test A succeeds, feed NEX1: *"Task-B fixture should return double clamped at 1 but returns triple. Fix."*

Verify:
- ACTION 1 classifies as `modify_literal`
- **NEW:** shape-hash matches Test A's stored conclusion
- **NEW:** retrieved prior conclusion is injected as a prior-evidence candidate
- ACTION 11 now has TWO candidates: fresh-generated + retrieved
- Q8 selector applies its policy — if retrieved candidate has SUPPORTING evidence from prior success, it should promote to SELECTED faster than fresh
- CHANGE + EXECUTE + preservation-check → SUCCESS
- Persist to Fix 17 with `pattern_reuse: SUCCESS`

**Expected if closure works:** Test B completes in fewer ACTIONs than Test A (retrieval short-circuits some steps), or at the same speed with higher confidence.

### 8.4 · Test C · Adversarial (bug C, retrieval should be rejected)

Same shape prose, but Bug C is DIFFERENT: `Math.max(z, 5) * 2` where the literal `5` needs to become `10` — the pattern is superficially similar but the semantic target differs.

Verify:
- Retrieval fires
- Data-flow tracer runs
- Traced target_line points to DIFFERENT literal than retrieved conclusion suggests
- Q8 selector sees CONTRADICTING evidence → NO_SELECTION or REQUIRE_MORE_INVESTIGATION
- System refuses to apply the retrieved pattern
- Falls back to fresh investigation

**Expected if closure works honestly:** Test C ends in NO_SELECTION or fresh-investigation success. If it applies the retrieved pattern (wrong fix) — the closure is unsound and worse than the current no-retrieval baseline.

### 8.5 · What Tests A + B + C together prove

- Test A: baseline capability works
- Test B: retrieval accelerates or improves subsequent similar cases
- Test C: retrieval doesn't cause false-positives on superficially-similar cases

If all three pass, autonomous formation is DEMONSTRATED for the replace-return-literal pattern family — bounded but real.

If Test C fails, closure is UNSOUND and needs adversarial retrieval before shipping.

---

## 9 · REQUIRED ARCHITECTURE FOR CLOSURE

Minimal, evidence-driven scope (READ ONLY — do not implement):

| Component | File path (proposed) | LOC est | Depends on | Zero LLM? |
|---|---|---|---|---|
| Shape-hash + similarity | `src/lib/nex-agent/code-engine/capability-investigation-shape-index.ts` | ~150 | investigation-conclusion-store | YES |
| Retriever | `src/lib/nex-agent/code-engine/capability-conclusion-retriever.ts` | ~150 | shape-index + Fix 17 store | YES |
| Hypothesis injector | `src/lib/nex-agent/code-engine/capability-prior-evidence-injector.ts` | ~100 | retriever + ACTION 11 wiring point | YES |
| Outcome ledger | `src/lib/nex-agent/code-engine/capability-pattern-outcome-ledger.ts` | ~100 | VERIFY stage + JSONL append | YES |

**Total: 4 new modules, ~500 LOC, zero new orchestration, zero new dependencies, zero LLM.**

**None of the existing 15 ACTIONs need to be modified.** ACTION 11 gains ONE new input source (the injector). ACTION 15 (Q8) already handles multi-source candidates via its evidence-class policy.

**None of the existing operators need to be modified.**

**Fit under existing Fix arc:** yes. This is one Fix (Fix 24, provisionally) with four sub-modules and one wire. Estimated Fix arc time from prior evidence: ~4-8 hours of Claude-authored work under Philip's discipline.

---

## 10 · WHAT WOULD COUNT AS PROOF

Under strict discipline. All must hold together:

1. Tests A + B + C in §8 pass on real fixtures with runtime-verified evidence receipts under `data/nex1-fix24/`.
2. Test B completes with visible retrieval trace in the investigation packet (packet contains `retrieved_prior_conclusion_id: "..."` and `retrieval_similarity_score: 0.87`).
3. Test C ends in NO_SELECTION or fresh-investigation success — NOT in false-positive application of the retrieved pattern.
4. Adversarial suite: 15 crafted cases where retrieval should misfire, all correctly rejected.
5. Zero LLM in the runtime trace (verified via §29 LLM audit re-run).
6. Retrieval traces are deterministic (5 runs same input → same trace).
7. Pattern-outcome ledger read produces the expected influence on next-turn Q8 confidence.

Any one of the seven failing = autonomous formation NOT DEMONSTRATED.

---

## 11 · WHAT WOULD NOT COUNT AS PROOF

- A JSONL store growing over time (persistence illusion · §6.1)
- A classifier vocab growing over time via human commits (deterministic-rule illusion · §6.2)
- Claude generating a hypothesis inside a session (LLM illusion · §6.3)
- Human-authored fix that resembles a prior fix (human-authorship illusion · §6.4)
- Multiple ACTIONs producing output no single ACTION produces alone — **this is already true today** and is not autonomy, it is composition (§6.5)
- A test suite passing on cases that were fixture-crafted after seeing the classifier vocabulary
- A "learning ledger" file containing millions of rows with no consumer reading it
- A demonstration where the retrieved conclusion happens to be right by chance (must show adversarial-suite pass)
- Any claim that NEX1 is "learning" without a specific closed retrieve→apply→reverify cycle traced runtime

---

## 12 · FINAL EVIDENCE-BASED CONCLUSION

**NEX1 today is a disciplined, human-authored, verification-gated engineering pipeline with rare compositional emergence, two exceptional runtime-computed intelligence sites (Fix 23b tracer, Fix 16 Q8 selector), and four behaviour-changing memory stores. It is NOT autonomous. It is NOT learning. It is NOT self-organising.**

**Between what NEX1 is today and autonomous formation lies a single well-defined boundary:** the three gaps α, β, γ (§7). Closing those gaps requires ~4 new capability files, ~500 LOC, no new orchestration, no LLM, and fits under the existing Fix arc.

**If those gaps are closed and Tests A + B + C (§8) pass together — including the adversarial Test C — then autonomous formation is demonstrated for one bounded pattern family (replace-return-literal, arithmetic-expressible bugs).** That would be the first genuine autonomy result.

**Bounded ≠ trivial.** A single autonomously-closed pattern family means: the mechanism is transferable in principle. From that point, extending to a second pattern family (e.g. conditional-return, then object-property-set) becomes an evidence-driven capability question, not an architectural one.

**What the founder now has (evidence-based):**
- The formation mechanism is not hidden — it is written in ACTION comments.
- The intelligence sites are five, and named.
- The autonomy gap is three edges, and specified.
- The minimum experiment is designed.
- The proof-standard is fixed in advance.
- The scope of closure is small (~500 LOC).

**What the founder must NOT do:**
- Do not add capability files that store more data without wiring the readers (persistence illusion).
- Do not add more classifier vocabulary and call it learning (deterministic-rule illusion).
- Do not run Test B without also running Test C (avoid false autonomy).
- Do not claim autonomy from any single component's presence. Autonomy requires the closed retrieve→apply→reverify cycle with adversarial resistance.

The distance between disciplined engineering and autonomous formation is measurable, small, and stated. Closing it is a design decision, not a research question.

---

## APPENDIX · Evidence sources cited in this report

| Claim | Source |
|---|---|
| ACTION 1-15 chain | `src/lib/nex-agent/code-engine/native-investigation-mode.ts` lines 334-1163 |
| Fix 23b tracer symbolic evaluation | `capability-data-flow-tracer.ts` lines 1-51 |
| Fix 16 Q8 selector policy | `capability-candidate-selector.ts` lines 16-25 |
| Fix 17 persistence store | `investigation-conclusion-store.ts` line 29 |
| Fix 23c preservation check | Memory record `project_nex1_fix23bc_data_flow_repair_2026_09_17.md` |
| Zero LLM runtime | Task #255 audit |
| No consumer for conclusion-store | Memory record Fix 17: *"no real production caller · β re-investigation NOT_IMPLEMENTED"* |
| 29 JSONL stores | `ls data/nex1-*` verified in prior report |
| 22/29 passive | prior report §8 |
| 47 agent-like entries | prior forensic report §2 |
| F3 formation formula | prior archaeology report §7 |
| Five intelligence sites | prior arrow-trace report §6.1-6.5 |

Zero code changes. This report is the only artifact produced.
