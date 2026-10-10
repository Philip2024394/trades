# NEX1 · Closed Learning Loop Sufficiency Investigation

**Date:** 2026-09-18
**Investigator:** master_ai_engineer (Claude Opus 4.7)
**Mode:** READ-ONLY forensic — falsification-first
**Series position:** Sixth (and correcting) report. This report **falsifies the prior boundary report's ~500 LOC / three-gap sufficiency claim**.

**Prior reports in series:**
- `nex-agent-deep-forensic-investigation-2026-09-18.md`
- `nex-native-intelligence-archaeology-2026-09-18.md`
- `nex-native-intelligence-arrow-trace-and-mechanism-families-2026-09-18.md`
- `nex-autonomous-formation-boundary-2026-09-18.md` ← **the report this one corrects**
- `nex-latent-intelligence-loop-topology-2026-09-18.md`

The founder explicitly instructed: *"Do not give the answer you expect. Find the answer in the code."* This report follows that instruction and finds the prior estimate optimistic.

---

## 1 · EXECUTIVE FINDING — HEADLINE CORRECTION

**Verdict: `CLOSED_LOOP_ARCHITECTURE_NOT_CONFIRMED`.**

**Prior claim (boundary report §7):** three gaps α/β/γ, ~4 modules, ~500 LOC.

**Corrected claim (this report):** the three gaps are **necessary but not sufficient**. Direct inspection of `investigation-conclusion-store.ts` and `capability-hypothesis-evidence-evaluator.ts` reveals **at least six additional hidden gaps** that must be closed for the loop to work end-to-end.

**Most critical hidden gap:** the current Fix 17 store schema persists SOLUTION context (Q8 selection, rankings, evidence-IDs) but does NOT persist PROBLEM context (input problem statement, structural shape, applied change, runtime outcome). Retrieval-by-problem-similarity is architecturally impossible against the current schema without changing the WRITER, not just adding a reader.

**Revised minimum scope:** closer to ~1000-1500 LOC across ~7-9 modules, PLUS schema extensions to existing Fix 17 writer, PLUS a founder-policy decision on Q8-SELECTED-to-EXECUTED authority boundary (currently doctrinally forbidden — see §5.9).

**The prior estimate was optimistic because it assumed retrieval could work over the current schema. It cannot.**

---

## 2 · WHY THE PRIOR REPORT WAS WRONG

The prior report proposed:

> "GAP α · shape-hash + similarity retriever over `data/nex1-investigation-conclusions/entries.jsonl` (~150 LOC)"

This assumed the JSONL contains enough information to compute meaningful similarity. Direct inspection of `investigation-conclusion-store.ts` lines 38-60 shows this assumption is wrong.

**Actual `InvestigationConclusionEntry` schema (verbatim from source):**
```typescript
export interface InvestigationConclusionEntry {
  entry_id: string;
  timestamp: string;
  investigation_id: string | null;
  trace_id: string | null;
  source_file: string;                    // file path only
  selection_state: SelectionState;
  selected_candidate: string | null;      // opaque ID only
  candidates_considered: readonly string[];
  rankings_reference: RankingReference;
  supporting_evidence_ids: readonly string[];
  contradicting_evidence_ids: readonly string[];
  insufficient_evidence_ids: readonly string[];
  unresolved_evidence_ids: readonly string[];
  decision_reason: string;
  confidence: number;                     // fixed 0.35, INFORMATIONAL ONLY (Q8 policy §4)
  provenance: readonly {...}[];
  policy_id: "NEX1_Q8_SELECTION_POLICY";
  policy_version: "V1";
  uncertainty: string | null;
  recommended_next_action: string;
  evidence_kind: "INFERRED";
}
```

**Missing fields for retrieval-by-similarity:**
- No `problem_statement` (the input prose or task description)
- No `intent_shape` (the classified intent envelope)
- No `structural_features` (function signature, AST snapshot, involved literals)
- No `pattern_class` (e.g. `replace_return_literal` vs `add_null_check`)
- No `applied_change` (target_line, operator_kind, literal_replacement)
- No `runtime_outcome` (was the change verified? auto-reverted? no-op?)
- No `retrieval_key` / `problem_fingerprint` / shape-hash

**Retrieval possible against current schema:** by `source_file`, by `entry_id`, by `selection_state`, by evidence-ID overlap.

**Retrieval NOT possible against current schema:** by problem-shape similarity, by pattern class, by outcome success, by anything a NEW problem could match against.

**Consequence:** GAP α is not "add a retriever" — it is "extend the writer's schema AND add a retriever AND back-fill or accept a cold-start period." That is materially more work than the prior report claimed.

---

## 3 · THE PROPOSED 13-EDGE LOOP · EDGE-BY-EDGE STATUS

Each arrow in the founder's target loop, mapped to source-code evidence.

Legend used per founder instruction:
- `[REAL — EXECUTED RUNTIME]` — verified runtime, downstream consumer executes it
- `[REAL — STORE-MEDIATED AND CONSUMER VERIFIED]` — write side and read side both exist
- `[STATIC CONNECTION ONLY]` — code links exist but flow untested
- `[MANUAL]` — human/Claude authors the connection
- `[EXTERNAL LLM]` — requires an LLM
- `[TEST-HARNESS ONLY]` — exists in test file but not in runtime path
- `[STORED BUT NEVER CONSUMED]` — write succeeds, no reader
- `[NOT IMPLEMENTED]` — no code path
- `[UNKNOWN]` — evidence insufficient

| # | Edge | State | Evidence |
|---|---|---|---|
| A→B | EXPERIENCE → EVIDENCE | `[REAL — EXECUTED RUNTIME]` | Every ACTION emits typed record into packet · verifier probes prove this |
| B→C | EVIDENCE → INVESTIGATION | `[REAL — EXECUTED RUNTIME]` | ACTION chain 1-10 wired in `native-investigation-mode.ts` |
| C→D | INVESTIGATION → HYPOTHESIS | `[REAL — EXECUTED RUNTIME]` | ACTION 11 (Fix 12) `capability-root-cause-hypothesis-generator.ts` |
| D→E | HYPOTHESIS → CHANGE GENERATION | `[REAL — EXECUTED RUNTIME]` **for narrow pattern family only** | J.2 pattern classifier + Fix 23b tracer + operator; scope-limited |
| E→F | CHANGE → VERIFICATION | `[REAL — EXECUTED RUNTIME]` | EXECUTE stage (vitest) + preservation-check (Fix 23c) |
| F→G | VERIFICATION → PROMOTION/PERSISTENCE | `[REAL — STORE-MEDIATED]` **but with schema gap** | Fix 17 writes to `data/nex1-investigation-conclusions/entries.jsonl`; coding outcomes write to `data/nex1-code-engine/*`; **no unified promotion** — see §4 hidden gap 2 |
| G→H | PROMOTION → RETRIEVAL | `[NOT IMPLEMENTED]` | No reader over Fix 17 store; no retrieval-by-problem-shape mechanism |
| H→I | RETRIEVAL → APPLICATION | `[NOT IMPLEMENTED]` | Cannot apply what cannot be retrieved |
| I→J | APPLICATION → REVERIFICATION | `[REAL — EXECUTED RUNTIME]` **if a candidate reaches CHANGE** | Same as E→F once wired |
| J→K | REVERIFICATION → OUTCOME | `[REAL — EXECUTED RUNTIME]` | Verdict emitted; head updated |
| K→L | OUTCOME → UPDATED MEMORY | `[STORED BUT NEVER CONSUMED]` | Learning ledger writes exist (`data/nex1-learning/ledger.json`) but no reader; no confidence-update mechanism against Fix 17 entries |
| L→M | UPDATED MEMORY → NEW EXPERIENCE | `[NOT IMPLEMENTED]` | Requires L to feed into future selection/retrieval decisions; no such consumer exists |
| M→A | NEW EXPERIENCE → EXPERIENCE (loop close) | `[REAL — EXECUTED RUNTIME]` **for chat only** · `[NOT IMPLEMENTED]` for autonomous investigation trigger | Chat re-enters on every user turn; investigation only re-enters on explicit trigger |

**Aggregate: 6 REAL · 1 STORED-BUT-NEVER-CONSUMED · 4 NOT_IMPLEMENTED · 1 REAL-but-schema-gapped · 1 partial split (M→A).**

**The loop breaks at G→H, H→I, K→L (partially), L→M.** Four consecutive edges are non-functional. Four, not three.

---

## 4 · HIDDEN GAPS DISCOVERED — BEYOND α · β · γ

The prior boundary report named three gaps. Direct code inspection reveals more.

### 4.1 · HIDDEN GAP 1 · PROBLEM REPRESENTATION NOT PERSISTED

**Evidence:** `investigation-conclusion-store.ts` lines 38-60 (schema quoted in §2).

**Problem:** the store captures the DECISION but not the DECISION'S INPUT. There is no `problem_statement`, `intent_shape`, `structural_features`, or `pattern_class` field.

**Consequence:** any similarity-based retriever must fall back to shallow features (source_file, evidence-ID overlap) that do not reliably identify "same-shape problems."

**Fix scope:** cannot be resolved by a reader-only module. Requires:
1. Schema extension of `InvestigationConclusionEntry`
2. Modification of the writer in Fix 17 to include problem-side fields
3. Modification of the caller (`native-investigation-mode.ts` where the packet is composed for persistence) to supply those fields

**Estimated LOC (concrete evidence-based): unknown at this granularity — depends on whether upstream ACTIONs already carry the required fields. Likely ~100-200 LOC of writer/caller changes plus retriever ~150 LOC.**

### 4.2 · HIDDEN GAP 2 · CHANGE/OUTCOME NOT PERSISTED IN INVESTIGATION STORE

**Evidence:** Fix 17 store is scoped to Q8 selection. Coding pipeline outcomes live in `data/nex1-code-engine/` (per `nex1-*` store enumeration in prior report §4.3). No bridge.

**Problem:** what actually got changed, whether it verified, and whether preservation-check reverted it — none of this is in the investigation-conclusion-store. So even if retrieval finds a prior investigation, the retriever cannot know "did the resulting change actually work in the real world."

**Consequence:** retrieval quality cannot be weighted by outcome. Q8 selector currently uses Fix 15 ranking + evidence classes — none of which include outcome-history.

**Fix scope:** requires either:
- Cross-store bridge that joins investigation-conclusion + coding-outcome records by trace_id or investigation_id
- OR extended investigation-conclusion-store schema with `verified_at`, `verified_outcome`, `reverted_by_preservation`, `runtime_evidence_ids` fields (again requires writer change)

**Estimated LOC: ~100-200 LOC for bridge/schema + ~50 LOC of wiring in the coding pipeline to emit outcomes into the investigation store.**

### 4.3 · HIDDEN GAP 3 · NO PATTERN CLASS FIELD

**Evidence:** no `pattern_class` / `operator_kind` / `bug_family` field in `InvestigationConclusionEntry`.

**Problem:** the coding pipeline knows about `replace_return_literal` (J.2 pattern classifier). This information is generated during CHANGE, not during Q8 selection. It never makes it into the store.

**Consequence:** retrieval cannot filter by pattern class. Every retrieval must scan all entries and hope shape-hash similarity happens to catch same-family cases.

**Fix scope:** ~30 LOC schema addition + writer change to carry pattern_class from coding pipeline through to persistence.

### 4.4 · HIDDEN GAP 4 · CONFIDENCE UPDATE MECHANISM DOES NOT EXIST

**Evidence:** Q8 policy V1 Decision 4 (found in `capability-candidate-selector.ts` header lines 33-34): *"Confidence · fixed constant 0.35 · INFORMATIONAL ONLY · never read by selector."*

**Problem:** even if we implement retrieval + application + verification, and outcome data becomes available, **there is no mechanism that would update a stored entry's confidence based on outcome.** The stored entry's confidence is a constant 0.35. Q8 doesn't read it. There is no ledger consumer that adjusts future selections based on past success/failure.

**Consequence:** retrieval quality is STATIC. A pattern that worked 10 times is treated identically to a pattern that failed once. Learning-from-outcome is architecturally absent.

**Fix scope:** requires either (a) an outcome-ledger with confidence deltas + a Q8 policy amendment to consult it — or (b) a separate outcome-informed retrieval-weight layer sitting between retrieval and hypothesis injection. Either way ~150-200 LOC PLUS a **founder policy change** to Q8 V1 (which explicitly forbids confidence-as-selection-factor).

### 4.5 · HIDDEN GAP 5 · Q8 EVIDENCE-CLASS ENUM DOES NOT INCLUDE "RETRIEVED-PRIOR"

**Evidence:** `capability-hypothesis-evidence-evaluator.ts` lines 54-55 define only:
```
"STRUCTURALLY_SUPPORTING" | "STRUCTURALLY_CONTRADICTING" | "INSUFFICIENT" | "UNRESOLVED"
```
(plus INSUFFICIENT/UNRESOLVED variants).

**Problem:** if we inject a retrieved prior conclusion as a candidate, its evidence must land in one of these classes. There is no `RETRIEVED_SUPPORTING_FROM_PRIOR_SUCCESS` or similar. The evidence would either be classified via the existing structural rules (which have no notion of retrieval) or ignored.

**Consequence:** injected retrieved evidence flattens into structural classes, losing its provenance-as-retrieval. Q8 will treat retrieved evidence identically to fresh structural evidence — which means a retrieval-driven pattern could push a candidate to SELECTED without adversarial safety.

**Fix scope:** enum extension (breaking change to Fix 13 output) + Q8 policy amendment for the new class + ~50-80 LOC evaluator changes.

### 4.6 · HIDDEN GAP 6 · NO PROVENANCE-KIND ON CANDIDATES

**Evidence:** `HypothesisEvidenceEvaluation` and `CandidateRanking` types (from Fix 13 + Fix 15) do not include a `candidate_source: "fresh" | "retrieved_from_prior"` field.

**Problem:** without this, downstream stages cannot preferentially trust or distrust retrieved candidates. Test C (adversarial near-miss) in the boundary report §8.4 relies on this distinction to correctly reject bad retrievals.

**Consequence:** Test C cannot be made to work reliably without adding candidate-provenance-kind everywhere retrieval could flow. This is a cross-cutting concern.

**Fix scope:** type additions to Fix 12/13/14/15/16 output shapes + minor wiring changes. Not huge but touches every stage of the reasoning chain.

### 4.7 · HIDDEN GAP 7 · ADVERSARIAL REJECTION MECHANISM DOES NOT EXIST

**Evidence:** Q8 policy V1 rules R-1..R-8 (in `capability-candidate-selector.ts` lines 17-25) are threshold-based on evidence counts. No rule addresses "this candidate resembles a prior success but the current structural features do NOT match the prior success's features."

**Problem:** Test C needs the system to detect near-miss retrievals — where retrieval fires (shape-hash similar) but semantic features differ. Q8 has no mechanism to detect this.

**Consequence:** without a similarity-CONFIDENCE gate BETWEEN retrieval and hypothesis injection, a superficially similar prior fix could be applied to a semantically different case.

**Fix scope:** requires a NEW gating layer — call it the retrieval-safety-gate — that scores similarity confidence and either injects with high weight, injects with low weight, or refuses to inject. This is a NEW capability, not an edge. ~150 LOC minimum.

### 4.8 · HIDDEN GAP 8 · CROSS-STORE UNIFIED QUERY MISSING

**Evidence:** 29 JSONL stores under `data/nex1-*/` (prior report §4.3). Each with its own schema. No unified index, no unified query surface, no shared identity space.

**Problem:** genuine cumulative learning requires connecting evidence across stores — investigation outcome (Fix 17 store) with coding outcome (`nex1-code-engine`) with heartbeat record (Postgres or JSONL, depending on env) with learning-ledger. Nothing does this today.

**Consequence:** intelligence sites' evidence cannot be composed across pipelines. The cross-loop bridges (C4-C8 from the topology report) all require this unified surface.

**Fix scope:** either a new index layer (~200-300 LOC) OR schema-level identity unification across stores (larger change).

### 4.9 · HIDDEN GAP 9 · DOCTRINAL BOUNDARY: `SELECTED ≠ EXECUTED`

**Evidence:** `capability-candidate-selector.ts` line 50: *"SELECTED ≠ MODIFIED · SELECTED ≠ EXECUTED · SELECTED ≠ VERIFIED · SELECTED ≠ AUTHORIZED."*

**Problem:** this is a FOUNDER-APPROVED HARD BOUNDARY in Q8 policy V1. Fix 16 selector emits SELECTED but that outcome cannot autonomously trigger the coding-pipeline CHANGE stage. There is a policy-locked gap between selection and execution.

**Consequence:** even if HIDDEN GAPS 1-8 are closed, the loop still requires either (a) a founder policy amendment to allow SELECTED to authorize CHANGE, OR (b) a separate authorization gate that could grant execution authority based on retrieved-evidence-plus-outcome-history, OR (c) manual founder approval per closure (breaks autonomy).

**Fix scope:** this is a DECISION not a coding task. Estimated cost depends entirely on which option the founder authorises. If the answer is "SELECTED still doesn't authorise EXECUTE," then true end-to-end autonomy is architecturally forbidden by current policy.

**This is arguably the SINGLE MOST LOAD-BEARING hidden gap.** All the other gaps could be closed technically. This one requires a founder decision.

---

## 5 · SPECIAL FOCUS — THE THREE PROPOSED GAPS RE-AUDITED

### 5.1 · GAP α re-audit (PERSIST → RETRIEVE)

**Prior claim:** shape-hash + similarity retriever over existing store, ~150 LOC.

**Corrected claim:** IMPOSSIBLE against current schema without HIDDEN GAP 1 fix. Prior estimate omitted the writer-side change. Real minimum: schema extension + writer change + retriever ≈ 300-400 LOC.

Answering the founder's ten questions in §4 of the prompt:
1. **Enough information to retrieve meaningfully?** NO. Solution captured, problem not captured.
2. **Original problem representation?** NO.
3. **Successful hypothesis/change?** Only selected_candidate ID; not the change itself.
4. **Verification evidence?** Only evidence_IDs; not the outcome.
5. **Failure/rejection information?** Only via `selection_state = NO_SELECTION` — no runtime failure info.
6. **Stable identity/similarity representation?** entry_id and trace_id are stable; but no problem-shape hash.
7. **Sufficiently structured?** Partially — good for post-hoc audit; insufficient for retrieval-by-similarity.
8. **New representation required?** YES.
9. **Existing utilities reusable?** Fix 19 domain_tokens + Capability A intent classification could feed a shape-hash; but they'd need to be persisted.
10. **Similarity kind?** Would need to be a combination of intent-hash + structural-features hash + evidence-ID overlap. Not just lexical.

> **Could NEX1 retrieve the RIGHT previous experience rather than merely a similar-looking record?**
> **Answer: NOT with current schema. Would require Hidden Gaps 1, 3, 6, 7 closed together.**

### 5.2 · GAP β re-audit (RETRIEVE → APPLY)

**Prior claim:** hydrate retrieved conclusion into ACTION 11's candidate list, ~150 LOC.

**Corrected claim:** requires Hidden Gaps 5 (evidence-class extension) + 6 (provenance-kind) + 7 (adversarial gate). ~300-400 LOC not ~150.

Answering the founder's ten questions in §5 of the prompt:
1. **Where would retrieval enter?** ACTION 11 candidates array; but needs a new provenance field.
2. **Existing type/schema?** `RootCauseCandidate` — but lacks retrieval provenance.
3. **Which existing component would consume it?** ACTION 12 evaluator + ACTION 15 selector.
4. **Could Q8 consume it?** Only after evidence-class enum extension.
5. **Could hypothesis stage distinguish previous evidence / hypothesis / verified solution / failed solution?** NOT today — those distinctions don't exist in current types.
6. **Could the system reject retrieved knowledge?** Only if the retrieval-safety-gate (Hidden Gap 7) exists.
7. **Could it request more investigation?** Q8 already supports `REQUIRE_MORE_INVESTIGATION` state. Reusable.
8. **Avoid blind application?** Only with Hidden Gap 7.
9. **Would application happen before verification?** In the coding pipeline, no — preservation-check gates. Good.
10. **Any existing mechanism?** Q8 NO_SELECTION and INSUFFICIENT_EVIDENCE are reusable if the retrieval-safety-gate feeds into them.

> **Is retrieval enough, or does NEX1 need a new reasoning/decision stage before application?**
> **Answer: NEEDS A NEW STAGE — the retrieval-safety-gate (Hidden Gap 7). Bare retrieval + injection would fail Test C.**

### 5.3 · GAP γ re-audit (APPLY → REVERIFY → NEW EXPERIENCE)

**Prior claim:** outcome-ledger feeding retriever confidence, ~100 LOC.

**Corrected claim:** requires Hidden Gap 4 (confidence update mechanism) AND Hidden Gap 8 (cross-store unified query) AND Hidden Gap 9 policy decision. ~300+ LOC AND a founder decision.

Answering the founder's ten questions in §6 of the prompt:
1. **Where is success recorded?** Coding outcomes in `data/nex1-code-engine/`; investigation outcomes in `data/nex1-investigation-conclusions/`. **Disjoint.**
2. **Where is failure recorded?** Same stores but no unified failure signal.
3. **Can confidence change?** Not currently — Q8 policy V1 §4 forbids confidence-driven selection.
4. **Can a successful conclusion become less trusted?** Not without a policy amendment.
5. **Can a failed conclusion become rejected?** Not without a new ledger consumer.
6. **Can outcome influence retrieval?** Only if outcome joins to the retriever's confidence layer — Hidden Gap 4 + 8.
7. **Distinguish correct/incorrect/irrelevant/partial reuse?** Requires outcome-typing which does not exist.
8. **Does learning ledger support this?** Ledger is write-only per prior report — no consumer.
9. **Does anything consume the ledger?** Grep for `learning-ledger` readers: none found in production runtime path.
10. **Another missing consumer required?** YES — outcome-informed retrieval weight consumer AND policy authorisation to consult it.

---

## 6 · EIGHT ADVERSARIAL ATTACKS — SURVIVES vs FALSIFIED

Per founder §11:

### 6.1 · Attack A · Persistence illusion
**SURVIVES.** 22 of 29 stores are write-only per prior report. Growing files that no one reads is exactly this illusion.

### 6.2 · Attack B · Retrieval illusion
**SURVIVES.** Even if a retrieval fires against Fix 17 store today, the retrieved record lacks problem-side data, so the retrieved conclusion cannot meaningfully change the next decision. Retrieval could look like it's working while actually contributing nothing useful.

### 6.3 · Attack C · Copying illusion
**SURVIVES.** Without Hidden Gap 7 (retrieval-safety-gate), a retrieved fix could be blindly applied. Test C would fail.

### 6.4 · Attack D · Test-harness illusion
**PARTIALLY SURVIVES.** The Fix 23b tracer's runtime evidence at RUNTIME_VERIFIED did run without a test harness. But the retrieval loop would run only if we author it. If we author it in a test harness, the test-harness illusion is possible.

### 6.5 · Attack E · Human/LLM illusion
**FALSIFIED for the runtime path.** Task #255 verified zero LLM in the runtime chain. Claude authored the code but does not execute it. **SURVIVES for the authoring path** — the vocabulary, policies, and rules were authored by Claude.

### 6.6 · Attack F · False feedback
**SURVIVES.** "Success = test passed" is already the operational definition. Without Hidden Gap 4, that success does not update future behaviour. The illusion holds.

### 6.7 · Attack G · Circular logging
**SURVIVES.** The learning ledger IS this pattern today: writes outcomes back into memory, but nothing reads them to change behaviour. Prior report §8 explicitly notes: *"22 of 29 stores are passive."*

### 6.8 · Attack H · False similarity
**SURVIVES.** Without Hidden Gap 3 (pattern class) and Hidden Gap 7 (retrieval-safety-gate), a shape-hash could match a superficially similar problem whose correct solution is materially different.

**Aggregate: 6 SURVIVE fully · 1 PARTIALLY SURVIVES · 1 FALSIFIED (for runtime path only).**

**The prior report's optimistic conclusion cannot survive these attacks in its current form.** Closing α/β/γ as originally scoped would leave 6-7 attacks still open.

---

## 7 · THE FIVE INTELLIGENCE SITES · LOOP PARTICIPATION

Per founder §8:

### Site 1 · `capability-data-flow-tracer.ts` (Fix 23b)
**Loop participation:** produces target_line + literal candidates (D→E edge). Its output enters CHANGE but NOT the investigation-conclusion-store — HIDDEN GAP 2 confirmed. **Cannot become stored experience without schema change.**

### Site 2 · `capability-candidate-selector.ts` (Fix 16 · Q8)
**Loop participation:** UNCERTAINTY GATE. Would consume retrieved-prior evidence if HIDDEN GAP 5 (evidence-class enum) and 6 (provenance-kind) close. **Its uncertainty states DO survive persistence** (§8 field `selection_state`), which is one of the few architectural strengths for future closure.

### Site 3 · Preservation-check + heartbeat recovery
**Loop participation:** VALIDATION → REJECT edge is fully wired. But produces no information written back into investigation-conclusion-store — HIDDEN GAP 2 again. Its reject decisions influence nothing beyond the immediate revert.

### Site 4 · Four behaviour-changing memory systems
- **ConversationHead**: cumulative WITHIN conversation loop, not connected to investigation loop.
- **file-memory**: cumulative for tag→file lookup, not for problem-shape retrieval.
- **paraphrase**: cumulative for classifier fallback, not for investigation.
- **heartbeat records**: cumulative for agent-recovery, not for capability formation.

**None of the four currently support cumulative INVESTIGATION formation.** All four support only their own local loops. This is HIDDEN GAP 8 restated: cross-loop bridges absent.

### Site 5 · frame-scope + negation-polarity + Capability A + ConversationHead
**Loop participation:** contextual inference at conversation boundaries. Feeds composer, not investigation hypothesis. Would need a bridge from ConversationHead into ACTION 11 hypothesis to participate in the investigation loop — currently absent (edge C→D missing the CONTEXT source).

---

## 8 · EXTERNAL LLM BOUNDARY (per founder §9)

- **NEX1 RUNTIME**: verified zero-LLM (Task #255). All runtime decisions are deterministic.
- **NEX1 AUTHORING ENVIRONMENT**: Claude authors code under Fix arc discipline. Vocabulary, policies, rules are authored not learned. **This is where Claude "reasoning" enters — but it enters at authoring time, not runtime.**
- **EXTERNAL LLM**: not required for runtime execution of any current capability.
- **TEST HARNESS**: exists for Fix verifier probes; these are build-time not runtime.

> **Could the proposed closed loop execute entirely inside NEX1 runtime without Claude making the decision?**
> **Answer: YES for the runtime path IF Hidden Gaps 1-8 are closed AND Hidden Gap 9 is resolved by founder policy amendment.** NO if Hidden Gap 9 remains as Q8 policy V1 currently locks it.

---

## 9 · CUMULATIVE LEARNING TEST (per founder §10)

> "NEX1 solved problem B differently because it remembered verified experience from problem A."

Data lineage:

```
PROBLEM A                    → EXPERIENCE (raw)              [REAL — EXECUTED]
EXPERIENCE                   → INVESTIGATION                 [REAL — EXECUTED]
INVESTIGATION                → HYPOTHESIS                    [REAL — EXECUTED]
HYPOTHESIS                   → CHANGE                        [REAL — narrow pattern family]
CHANGE                       → VERIFICATION                  [REAL — EXECUTED]
VERIFICATION                 → MEMORY A                      [STORED — but with schema gap]
MEMORY A                     → RETRIEVAL (given problem B)   [NOT IMPLEMENTED]
PROBLEM B                    → APPLICATION OF MEMORY A       [NOT IMPLEMENTED]
APPLICATION                  → VERIFICATION                  [would be REAL if reached]
VERIFICATION                 → OUTCOME B                     [would be REAL if reached]
```

**Can current architecture produce this lineage?**

**NO.** The chain breaks at MEMORY A → RETRIEVAL. And even if bridged with a shallow retriever over the current schema, the retrieval could not use "verified experience" because the store doesn't record what got verified.

**Verdict on the cumulative learning test: `NO` (with current schema) · `PARTIAL` (with Hidden Gaps 1-3 closed) · `YES` (with all 9 gaps closed).**

---

## 10 · MINIMUM TRUE LOOP (per founder §12)

The founder specified 12 conditions. Applying to current architecture:

| # | Requirement | Current state |
|---|---|---|
| 1 | Real observed problem | ✅ |
| 2 | Stored evidence | ✅ (write side; retrieval side blocked by schema) |
| 3 | Investigation | ✅ |
| 4 | Hypothesis | ✅ |
| 5 | Change | ✅ (narrow pattern family) |
| 6 | Verification | ✅ |
| 7 | Persistent experience | ⚠️ persistence exists; "experience" (problem+outcome) not fully captured |
| 8 | Retrieval of that experience | ❌ NOT IMPLEMENTED |
| 9 | New problem | ✅ (system can accept next problem) |
| 10 | Retrieval influencing new investigation | ❌ NOT IMPLEMENTED |
| 11 | New verification | ✅ (would execute if reached) |
| 12 | Outcome changing future behaviour | ❌ NOT IMPLEMENTED (learning ledger has no consumer) |

**8 of 12 conditions currently held. 4 conditions absent. Note: the 4 absent conditions include the three most load-bearing ones (8, 10, 12).**

---

## 11 · MINIMUM EXPERIMENT DESIGN (per founder §13 · do not run)

Extending the boundary report's Test A/B/C design with the corrections from this report:

- **Test A** — baseline (existing capability). Requires Hidden Gap 1 partly closed: store must capture problem representation.
- **Test B** — experience reuse. Requires Gaps 1 + 5 + 6 closed at minimum.
- **Test C** — adversarial near-miss. Requires Gap 7 (retrieval-safety-gate) present AND Gap 3 (pattern class) to detect superficial similarity.

**Corrected proof standard (per founder §14):**

1. Original experience generated without manual injection into later case. `[requires Gap 1]`
2. Later case retrieved earlier experience automatically. `[requires Gap 1 + retriever]`
3. Retrieval influenced later investigation. `[requires Gap 5 + 6]`
4. System could reject inappropriate retrieved experience. `[requires Gap 7]`
5. Verification independently checked the resulting change. `[EXISTS]`
6. Outcome stored. `[requires Gap 2]`
7. Outcome changed future selection/retrieval behaviour. `[requires Gap 4 + 8]`
8. No external LLM required. `[EXISTS — Task #255]`

**All 8 conditions must hold. Currently ~2 are satisfiable.**

---

## 12 · FINAL ARCHITECTURE VERDICT

**`CLOSED_LOOP_ARCHITECTURE_NOT_CONFIRMED`.**

### A. Existing green nodes
1. Observation (bounded)
2. Evidence write-side
3. Investigation ACTION 1-15 chain
4. Hypothesis generation (deterministic)
5. Change generation (narrow pattern family)
6. Verification (vitest + preservation-check)
7. Q8 uncertainty gate (6-state honest refusal)
8. ConversationHead memory (behaviour-changing, but for conversation only)
9. Zero-LLM runtime (Task #255)

### B. Three proposed missing edges (from prior report)
- α · PERSIST → RETRIEVE
- β · RETRIEVE → APPLY
- γ · APPLY → REVERIFY → NEW EXPERIENCE

### C. Hidden gaps discovered by this investigation
- **Hidden Gap 1** — Problem representation not persisted (schema gap in Fix 17 writer)
- **Hidden Gap 2** — Change/outcome not persisted alongside investigation (cross-store bridge absent)
- **Hidden Gap 3** — Pattern class not stored (no bug-family field)
- **Hidden Gap 4** — Confidence-update mechanism does not exist (learning ledger has no consumer + Q8 forbids confidence-as-selection)
- **Hidden Gap 5** — Q8 evidence-class enum does not include retrieved-prior
- **Hidden Gap 6** — No provenance-kind on candidates (candidate_source field missing across types)
- **Hidden Gap 7** — Adversarial rejection mechanism does not exist (no retrieval-safety-gate)
- **Hidden Gap 8** — Cross-store unified query missing (29 disjoint stores)
- **Hidden Gap 9** — Doctrinal boundary: `SELECTED ≠ EXECUTED` — Q8 policy V1 explicitly forbids autonomous SELECTED-to-EXECUTED transition. **Requires founder policy amendment, not a code change.**

### D. External LLM / human dependencies
- Runtime: none.
- Authoring: Claude writes the capability files under Philip's Fix-arc scope.
- Founder policy authority: required for Hidden Gap 9 resolution.

### E. Smallest genuinely closed sub-loop that exists today
**Operational loop (heartbeat + recovery)**. Zero intelligence sites. Fully closed within its narrow scope. Not helpful for capability formation.

**Coding-pipeline micro-loop for `replace_return_literal`**: J.2 classifier → Fix 23b tracer → operator → EXECUTE → preservation-check → auto-revert-or-accept. Fully closed for one iteration. Not cumulative across problems.

### F. What Fix 24 would actually need to build

**Not the ~500 LOC of the prior estimate.** More realistically (rough evidence-based ranges):

1. **Fix 17 schema extension** — add problem_statement, intent_shape, pattern_class, applied_change, runtime_outcome fields. ~50-100 LOC schema + writer changes.
2. **Investigation-outcome bridge** — coding pipeline emits outcome records that join to investigation-conclusion records. ~100-150 LOC.
3. **Shape-hash retriever** — over the extended store, with pattern-class filter. ~150-200 LOC.
4. **Prior-evidence hypothesis injector** — into ACTION 11 with provenance-kind. ~100-150 LOC.
5. **Q8 evidence-class extension + policy amendment** — new `RETRIEVED_PRIOR_SUCCESS` / `RETRIEVED_PRIOR_FAILURE` classes + policy rules. ~80-120 LOC + founder policy V2.
6. **Retrieval-safety-gate (adversarial)** — similarity confidence scorer + gating layer. ~150-200 LOC.
7. **Outcome-informed retrieval weight** — reads outcome history to weight retrieval confidence. ~100-150 LOC + Q8 policy V2 must permit reading confidence.
8. **Cross-store unified query layer OR schema-level identity unification** — depends on approach. ~200-400 LOC for the query layer; larger for identity unification.
9. **Hidden Gap 9 policy decision** — 0 LOC, but a distinct founder decision item.

**Realistic total: ~1000-1500 LOC across ~7-9 modules + at least one founder-approved policy amendment.**

### G. What Fix 24 would NOT need to build (existing reusable machinery)
- ACTION 1-15 pipeline (reusable as-is)
- Fix 23b data-flow tracer (reusable)
- Fix 23c preservation-check (reusable)
- Vitest EXECUTE stage (reusable)
- ConversationHead persistence pattern (reusable pattern, not the storage itself)
- Provenance chain hash discipline (reusable pattern)
- JSONL append-only discipline (reusable pattern)
- Q8 6-state honest-refusal vocabulary (reusable as-is)
- File-memory tag lookup (reusable as an example architecture)

### H. What this investigation proves

- **PROVEN**: the prior boundary report's ~500 LOC / three-gap sufficiency estimate is FALSIFIED by the actual Fix 17 store schema.
- **PROVEN**: nine architectural gaps stand between current state and evidenced cumulative-formation autonomy for one bounded pattern family.
- **PROVEN**: none of the nine gaps require external LLM at runtime.
- **PROVEN**: Hidden Gap 9 is a policy-level obstacle that no amount of code can resolve without founder decision.
- **SUPPORTED**: the base intelligence-like computation sites (Fix 23b tracer, Q8 selector, preservation-check, ConversationHead, contextual inference) are real. But their loop-participation is currently limited to their own local pipelines.
- **POSSIBLE**: bounded autonomous formation for one pattern family, if all nine gaps close. The scope is bounded and named. It is not an open research question.
- **NOT PROVEN**: that any form of general intelligence, general AGI, self-awareness, learning-as-humans-learn, or consciousness exists or would exist after closure. The word "intelligence" is used ONLY in the operational sense of "intelligence-like computation" per the arrow-trace report §1.

---

## 13 · HONEST ANSWER TO THE FOUNDER'S CENTRAL QUESTION

> If we connect the three known gaps, will NEX1 actually be capable of learning from one verified experience and using that experience to change behaviour on a later problem — or are we still missing something?

**Answer: Still missing something. Specifically, six more architectural pieces AND one founder-policy decision.**

The three-gap closure would produce a system that *looks* like it retrieves prior conclusions but *cannot* meaningfully act on them, because:
- The store lacks problem-side data to retrieve on
- The Q8 pipeline lacks classes to differentiate retrieved from fresh evidence
- No safety-gate exists to reject bad retrievals
- No outcome-update mechanism exists to make retrieval quality adaptive
- The cross-store bridge to see coding outcomes from within investigation retrieval doesn't exist
- The Q8 policy explicitly forbids SELECTED-to-EXECUTED autonomous transition

**In short:** the prior report identified the *entry-and-exit doors* of the loop correctly but missed six load-bearing walls INSIDE the loop that also need to exist.

**Correction to prior estimate:** the boundary between "disciplined engineering" and "bounded autonomous formation" is not one Fix arc away. It is at minimum TWO Fix arcs plus a founder policy amendment — probably ~1000-1500 LOC of new code, ~50-100 LOC of schema changes in existing writers, and one policy decision (Q8 V2 permitting some form of retrieved-evidence weighting or SELECTED-to-EXECUTED authority).

**Bounded ≠ trivial.** Even that bounded closure is genuinely tractable engineering. But the prior report's confidence about ~500 LOC was materially wrong. This report retracts that estimate.

---

## 14 · WHAT SHOULD HAPPEN NEXT

Not implementation. Not further archaeology. A specific founder decision item:

**Founder Decision Item · Q8 Policy V2 Scope**

Determine which of the following the founder authorises for a putative Fix 24 (autonomous formation closure for one bounded pattern family):

1. Extend `InvestigationConclusionEntry` schema with problem-side fields — REQUIRES founder approval given Fix 17 was authorised at a specific scope (α REPORTING + γ-2 PERSISTENCE).
2. Extend Q8 evidence-class enum with `RETRIEVED_PRIOR_SUCCESS/FAILURE` classes — REQUIRES Q8 policy V2.
3. Permit confidence-informed selection weight (currently forbidden by V1 Decision 4) — REQUIRES Q8 policy V2.
4. Permit SELECTED-to-EXECUTED autonomous transition under retrieval-safety-gate protection — REQUIRES founder decision on the load-bearing doctrinal boundary.
5. Authorize cross-store unified query layer — REQUIRES architectural approval.

**None of these are code decisions. All are policy decisions. Only after founder answers can Fix 24 be sensibly scoped.**

---

## 15 · CLOSING NOTE

The founder's instruction was: *"Do not give the answer you expect. Find the answer in the code."*

I expected to confirm the prior ~500 LOC estimate. The code disagrees. The Fix 17 store schema is the load-bearing piece of evidence — it captures Q8 selection but not the problem being solved. Retrieval-by-similarity against that schema is architecturally impossible. Six additional hidden gaps + one policy question follow from that single observation.

This is the correct outcome for a falsification-first investigation. The prior report was optimistic. This report retracts and corrects.

**Zero code changes. This report is the only artifact produced. The archaeology arc's honest conclusion, six reports in:**

> **NEX1 contains most of the machinery for bounded cumulative formation but not enough — and the missing pieces are specifically identifiable, requiring one founder policy decision and ~7-9 authored modules. Whether to close the loop is now a well-scoped, evidence-backed engineering decision, not a research question.**
