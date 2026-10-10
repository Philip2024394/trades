# NEX1 · Native Intelligence · Arrow-Trace + Mechanism-Family Analysis

**Date:** 2026-09-18
**Investigator:** master_ai_engineer (Claude Opus 4.7)
**Mode:** READ-ONLY analysis
**Third in the archaeology series.** Companion reports (same day):
- `nex-agent-deep-forensic-investigation-2026-09-18.md` — the population, heartbeat, network
- `nex-native-intelligence-archaeology-2026-09-18.md` — the formation mechanism (Fix arc F3)
- **This report** — where inside the system does intelligence-like computation actually arise?

The founder's sharper question: an evidence pipeline is not automatically intelligence. Follow real information through the system and label each arrow: *what changed*, *who contributed what*, and *where does information cross the line into intelligence-like computation*.

---

## 1 · WHAT COUNTS AS "INTELLIGENCE-LIKE COMPUTATION"

Four evidence-checkable signatures. A step qualifies if AT LEAST ONE is true:

- **INFO-A · NEW REPRESENTATION** — the step produces a representation that could not be derived from the raw input alone (parsing produces structure not present in the string).
- **INFO-B · COMBINATIONAL CONCLUSION** — the step combines two or more prior signals into a conclusion neither contains individually (evidence + comparator produces ranking; head + intent produces contextual response).
- **INFO-C · CORRECTED RESULT** — a subsequent validation changes the output (preservation-check auto-revert; ranker demotes a candidate with blocking evidence).
- **INFO-D · MEMORY-INDUCED BEHAVIOUR-CHANGE** — retained state alters a subsequent decision (ConversationHead's prior bindings influence next-turn composition).

Steps that do NONE of these are **plumbing** (protocol wrapping, packet re-shaping, side-effect execution). Plumbing is necessary. It is not intelligence.

---

## 2 · TRACE 1 · A REAL CODING INVESTIGATION (Fix 23b pricing.ts arc)

Recorded in memory as `RUNTIME_VERIFIED 2026-09-17` (Task 2 variant). I follow the exact flow.

**Input:** user prose *"make pricing.ts return 42 instead of 41 on line 19"*

| # | Arrow | Actor | What entered | What was added | Signature | Comment |
|---|---|---|---|---|---|---|
| 1 | raw text → Capability A classifier | Capability A (vocab v5) | 12-word string | `IntentEnvelope { intent_slug: "modify_literal", confidence, domain_tokens: ["pricing.ts","return","42","41"] }` | **INFO-A** (structure from string) | Vocabulary lookup + fuzzy match. Structure emerges but from authored vocab, not learning. |
| 2 | envelope → safety boundary | capability-safety-boundary | envelope + repo context | `safety_verdict: PASS` | **plumbing** (rule application, no new info) | Deterministic rule gate. Necessary but non-informative. |
| 3 | safety=PASS → authorization | authorization gate | envelope | (waits for founder confirm) | **plumbing** | No transformation; waiting. |
| 4 | authorized → ACTION 1 CLASSIFY | native-investigation-mode | envelope | investigation_packet initialised | **plumbing** (container change) | Same info, different type. |
| 5 | packet → ACTION 2 file-memory tag lookup | capability-m-file-memory | packet + intent | `file_candidates: ["src/lib/.../pricing.ts"]` | **INFO-D** (retrieval changes downstream) | Prior file-memory tag associations retrieved. Behaviour-changing memory. |
| 6 | packet → ACTION 3 observer walk | (walk fn) | packet with candidates | `file_tree + read snippets` | **INFO-A** (raw filesystem → typed record) | Extraction. |
| 7 | packet → ACTION 6 source inspection | capability-source-inspection | packet + content | `structural_facts: { functions, returns, imports, variable_declarations }` | **INFO-A** (AST-lite from text) | Parser produces structure not in raw source string. |
| 8 | intent + structure → J.2 pattern classifier | capability-j2-cause-analysis | intent + structure | `matched_pattern: "local-from-imported-call"` + proposal shape | **INFO-B** (pattern from intent-shape combination) | Pattern inference over the intent-and-structure joint space. |
| 9 | proposal + source → **DATA-FLOW TRACER** | capability-data-flow-tracer (Fix 23b) | proposal + AST | `target_line: 19` + literal candidates that would produce expected value | **INFO-A + INFO-B** — **strongest reasoning step in the trace** | Symbolic backward evaluation of arithmetic. Genuine semantic reasoning: given `f(x) = expected`, find literals L such that substituting L yields expected. |
| 10 | target_line → CHANGE stage | replace_return_literal operator | proposal + line | file mutated on disk | **plumbing** (execution) | Deterministic side effect. |
| 11 | modified source → EXECUTE | vitest runner | modified file | `exit_code` | **INFO-A** (truth from external system) | Runtime verification, external reality. |
| 12 | before/after + sibling tests → **PRESERVATION CHECK** (Fix 23c) | preservation-checker | source_before/after + test outcomes | if regression: `writeFileSync(source_before)` → byte-identical revert | **INFO-C** (validation reverses the write) | Corrective feedback loop. Verified reversal on Task 1 (pricing.ts) where preservation broke. |
| 13 | exit_code + preservation → VERIFY | verify stage | signals | `verdict` | **INFO-B** (synthesis of two signals) | Combines external-reality signal with internal-invariant signal. |
| 14 | verdict + trace → ConversationHead update | capability-conversation-context | verdict + turn | `head.mutations[]` appended; snapshot persisted | **INFO-D** (memory) | Behaviour-changing memory write. |
| 15 | next turn "did it work?" | chat-turn dispatcher | user question + head | retrieved mutation record → response | **INFO-D** (memory reuse) | Prior state answers current question. |

### 2.1 · Where intelligence actually arose in Trace 1

| Signature | Steps | Verdict |
|---|---|---|
| **INFO-A (new representation)** | 1, 6, 7, 9, 11 | Multiple. Peaks at step 9 (data-flow tracer). |
| **INFO-B (combinational conclusion)** | 8, 9, 13 | Genuine reasoning at 8 and 9. Step 13 is thin (two-way AND). |
| **INFO-C (corrected result)** | 12 | Single strongest correction site. Auto-revert has real teeth. |
| **INFO-D (memory-induced change)** | 5, 14→15 | The retrieval side is behaviour-changing. |

**Strongest intelligence-like step: 9 (data-flow tracer).** It receives an AST + a goal + arg values and produces a target-line that no upstream step contained. It does symbolic evaluation. It is the single closest thing in NEX1 to what a human would call "figuring it out."

**Second strongest: 12 (preservation check).** Because it *reverses* a decision based on external evidence. Feedback loops that alter output are rarer than steps that add information.

**Plumbing: 2, 3, 4, 10.** Necessary but they add nothing informational.

---

## 3 · TRACE 2 · A MULTI-TURN CONVERSATION WITH REFERENCE RESOLUTION

Real scenario recorded in Batch 1 Final Closure memory.

**Turn 1:** *"help me choose oak stairs"*
**Turn 2:** *"actually make them walnut instead"*

| # | Arrow | Actor | Entered | Added | Signature |
|---|---|---|---|---|---|
| 1 | T1 raw → classifier | Capability A | string | intent=materials_query | INFO-A |
| 2 | T1 intent → composer | capability-response-composer | intent | answer | plumbing |
| 3 | T1 result → ConversationHead | capability-conversation-context | turn record | `head.topic = "materials/oak/staircase"`, `head.entities = ["oak","stairs"]` | INFO-D |
| 4 | T2 raw → classifier | Capability A | string | intent=modification | INFO-A |
| 5 | T2 raw → **negation-polarity** | nex/brain/negation-polarity | string | `polarity: CONTRASTIVE`, `contrastive_target: "walnut"` | INFO-A (structure) |
| 6 | T2 raw + head → **frame-scope-intelligence** | nex/brain/frame-scope-intelligence | msg + head | `transition: MODIFICATION` (NOT `TOPIC_SHIFT`, NOT `NEW_REQUEST`) | **INFO-B** — combines message text with prior head to decide if context resets |
| 7 | T2 intent + transition → composer | response composer | signals + head | walnut answer that references the SAME staircase context | **INFO-B** (composition of prior context and new modifier) |
| 8 | T2 result → head update | conversation-context | mutation | `head.topic → "materials/walnut/staircase"`, `head.modifications: [{from: "oak", to: "walnut"}]` | INFO-D |

### 3.1 · Where intelligence actually arose in Trace 2

- **Step 5 (negation-polarity)** distinguishes `not X` (sentential negation) from `X instead` (contrastive substitution) — this IS a structural inference, but implemented via authored regexes / vocabulary. INFO-A, moderate strength.
- **Step 6 (frame-scope) is the pivot.** It receives the message + the head and outputs `MODIFICATION` vs `TOPIC_SHIFT`. That decision is what prevents the composer from resetting context. Without this step, the response degrades to *"what stairs?"* (no context). With it, the response continues the conversation.

**Note on strength:** frame-scope-intelligence is authored-vocabulary heavy (verified in §sample read: `TOPIC_SHIFT_MARKERS = new Set(["actually","instead","forget","nevermind",...])`). So step 6 is INFO-B in shape, but INFO-A in mechanism (rule lookup with session-state check). This is a genuinely useful inference, but the "learning" is human-authored vocab, not runtime-learned.

- **Step 3 + 8 (ConversationHead)** is behaviour-changing memory (INFO-D). Together with step 6, this is where turn-to-turn intelligence lives.

**Strongest intelligence-like step: 6 (frame-scope) + 3/8 (memory) in tandem.** Neither alone is enough. The intelligence emerges from the *combination* of contextual classification and behaviour-changing memory.

---

## 4 · TRACE 3 · CANDIDATE SELECTION UNDER HONEST UNCERTAINTY (Q8)

Real scenario: Fix 16 verifier suite (24/24 cases, RUNTIME_VERIFIED 2026-09-17).

**Input:** 5 root-cause candidates, each with mixed evidence classes (SUPPORTING / CONTRADICTING / INSUFFICIENT / UNRESOLVED). Ranking already produced by Fix 15.

| # | Arrow | Actor | Entered | Added | Signature |
|---|---|---|---|---|---|
| 1 | evidence → per-candidate classify | capability-hypothesis-evidence-evaluator (ACTION 12) | candidate + evidence | evaluation class per candidate | INFO-A |
| 2 | evaluations → pairwise compare | capability-candidate-comparator (ACTION 13) | evaluations | pairwise deltas | INFO-B (deltas from comparisons) |
| 3 | comparisons → rank | capability-candidate-ranker (ACTION 14) | deltas + policy V1 | ranked list + rank_position + scope_state | INFO-B (ordering under policy) |
| 4 | ranking → **selector** | capability-candidate-selector (Fix 16) | ranking + evaluations | `selection_state ∈ {SELECTED, NO_SELECTION, TIE, INSUFFICIENT_EVIDENCE, UNRESOLVED, REQUIRE_MORE_INVESTIGATION}` | **INFO-B + META-COGNITIVE** |

### 4.1 · What makes step 4 special

Verified from `capability-candidate-selector.ts` (lines 17-25):
```
1. Fix 15 scope_state == UNRESOLVED_ORDER → REQUIRE_MORE_INVESTIGATION
2. rank-1 tied (bucket size > 1) → TIE
3. rank-1 overall_status == CONTRADICTED → NO_SELECTION (blocking)
4. rank-1 overall_status == INSUFFICIENT → INSUFFICIENT_EVIDENCE
5. rank-1 overall_status == UNRESOLVED → UNRESOLVED
6. rank-1 has ANY blocking counts → NO_SELECTION
7. rank-1 overall_status == SUPPORTED → SELECTED
8. otherwise → NO_SELECTION
```

**The selector's SELECTED outcome is one of six equally-legitimate outcomes.** Five of the six are refusals to commit. This is a system that explicitly represents "I do not have enough evidence to answer" as a first-class result rather than forcing a guess.

That IS a form of intelligence — specifically, **calibrated uncertainty preservation**. Most rule-based systems don't do this; they pick something and label it low-confidence. Here, the system refuses.

Where does this intelligence arise? Not in any single component. It arises in the **policy** authored by the founder (NEX1_Q8_SELECTION_POLICY V1, founder-approved 2026-09-17) as executed deterministically by the code. Neither the policy alone nor the code alone produces the calibrated behaviour — the combination does.

**This is a case of DESIGN-EMBEDDED intelligence.** Not learned, not emergent, but present because the policy author refused to reduce six outcomes to two.

---

## 5 · THE SEVEN MECHANISM FAMILIES · FULL ATTRIBUTE MATRIX

Applying the founder's 13 required attributes per family.

### 5.1 · CLASSIFIERS

| Attribute | Answer |
|---|---|
| Receives | raw signal (usually a string, sometimes a state record) |
| Transforms | pattern match against authored vocabulary + scoring |
| Outputs | enum + confidence + evidence tokens |
| Users | Capability A → chat + gateway + investigation entry + coding pipeline; conversational-function → dialogue-act family; negation-polarity → polarity + scope; frame-scope → transition; J.2 → operator pattern |
| Origin | brain classifiers 2026-08 → 2026-09-06 (nex-brain commit d06a9625); Capability A 2026-09-11→12 with vocab through v5.0.0-alpha.5 (2026-09-16) |
| Reused | YES — Capability A is the single most-reused module in the system (chat + gateway + investigation + coding all consume it) |
| Creates new information? | YES — typed representation from untyped input (INFO-A) |
| Changes future decisions? | YES — every downstream ACTION branches on classifier output |
| Learning? | NO — vocab is hand-authored version-bumps (v1 → v5) |
| Reasoning? | NO — pattern lookup, not inference |
| Verification? | NO — classifiers classify |
| Memory? | PARTIAL — paraphrase-JSONL fallback (C2) is a classifier-adjacent behaviour-changing store |
| Cross-cutting? | YES — every stack has an entry-classifier |

### 5.2 · EXTRACTORS

| Attribute | Answer |
|---|---|
| Receives | raw structured content (source code, prose, JSONL, filesystem) |
| Transforms | parse / decompose / extract features (AST walk, regex, tokenisation) |
| Outputs | typed structured records (structural_facts, entities, tokens, chains) |
| Users | source-inspection → observed-chains → chain-narrative + chain-relationship-detector; Knowledge Extractor → brain; specification-extractor → verification-case-generator |
| Origin | Knowledge Extractor 2026-08-06 (Phase 1); source-inspection 2026-09-16 (Fix 7); Fix 10 extended source-inspection with variable_declarations |
| Reused | YES — source-inspection is consumed by every subsequent ACTION in the investigation chain |
| Creates new information? | YES — structure not present in raw content (INFO-A) |
| Changes future decisions? | YES — reasoners branch on extracted features |
| Learning? | NO |
| Reasoning? | PARTIAL — some extractors (data-flow tracer) go beyond parsing into semantic evaluation |
| Verification? | NO |
| Memory? | PARTIAL — some extracted structure is persisted (file-memory tags) |
| Cross-cutting? | YES |

**Sub-note:** the data-flow tracer sits at the EXTRACTOR-REASONER boundary. It parses (extractor) then symbolically evaluates (reasoner). This is the strongest cross-family capability in the code-engine tree.

### 5.3 · REASONERS

| Attribute | Answer |
|---|---|
| Receives | extracted structured facts + prior state |
| Transforms | inference / composition / candidate generation / candidate selection |
| Outputs | hypotheses, candidates, rankings, selections |
| Users | investigation ACTIONs 11-15 (Fix 12 → Fix 16); data-flow tracer used by Fix 23b coding pipeline |
| Origin | 2026-09-16 → 09-17 concentrated burst; Fix 23b tracer 2026-09-17 |
| Reused | LIMITED — mostly investigation-only; tracer reused across coding tasks |
| Creates new information? | YES — this is the strongest new-info family (INFO-B) |
| Changes future decisions? | YES |
| Learning? | NO — no policy-update from outcomes; ranking + selection policies are hand-authored and frozen |
| Reasoning? | THIS IS THE REASONING (definitionally) |
| Verification? | PARTIAL — hypothesis-evidence-evaluator (ACTION 12) classifies evidence class; but validation-proper lives in the validator family |
| Memory? | WEAK — packet-local unless Fix 17 persists |
| Cross-cutting? | NO — investigation-only + one coding usage |

**Sub-note:** the Q8 selector is a reasoner with meta-cognitive character (§4). It represents "cannot commit" as a first-class outcome. This is the closest NEX1 gets to genuine epistemic humility.

### 5.4 · VALIDATORS / CHALLENGERS

| Attribute | Answer |
|---|---|
| Receives | claim + evidence |
| Transforms | apply evidence rules → verdict |
| Outputs | verdict + reason + evidence citation |
| Users | nex-evidence-validation validator (post-processing in nex1-orchestrator); nex2-review; nex3-arbitration; preservation-check (Fix 23c); adversarial property tests (14 in heartbeat suite) |
| Origin | Quality Checker 2026-08-06 (Phase 1); preservation-check 2026-09-17 (Fix 23c) |
| Reused | YES across investigation, coding, chat, heartbeat |
| Creates new information? | PARTIAL — verdict is new; underlying evidence isn't |
| Changes future decisions? | YES — most strongly at preservation-check (INFO-C · auto-revert) and heartbeat recovery (STALLED → RETRY) |
| Learning? | NO — rules hand-authored |
| Reasoning? | PARTIAL — meta-reasoning about claims |
| Verification? | THIS IS THE VERIFICATION (definitionally) |
| Memory? | PARTIAL — some verdicts persisted (envelope history, heartbeat records) |
| Cross-cutting? | YES |

**Sub-note:** preservation-check + heartbeat recovery are the two verified INFO-C sites in the entire system. That is a very small number of true correction points — but they matter disproportionately because they *reverse* prior decisions.

### 5.5 · OBSERVERS

| Attribute | Answer |
|---|---|
| Receives | registry / state / environment |
| Transforms | derive state from raw signals (dual-signal state machine) |
| Outputs | state record + reason (WORKING/ALIVE/WAITING/STALLED/DEGRADED/FAILED for heartbeat; PASS/FAIL for validators) |
| Users | heartbeat monitor → recovery.ts; capability-j runtime diagnosis → long-run recovery capabilities (j4, j42) |
| Origin | heartbeat 2026-08-08 (Phase 12.3) evolved to dual-signal 2026-09-13; capability-j 2026-09-11 |
| Reused | heartbeat state is read by recovery for every tick; capability-j is composed into long-run capabilities |
| Creates new information? | YES — state from raw signals |
| Changes future decisions? | YES — recovery uses state (INFO-C-adjacent) |
| Learning? | NO |
| Reasoning? | LIMITED — pure state derivation via named rules |
| Verification? | PARTIAL — observation is a form of verification of external reality |
| Memory? | YES — heartbeat records ARE the operational memory of the workforce |
| Cross-cutting? | PARTIAL — HQ substrate mostly |

### 5.6 · EXECUTORS

| Attribute | Answer |
|---|---|
| Receives | signed authorisation + typed inputs |
| Transforms | perform side effect (file mutation, code build, test run, WhatsApp send) |
| Outputs | side effect + evidence record |
| Users | WO-03/04/05/06/09 executors; coding operators (applyReplaceReturnLiteral · Fix 23a onward); vitest runners; safety-gated file writes |
| Origin | WO series 2026-09-13; coding operators Fix 23a 2026-09-17 |
| Reused | YES — the operator table is designed for reuse |
| Creates new information? | NO — they act, not know (except that runtime execution produces a truth signal, which IS INFO-A of external reality) |
| Changes future decisions? | YES — side effects change world state which is subsequently observed |
| Learning? | NO |
| Reasoning? | NO |
| Verification? | NO — they execute, they don't verify |
| Memory? | PARTIAL — side effects become future state |
| Cross-cutting? | YES |

### 5.7 · MEMORY

| Attribute | Answer |
|---|---|
| Receives | record to persist |
| Transforms | append-only JSONL / snapshot update |
| Outputs | persisted record + (sometimes) read handle |
| Users | ~15 modules write; ~4 read back (heartbeat/head/paraphrase/file-memory) |
| Origin | 2026-08-06 (Memory Guardian Phase 1); JSONL era 2026-09; Fix 17 investigation-conclusion-store 2026-09-17 |
| Reused | PARTIAL — 4 of 29 stores actually reused for behaviour-change |
| Creates new information? | NO |
| Changes future decisions? | PARTIAL — 4 of 29 stores (INFO-D) |
| Learning? | NOT_YET — Loops 6/7/8 NOT_IMPLEMENTED |
| Reasoning? | NO |
| Verification? | NO |
| Memory? | THIS IS THE MEMORY (definitionally) |
| Cross-cutting? | YES |

---

## 6 · CROSS-FAMILY SYNTHESIS — WHERE INTELLIGENCE ACTUALLY ARISES

Ranked by evidence strength.

### 6.1 · Genuine reasoning sites (rare)

- **Data-flow tracer (Fix 23b, in EXTRACTOR-REASONER boundary)** — symbolic backward evaluation with a safe evaluator. The single strongest instance of semantic reasoning in the code-engine tree. Verified in source: bounded arithmetic + Math builtins + conditional + cross-function same-file recursion; refuses cleanly on unsupported constructs.
- **Q8 selector (Fix 16, REASONER)** — meta-cognitive uncertainty preservation. Five of six outcomes are refusals to commit. Refusal-as-first-class is a form of intelligence not present in typical rule engines.
- **Root-cause hypothesis generator + evidence evaluator + candidate ranker + selector chain (ACTIONs 11-15)** — the full sequence composes into an ability none of them has alone: given raw source + a bug shape, produce a defensible ranked candidate list with honest uncertainty. This IS interactionally emergent reasoning at the pipeline level.

### 6.2 · Contextual inference sites (moderate)

- **Frame-scope-intelligence** — session-state-aware disambiguation of CONTINUATION vs MODIFICATION vs TOPIC_SHIFT vs NEW_REQUEST. Rule-heavy but session-aware, which is a genuine contextual inference.
- **Negation-polarity** — distinguishes AFFIRMATIVE / NEGATED / CONTRASTIVE / UNKNOWN and 9 scope classes. Rule-heavy but structurally rich.
- **Capability A intent classification** — chief entry point for many stacks. Vocabulary-heavy but structurally load-bearing.

### 6.3 · Feedback correction sites (very rare)

Only three verified sites where a validation reverses or modifies a prior output:

- **Preservation-check (Fix 23c)** — mutation that breaks sibling tests is reverted byte-identically.
- **Heartbeat recovery** — STALLED agent triggers RETRY_MISSION (mission retried with new id, same content, refreshed budget).
- **Paraphrase-fallback (C2 Phase 2/3)** — when the primary classifier misclassifies, paraphrase entries provide a corrected fallback path.

### 6.4 · Behaviour-changing memory sites (rare)

Four of 29 persistence stores actually change future runtime behaviour:

- **ConversationHead** — every chat turn reads the head; the head's mutations, bindings, and topic drive next-turn composition.
- **File-memory (capability-m)** — ACTION 2 tag lookup guides investigation to the right files without walking the entire tree.
- **Paraphrase JSONL** — classifier fallback source.
- **Heartbeat records** — recovery reads previous state to decide the next action.

### 6.5 · Plumbing (dominant volume)

Most of the ~44 code-engine capabilities + most of the ~100 brain modules perform information-transport: envelope wrapping, packet threading, side-effect execution, verifier-evidence recording. These are necessary for the intelligence sites to compose but do not themselves cross INFO-A/B/C/D thresholds.

---

## 7 · THE REFINED FORMULA

The founder's central question: **is there a formula underneath?**

There are now three formulas visible in evidence, at three scales:

### 7.1 · Micro-formula (per-step)
```
PACKET_IN → TYPED_FIELD_ADDED → PACKET_OUT
```
Universal across all 15 investigation ACTIONs. Applies to plumbing steps too. Not intelligence per se — just the shape.

### 7.2 · Formation-formula (how each capability was authored)
```
FAILING_PROBE → PRE-BUILD_AUDIT → BUILD → WIRE → VERIFIER → REGRESSION → PERSIST_EVIDENCE
```
Executed ~30 times over ~5 wall-clock days. This is the *authoring* formula, not a *runtime intelligence* formula.

### 7.3 · Intelligence-formula (where INFO-A/B/C/D thresholds are crossed)

Only under specific conditions does a step cross into intelligence-like computation. The evidence pattern is:

```
EXTRACTION (structural information from raw)
  +
COMBINATION (multiple signals synthesised)
  +
POLICY_WITH_UNCERTAINTY_OUTCOMES (refusal-as-first-class)
  +
FEEDBACK_REVERSAL (validation changes prior output)
  +
BEHAVIOUR-CHANGING_MEMORY (retained state alters future step)
```

**A step is "intelligence-like" if it does at least one of the five, and pipelines are intelligence-like in aggregate when they compose multiple of the five.**

The Fix 23b tracer + Fix 23c preservation-check + Fix 16 selector + ConversationHead + heartbeat recovery are the five load-bearing intelligence sites in NEX1 today. Everything else composes around them.

### 7.4 · What is NOT in the formula

Notably absent from the intelligence-formula:
- **Learning** — no runtime capability updates its own rules from outcomes. Vocabulary grows by version-bump, not by feedback.
- **Autonomous re-planning** — the pipeline is fixed; no capability rewrites the ACTION sequence based on results.
- **Cross-stack composition** — the five intelligence sites live in different stacks (coding, conversation, investigation, operational, memory); no meta-capability yet composes them for a shared goal.

These absences ARE where the next intelligence work should go if the founder wants NEX to become more capable without adding more capabilities.

---

## 8 · WHERE THIS PLACES NEX1 HONESTLY

Under the operational definition (§1), NEX1 currently demonstrates:

- **Interpretation** — YES (Capability A + brain classifiers, vocab-based)
- **Inference** — PARTIAL (data-flow tracer strongest; frame-scope moderate; most others are rule lookup)
- **Relationship discovery** — YES (chain-relationship-detector + composer)
- **Adaptive selection** — YES (Q8 selector, but adaptation is via authored policy not learning)
- **Verification** — YES (preservation-check, adversarial property tests, evidence-validation)
- **Generalisation** — LIMITED (Fix 23b tracer generalises across arithmetic shapes; most capabilities are shape-specific)
- **Correction** — YES (three verified feedback sites)
- **Reusable reasoning** — PARTIAL (data-flow tracer reusable across tasks; Q8 reusable across investigation types; most reasoning is packet-scoped)

**Not intelligence-like today:**
- Learning-from-outcome
- Autonomous plan revision
- Cross-stack meta-reasoning

**Genuinely intelligence-like today:**
- Semantic backward evaluation (Fix 23b)
- Meta-cognitive uncertainty preservation (Q8)
- Feedback-driven correction (Fix 23c preservation + heartbeat recovery)
- Memory-driven multi-turn coherence (ConversationHead)
- Distributional context inference (frame-scope + negation-polarity)

**These five capabilities are what actually make NEX1 more than a pipeline.** They are not concentrated in any single agent or module. They are distributed across the code-engine tree, the brain modules, and the operational-substrate — but they DO compose visibly when a real task is followed arrow-by-arrow.

---

## 9 · ANSWERS TO THE 13 ATTRIBUTE QUESTIONS AT SYSTEM SCALE

Applied across the whole system, not per family:

1. **Overall system creates new information?** Yes — primarily at extractors (structure from raw) and reasoners (hypotheses from evidence).
2. **Overall system changes future decisions?** Yes — but only at the four behaviour-changing memory stores and the three feedback-correction sites.
3. **Overall system participates in learning?** No, not at runtime. Learning-analogue is human-in-the-loop authoring under the Fix arc.
4. **Overall system participates in reasoning?** Yes, strongest at Fix 23b tracer and the ACTION 11-15 chain.
5. **Overall system participates in verification?** Yes, extensively — but verification is mostly at build time (verifier probes with case numbers), not at runtime.
6. **Overall system participates in memory?** Yes — but 22 of 29 stores are passive (evidence artefacts, not behaviour-changing).
7. **Is any single mechanism present across unrelated capabilities?** Yes: (a) the packet-shape · (b) Capability A classifier as entry point · (c) provenance_chain_hash on records · (d) the Fix-arc authoring discipline.
8. **Does the system have first-class refusal / uncertainty?** Yes — Q8 selector with 5 non-commit outcomes; ambiguous polarity marked UNKNOWN; heartbeat's WAITING state explicitly not-a-defect.
9. **Does the system self-modify at runtime?** No — no policy-update, no vocab-learn, no ACTION-rewire, no capability-generation.
10. **Does the system compose capabilities that alone would not solve the task?** Yes — the ACTION 1-15 chain is the strongest example.
11. **Is the composition emergent?** At component level, no (authored). At pipeline level, yes (composition produces capability not in any single ACTION).
12. **Is there a common protocol between capabilities?** Yes — envelopes/packets + evidence_ids[] + provenance_chain_hash. This is the shared internal language.
13. **Is the intelligence localised or distributed?** Distributed, but concentrated at five load-bearing sites (§8).

---

## 10 · WHAT WE ACTUALLY FOUND

The founder's sharper question deserved a sharper answer. Here it is:

**NEX1's intelligence does not live in the 40+ agents. It does not live in the code-engine capability tree. It does not live in the persistence layer. It lives in five specific composition sites, distributed across those three subsystems, that cross the INFO-A/B/C/D thresholds. The rest is plumbing that carries information between those sites.**

Named concretely:

1. **`capability-data-flow-tracer.ts` (Fix 23b)** — symbolic reasoning
2. **`capability-candidate-selector.ts` (Fix 16 · Q8)** — meta-cognitive uncertainty
3. **`preservationCheck` in Fix 23c + heartbeat recovery** — feedback-driven correction
4. **ConversationHead + file-memory + paraphrase + heartbeat records** — behaviour-changing memory (4 of 29 stores)
5. **frame-scope-intelligence + negation-polarity + Capability A composed with head state** — contextual inference at conversation boundaries

Everything else is plumbing: necessary, well-built, uniform in shape, but not itself intelligent under the operational definition.

**If you removed the five sites, the pipeline would still run — but it would answer the wrong question at every step. That is the operational meaning of "where intelligence arises."**

**If you added learning-from-outcome to any of the five sites, NEX1 would become qualitatively more capable without adding a single new capability file.** Loop 6 (Fix 17 conclusion-store → future investigation), Loop 7 (learning ledger → classifier vocab evolution), Loop 8 (test failure → autonomous Fix-arc trigger) are the three concrete places where non-authored intelligence would first appear. None of them are wired today.

---

## 11 · HONEST LIMITS

- ~100 `nex/brain/*.ts` files remain mostly unaudited. Any of them could contain additional intelligence-crossing sites and change the count.
- Runtime traffic in production has not been observed for this report; the trace analysis is based on source + test evidence + prior runtime-verification records.
- The DNA table's family boundaries are pragmatic, not mathematical. A different taxonomy would produce a different count of families. The claim that survives any taxonomy is: *most volume is plumbing, most intelligence-crossings are rare and localised.*
- Cross-stack composition (5 stacks × 5 sites) was not exhaustively traced. There may be additional emergent sites where two stacks interact.

Zero code changes. This report is the only artifact.
