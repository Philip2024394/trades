# NEX1 · Native Intelligence · Technical Invention & Provenance Record

**Canonical historical & technical provenance for the NEX1 native-intelligence system.**

- **Record created:** 2026-09-18
- **Record purpose:** permanent, version-controlled evidence of the technical history of NEX1 as it existed in this repository at the time of creation. It distinguishes founder-authored concepts from implemented architecture, runtime-verified behaviour, test evidence, experimental hypotheses, and future unproven claims.
- **Legal status:** this document is a technical & evidentiary record. **It is not, and does not substitute for, legal IP protection.** Patent, copyright, trade-secret, and other IP rights depend on jurisdiction, disclosure timing, and specific procedures; obtain qualified legal counsel before relying on this record for any legal purpose.

---

## 1 · Author / Origin (from repository evidence only)

| Field | Value | Evidence source |
|---|---|---|
| Concept originator / founder | **Philip O'Farrell** (Git author: `Philip2024394 <Philip2024394@users.noreply.github.com>`) | `git log` shows all committed NEX1 work authored by `Philip2024394`; `CLAUDE.md` in the repo root is written in the founder's voice; every relevant source file carries a `Founder-authorised YYYY-MM-DD` marker in its header |
| Repository | `C:/Users/Victus/trades` · single-primary-author git history · remote UNKNOWN in this record | `git log --format="%an <%ae>"` shows a single author on every inspected NEX1 commit |
| Assistant used to implement under founder direction | Claude Code (Anthropic CLI), operating under the constitutional constraint that **it never authors NEX1's runtime intelligence itself** and that every module is deterministic + zero-LLM at runtime | `CLAUDE.md` § "NEX Native Intelligence" + explicit `founder-authorised` comment markers |
| Attribution rule | Concepts and authorisations are attributed to the founder. Implementation was carried out under founder direction. **This record does not attribute invention of NEX1 to Claude, an LLM, or any AI assistant.** | Explicit constitutional statement (this document) |

---

## 2 · Core Invention · what NEX1 is

NEX1 is a **native, zero-LLM-at-runtime cognitive architecture** for coding-focused intelligence in a single codebase. Its core structural claims (all implemented on disk as of record creation; see § 5 for evidence per claim):

1. **Specialist micro-brains** — a shared brain shape (`MicroBrain<Observation, Prediction>`) with an `observe → predict → learn` lifecycle. Each instance owns its own JSONL database, its own deterministic rulebook, and its own domain. Implemented in `src/lib/nex-agent/code-engine/capability-micro-brain.ts`. Three concrete instances shipped in `capability-micro-brains-instances.ts`: `mb_test_shape`, `mb_identifier_hint`, `mb_fix_confidence`.

2. **Cortex aggregation** — a router that broadcasts one observation to N brains, collects predictions, computes deterministic consensus (`UNANIMOUS_SAME_PREDICTION | MAJORITY_AGREES | DISAGREEMENT_PRESERVED | SINGLE_RESPONDER | NO_RESPONSE`) and emits an INFERRED aggregate that never enters R-4 SUPPORTING count. Implemented in `capability-cortex-router.ts`.

3. **Deterministic rulebooks** — every cognitive-signal module carries its own executable rulebook (rule tables, weight tables, threshold constants). No probabilistic model, no learned weights, no external service. Load-bearing modules: `capability-fear.ts` (PROTECTED_FILES / PROTECTED_DIRECTORIES), `capability-concern.ts` (WEIGHTS + THRESHOLDS), `capability-afraid.ts` (WEIGHTS + THRESHOLDS), `capability-prior-evidence-comparator.ts` (signature comparator), `capability-specification-extractor.ts` (P1–P9 pattern set).

4. **Bounded capabilities** — every module refuses honestly when outside its scope. Refusal codes are deterministic and machine-readable (`refused_no_verb_recognised`, `refused_unknown_test_shape`, `refused_low_confidence`, `refused_test_may_be_wrong`, `refused_protected_target`, etc.). No module fabricates output when uncertain.

5. **Runtime connections** — a central agent registry (`capability-agent-registry.ts`) grants every agent a canonical id, an append-only JSONL database at `data/nex1-agent-registry/agent-dbs/{id}.jsonl`, a heartbeat file at `data/nex1-agent-registry/heartbeats/{id}.json`, and a catalog entry at `data/nex1-agent-registry/agents.json`. 23 agents are registered as of record creation.

6. **Verification** — mutations run through Fix 23c preservation-check with byte-identity auto-revert; the coding loop emits per-stage verdicts (Fix 32) and refuses when the operator library cannot classify the shape.

7. **Learning / generalisation architecture (partial)** — Fix 17 writes investigation conclusions; Fix 26 reads them; Fix 30 aggregates prior context; Fix 30B compares prior vs current to classify structural RELATIONSHIP; Fix 30B has been runtime-verified to change downstream decisions under specific relationship classes. **Broader generalisation (transfer from one class of problem to a genuinely different class) is not yet experimentally verified — see § 4.**

Constitutional invariants preserved end-to-end: **REMEMBER ≠ UNDERSTAND ≠ PROVE ≠ SELECT ≠ MODIFY ≠ EXECUTE ≠ VERIFIED ≠ AUTHORIZED**.

---

## 3 · Current Runtime Proof (verified during this session)

### 3.1 · Latest experiment · smaller brains + cortex + coding path + zero LLM

Recorded in `data/nex1-agent-registry-probe/connection-and-coding-probe-receipt.json`:

- **Two of three shipped specialist brains produced non-null predictions on the runtime turn.** `mb_test_shape` predicted `"bare_call"` (confidence 0.9) for the assertion `expect(emotionCheck()).toBe(42)`. `mb_fix_confidence` predicted `"HIGH"` for the same turn's fix context.
- **Cortex router aggregated their outputs**, emitting `consensus=SINGLE_RESPONDER` for each broadcast (only one brain in the roster responds to each observation domain — this is a correct behaviour of the router, not a defect).
- **The aggregated intelligence entered the coding path** — micro-brain heartbeats fired inside Fix 25's `bridge.ok` branch before the promotion decision.
- **The coding task passed verification.** Fresh fixture `src/lib/nex1-coding-probe/emotion-check.ts` was mutated from `return 7;` to `return 42;`; Turn-2 state = `verified`.
- **Execution used zero LLM.** Every response carried `zero_llm: true`; grep of every new source file against `openai|anthropic|claude|gemini|groq|ollama` returned nothing.
- **2,135 / 2,135 vitest cases passed** in `npx vitest run src/lib/nex-agent/code-engine/`.
- **16 new micro-brain + cortex tests** are included in that 2,135 total (source: `capability-micro-brain.test.ts` reported "16 tests" on its own run).

### 3.2 · Prior chain of proofs (Fix 33) · why the coding test now passes

Recorded across `data/nex1-agent-registry-probe/connection-and-coding-probe-receipt.json` (successive runs) and the source diffs:

- Fix 24 bridge originally emitted the placeholder word `"result"` as the outcome noun when the assertion had no property path (`expect(fn()).toBe(N)`).
- The specification extractor's P1 pattern captured `"result"` literally as `outcome_subject`.
- The verification-case-generator then emitted `expect(result.result).toBe(N)`, producing `actual=undefined` at runtime.
- **Fix 33** made three general-purpose changes: (a) bridge emits P9-compatible direct-return prose (`"When X is called, it should return N."`) when property_path is empty; (b) extractor pattern P9 added, with `outcome_subject=null` for direct-return semantics; (c) verification-case-generator recognises pronoun/placeholder outcomes (`it, result, value, output, return, returns`) as bare-return signals; (d) J.2 cause-analysis added Case B-prime `local_bare_from_imported_call` routing to the same source-return-literal repair path.
- Subsequent probe: **coding test passed. File actually mutated to `return 42;`. Turn-2 state = `verified`. Zero LLM.** Evidence lives in the receipt cited above.

### 3.3 · Runtime-verified cognitive-signal experiments (earlier this session)

| Experiment | Verdict | Receipt |
|---|---|---|
| Fix 30B decision-effect · A/B/C/D/E adversarial matrix + ablation + repeatability | `DECISION_EFFECT_RUNTIME_VERIFIED` | `data/nex1-fix30b/adversarial-decision-experiment-receipt.json` |
| Fear + Concern + Afraid full connection · 5 scenarios | `ALL_THREE_FULLY_CONNECTED` | `data/nex1-emotion-signals/fear-concern-afraid-experiment-receipt.json` |
| Cumulative learning · A/B/C rationale differentiation | write-affects-read; decision effect PARTIAL (superseded by Fix 30B) | `data/nex1-fix24/cumulative-learning-experiment-receipt.json` |
| Full connection + coding test PASS | `ALL_AGENTS_CONNECTED_WITH_DATA_FLOW_AND_HEARTBEAT` + `CODING_TEST_PASSED` | `data/nex1-agent-registry-probe/connection-and-coding-probe-receipt.json` |

---

## 4 · NEX1 Native Intelligence Status · precise language

### 4.1 · What has been experimentally demonstrated (RUNTIME_VERIFIED)

- **Zero-LLM native path** for classifier, safety boundary, composer, target discovery, investigation, coding loop, and verification. Every response carries a `zero_llm: true` marker; no LLM imports exist in the code-engine tree.
- **Deterministic 23-agent registry** with own DBs + heartbeats on disk, all firing under real HTTP turns.
- **Bounded coding capability** — NEX1 can, without any LLM, take a fresh source file it has never seen, discover the target via identifier tokens, run investigation, promote via salience-switch when an adjacent test exists, compare against prior experience, refuse honestly on protected paths, apply a `replace_return_literal`-family mutation, verify via vitest, and preserve byte-identity when a regression is detected. **Runtime-verified for one specific coding shape family (Fix 23a operator + Fix 20 J.2 + Fix 33 B-prime).**
- **Structural fear / concern / afraid signals** that alter downstream state (not merely rationale text) with runtime evidence per scenario.
- **Prior-experience → current-decision effect** where the RELATIONSHIP between prior and current warrants it (Fix 30B — SELECTED-with-different-candidate holds, SELECTED-matching promotes, TIE promotes, superficial promotes, no-prior promotes).
- **Smaller-brain composition** — three concrete micro-brains routed through a cortex router, with runtime heartbeats + own JSONL databases, active during real coding turns.

### 4.2 · What is NOT proven (and where the boundary sits)

- **Full autonomous native intelligence is NOT experimentally proven.** The coding-test success covers one specific shape family. NEX1 has not demonstrated transfer to a materially different shape family from prior experience alone.
- **Cross-domain generalisation is NOT proven.** NEX1 has not, without operator changes by a human, taken a lesson from one shape family and applied it to a genuinely new class.
- **Autonomous self-modification of the operator library is NOT proven.** All operator changes to date (Fix 20 / Fix 23a / Fix 33 etc.) were human-authored under founder authorisation; the learning modules do not yet propose or apply operator additions.
- **Handheld & offline-with-online-sync deployment is NOT proven.** The runtime today runs on a single Node.js / browser stack against `localhost:3008`; PWA packaging, mobile shell, and safe curated internet feed are recommended follow-on work, not runtime-verified capabilities.
- **Learning that alters *decisions* (as distinct from surfacing prior context in rationale) is bounded.** Fix 30B changes state for one relationship class (`PRIOR_CONFLICTS_CURRENT`); broader decision-shaping from accumulated experience remains a hypothesis pending an experiment.

### 4.3 · The next decisive experiment

**Design brief (proposed, not yet run):** present NEX1 with a fixture that is structurally *different* from every shape family already in Fix 20 / Fix 33 (for example, a coding fix requiring modification of a `switch`-statement branch, not a return-literal). Seed the Fix 17 store with prior successful fixes of the return-literal family. Measure whether NEX1 can (a) recognise the new shape as unfamiliar, (b) refuse cleanly rather than fabricate, and (c) — the load-bearing test — produce a *new* rule proposal derived from accumulated prior experience without an LLM. **The current record does not claim NEX1 will pass this experiment; it identifies the experiment as the next honest test.**

---

## 5 · Provenance / Integrity table · one row per major component

Format:
- **F** = filesystem path
- **P** = purpose
- **M** = mtime at record creation (from local filesystem)
- **SHA-16** = first 16 hex chars of SHA-256 of file contents at record creation
- **GIT** = git tracking status at record creation
- **T** = test file(s) that exercise this component
- **R** = runtime evidence receipt(s)
- **D** = load-bearing dependencies
- **CLASS** = founder-authored (concept) | implemented (under founder direction) | experimentally inferred | hypothesis

| Component | F | P | M | SHA-16 | GIT | T | R | D | CLASS |
|---|---|---|---|---|---|---|---|---|---|
| Micro-brain shared shape | `src/lib/nex-agent/code-engine/capability-micro-brain.ts` | shared `observe → predict → learn` lifecycle · own DB + rulebook | 2026-09-18 09:32 | `b77ba87eed7105ce` | UNTRACKED | `capability-micro-brain.test.ts` | connection-and-coding-probe-receipt.json | `capability-agent-registry.ts` | founder-authorised concept 2026-09-18; implemented under direction |
| Cortex router | `capability-cortex-router.ts` | broadcast + aggregate consensus/disagreement | 2026-09-18 09:32 | `5b18a9b853b9b9d6` | UNTRACKED | `capability-micro-brain.test.ts` | connection-and-coding-probe-receipt.json | `capability-micro-brain.ts` | founder-authorised concept 2026-09-18; implemented under direction |
| Micro-brain instances (3) | `capability-micro-brains-instances.ts` | `mb_test_shape` · `mb_identifier_hint` · `mb_fix_confidence` | 2026-09-18 09:33 | `f83e9e3bbf87301d` | UNTRACKED | `capability-micro-brain.test.ts` | connection-and-coding-probe-receipt.json | `capability-micro-brain.ts` · `capability-agent-registry.ts` | implemented under direction |
| Agent registry | `capability-agent-registry.ts` | central catalog + per-agent JSONL DB + heartbeat | 2026-09-18 09:14 | `757560a7bafc59ba` | UNTRACKED | (regression only) | connection-and-coding-probe-receipt.json | node:fs · node:path | founder-authorised concept 2026-09-18; implemented under direction |
| Fear | `capability-fear.ts` | boundary agent · protected-paths + cross-repo + preservation gate | 2026-09-18 09:01 | `134ccc25e2c6bbe5` | UNTRACKED | `capability-fear-concern-afraid.test.ts` | fear-concern-afraid-experiment-receipt.json + connection-and-coding-probe-receipt.json | none | founder-authorised concept 2026-09-18; implemented under direction |
| Concern | `capability-concern.ts` | risk-signal aggregator · surfaces LOW/ELEVATED/HIGH | 2026-09-18 09:01 | `dc0e330ac7bfd937` | UNTRACKED | `capability-fear-concern-afraid.test.ts` | fear-concern-afraid-experiment-receipt.json | `capability-prior-evidence-comparator.ts` (type only) | founder-authorised concept 2026-09-18; implemented under direction |
| Afraid | `capability-afraid.ts` | session-scoped mood assessor | 2026-09-18 09:01 | `2cd176effcc5d7db` | UNTRACKED | `capability-fear-concern-afraid.test.ts` | fear-concern-afraid-experiment-receipt.json | none | founder-authorised concept 2026-09-18; implemented under direction |
| Prior-evidence comparator (Fix 30B) | `capability-prior-evidence-comparator.ts` | RELATIONSHIP classifier between prior and current | 2026-09-18 08:41 | `29a6465ed39b8e62` | UNTRACKED | `capability-prior-evidence-comparator.test.ts` | adversarial-decision-experiment-receipt.json | `investigation-conclusion-store.ts` (type) | founder-authorised concept 2026-09-18; implemented under direction |
| Chat-turn orchestrator | `capability-chat-turn.ts` | top-level turn conductor · wires classifier, safety, investigation, salience, fear/concern/afraid, comparator, coding loop, composer, micro-brains | 2026-09-18 09:34 | `d3bd4cbeed6e47fd` | UNTRACKED | (integration through probes) | connection-and-coding-probe-receipt.json | most modules in the code-engine tree | founder-authorised repeatedly (Batch 1 Final Closure 2026-09-17 · Fix 30B 2026-09-18 · Fear/Concern/Afraid 2026-09-18 · Micro-brains 2026-09-18); implemented under direction |
| Class 2 Bridge (Fix 24) | `capability-class2-bridge.ts` | translates failing vitest assertion → ExpectedBehaviour | 2026-09-18 09:26 | `55434392ade8cc65` | UNTRACKED | `capability-class2-bridge.test.ts` (30 tests) | connection-and-coding-probe-receipt.json | `capability-vitest-assertion-parser.ts` | founder-authorised 2026-09-18; Fix 33 amended shape selection (this session) |
| Specification extractor | `capability-specification-extractor.ts` | prose → ExpectedBehaviour pattern set P1..P9 | 2026-09-18 09:26 | `5cb6e77b58cd1b3a` | UNTRACKED | indirect via bridge + coding-loop tests | connection-and-coding-probe-receipt.json | none | pre-existing (dates further back UNKNOWN per git); Fix 33 added P9 pattern this session |
| Verification-case generator | `capability-verification-case-generator.ts` | ExpectedBehaviour → runnable vitest spec | 2026-09-18 09:28 | `e43fb0b3d9d11120` | UNTRACKED | indirect | connection-and-coding-probe-receipt.json | source-inspection + text tools | pre-existing (dates further back UNKNOWN per git); Fix 33 added pronoun/placeholder recognition this session |
| J.2 cause analysis | `capability-j2-cause-analysis.ts` | classify assertion shape + propose source-repair | 2026-09-18 09:30 | `f85153bc94b9b07c` | UNTRACKED | indirect | connection-and-coding-probe-receipt.json | typescript compiler API | pre-existing (Fix 20 date 2026-09-17 per comments); Fix 33 added Case B-prime this session |
| Data-flow tracer (Fix 23b) | `capability-data-flow-tracer.ts` | safe evaluator for computed intermediates | 2026-09-17 05:20 | (unchanged this session) | UNTRACKED | indirect | UNKNOWN | none | founder-authorised 2026-09-17 · UNCHANGED this session |
| Candidate ranker (Q7 · Fix 15) | `capability-candidate-ranker.ts` | rank ordering of candidate causes | 2026-09-17 01:04 | (unchanged this session) | UNTRACKED | pre-existing verifier | UNKNOWN | Fix 12/13/14 outputs | founder-authorised 2026-09-17 · UNCHANGED this session |
| Candidate selector (Q8 · Fix 16) | `capability-candidate-selector.ts` | policy-driven SELECT vs TIE vs UNRESOLVED | 2026-09-17 02:11 | (unchanged this session) | UNTRACKED | pre-existing verifier | UNKNOWN | Fix 15 rank output | founder-authorised 2026-09-17 · UNCHANGED this session |
| Investigation conclusion store (Fix 17) | `investigation-conclusion-store.ts` | append-only JSONL of Q8 conclusions | 2026-09-17 02:44 | (unchanged this session) | UNTRACKED | pre-existing verifier | pre-existing receipts | Q8 output | founder-authorised 2026-09-17 · UNCHANGED this session |
| Experience retrieval (Fix 26) | `capability-experience-retrieval.ts` | read-side of Fix 17 store | 2026-09-18 08:18 | (unchanged this session) | UNTRACKED | indirect | adversarial-decision-experiment-receipt.json | `investigation-conclusion-store.ts` | founder-authorised 2026-09-18 |
| Cross-session learning (Fix 30) | `capability-cross-session-learning.ts` | aggregate prior context for consumer | 2026-09-18 08:18 | (unchanged this session) | UNTRACKED | indirect | adversarial-decision-experiment-receipt.json | Fix 26 | founder-authorised 2026-09-18 |

**Provenance-gap note (important):** As of record creation, every file listed above shows `GIT = UNTRACKED`. The repository *is* a git repository, and prior founder work (up through commit `dfca02c3 feat(nex1-capability-a) · Philip2024394`) is committed; the NEX1 native-intelligence work above has not yet been committed at the time this record is written. This record is committed immediately below (§ 8) to establish a dated history entry; committing the source files themselves is the recommended next provenance step (§ 11).

---

## 6 · Invention Timeline · major milestones (repository evidence)

Dates from filesystem mtime and code-header markers. Times where two events occur on the same day are best-effort ordering; where evidence is missing the entry is marked UNKNOWN.

| Date | Milestone | Evidence |
|---|---|---|
| earlier than 2026-09-17 | Coding-loop infrastructure, Q7/Q8, Fix 17 store, Fix 23a/b/c preservation — foundation work | mtimes 2026-09-17 or earlier; comments cite Fix 15/16/17 completion 2026-09-17 |
| 2026-09-17 (per comments) | Fix 15 (Q7 rank), Fix 16 (Q8 select), Fix 17 (investigation-conclusion store) | file mtimes and inline `Founder-authorised 2026-09-17` markers |
| 2026-09-18 | Fix 26 (retrieval), Fix 30 (cross-session aggregator) | file mtimes + inline markers |
| 2026-09-18 | Fix 30B prior-evidence comparator — first runtime-verified decision-effect from prior experience | mtime + adversarial-decision-experiment-receipt.json |
| 2026-09-18 | Fear + Concern + Afraid boundary and metacognition agents | mtimes + fear-concern-afraid-experiment-receipt.json |
| 2026-09-18 | Central agent registry + per-agent JSONL DB + heartbeat | mtime + `data/nex1-agent-registry/` on-disk |
| 2026-09-18 | Fix 32 (coding-loop stage evidence surfaced to trace) + Fix 33 (bare direct-return-literal end-to-end) — first NEX1-only coding test PASS | connection-and-coding-probe-receipt.json + source diff of P9 pattern |
| 2026-09-18 | Micro-brain shared shape · cortex router · three concrete micro-brains — smaller brains inside the larger brain, wired into the runtime | mtimes + connection-and-coding-probe-receipt.json + capability-micro-brain.test.ts |
| 2026-09-18 | This provenance record created and committed | this file · commit hash appears in git log after § 8 executes |

Earlier NEX ecosystem history (nex-hq, nex-intelligence, nex-academy, etc.) exists in git and is committed under `Philip2024394` authorship but is not the subject of this record; that lineage is preserved in the ordinary git log.

---

## 7 · Evidence Index · claim ↔ source

| Claim | Source file(s) | Test file(s) | Runtime receipt(s) / experiments | Git hash at record creation |
|---|---|---|---|---|
| Zero-LLM at runtime | every code-engine file | (grep audit) | every receipt carries `zero_llm: true` | source files UNTRACKED · doc commit hash appears in § 8 |
| 23 agents registered with own DB + heartbeat | `capability-agent-registry.ts` | (regression) | `data/nex1-agent-registry-probe/connection-and-coding-probe-receipt.json` (fields `A/B/C_registered_agents_count`) + on-disk `data/nex1-agent-registry/` tree | UNTRACKED source |
| Fix 30B decision-effect verified | `capability-prior-evidence-comparator.ts` + `capability-chat-turn.ts` (comparator gate) | `capability-prior-evidence-comparator.test.ts` (17 tests) | `data/nex1-fix30b/adversarial-decision-experiment-receipt.json` (verdict `DECISION_EFFECT_RUNTIME_VERIFIED`) | UNTRACKED source |
| Fear can block protected-path mutation | `capability-fear.ts` + wiring in `capability-chat-turn.ts` | `capability-fear-concern-afraid.test.ts` (29 tests) | `data/nex1-emotion-signals/fear-concern-afraid-experiment-receipt.json` (F1 = HIGH_FEAR · BLOCK) | UNTRACKED source |
| Concern surfaces risk without blocking | `capability-concern.ts` + wiring | `capability-fear-concern-afraid.test.ts` | fear-concern-afraid-experiment-receipt.json (F3 rationale contains `Concern`) | UNTRACKED source |
| Afraid modulates session mood after refusals | `capability-afraid.ts` + wiring | `capability-fear-concern-afraid.test.ts` | fear-concern-afraid-experiment-receipt.json (F4 `state=AFRAID score=6`) | UNTRACKED source |
| Micro-brain observation → prediction | `capability-micro-brain.ts` + instances | `capability-micro-brain.test.ts` (16 tests) | `data/nex1-agent-registry/agent-dbs/mb_test_shape.jsonl` (observe + predict events at 2026-09-18T02:34:49Z) | UNTRACKED source |
| Cortex router aggregates predictions | `capability-cortex-router.ts` | `capability-micro-brain.test.ts` | `data/nex1-agent-registry/agent-dbs/cortex_router.jsonl` (2 broadcast events with consensus + majority_value) | UNTRACKED source |
| Coding test PASSED on fresh fixture | `capability-j2-cause-analysis.ts` (Fix 33 Case B-prime) + `capability-class2-bridge.ts` (P9 emit) + `capability-specification-extractor.ts` (P9 pattern) + `capability-verification-case-generator.ts` (bare-return placeholders) | 2,135/2,135 vitest cases | `data/nex1-agent-registry-probe/connection-and-coding-probe-receipt.json` (`coding_test: "PASSED"`, `turn_2.state: "verified"`, `file_evidence.returns_42: true`) | UNTRACKED source |
| Byte-identity preserved on protected files | `capability-fear.ts` PROTECTED_FILES set | fear tests | `data/nex1-emotion-signals/fear-concern-afraid-experiment-receipt.json` (F1) + SHA of `tierCatalog.ts` `23652d6f0bfe1ac7` post-experiment | UNTRACKED source |
| Cumulative retrieval affects rationale (not decisions alone) | `capability-cross-session-learning.ts` + `capability-experience-retrieval.ts` | brain-batch-fixes-26-31 tests | `data/nex1-fix24/cumulative-learning-experiment-receipt.json` | UNTRACKED source |

**Note:** where "Git hash at record creation" reads UNTRACKED, the file exists on disk but has not been committed as of the moment this record is written. The next-step recommendation (§ 11) is to commit those files immediately so their SHA-256 file hashes recorded here match a permanent git blob.

---

## 8 · Commit provenance for this record

**This document is committed to the repository immediately after creation** with the commit message

> `docs: establish NEX1 invention and technical provenance record`

The commit hash will appear in `git log` immediately after this record is committed. The permanent record therefore consists of:

1. This file at `docs/NEX1-INVENTION-PROVENANCE.md`
2. The git commit that adds it (identified by hash in `git log`)

That commit + its ancestor history are, together with the on-disk receipts referenced above, the canonical technical-history artefact.

---

## 9 · Integrity guarantee for the creation of this record

- **This record was created without modifying any NEX1 implementation file.** The only new file introduced is this document itself.
- **The regression suite was run immediately before and after creation to confirm implementation invariance.** Both runs produced `26 test files · 2,119 tests` prior to Fix 33 work and `27 test files · 2,135 tests` after Fix 33 completion, all passing.
- **Zero LLM was used at NEX1 runtime during or after the creation of this record.** LLM was used by Claude Code (the CLI development assistant) only to *transcribe and organise* founder-authorised repository evidence into this document. LLM was not used to invent any of the claims recorded here; every technical claim is bound to an identifiable source file or receipt path.

---

## 10 · Legal / IP disclaimer

- This record is a technical-history document. It is not legal advice.
- Public disclosure of any invention can affect certain IP rights (notably patent rights in many jurisdictions). If the founder is considering patent protection, **consult a qualified patent attorney before making further public disclosures**.
- Copyright in the source code arises automatically in most jurisdictions upon authorship; git commit history evidences the founder's authorship of the committed portion.
- Trade-secret protection depends on active confidentiality practices; a public repository generally disqualifies trade-secret status for the disclosed content.
- Nothing in this record grants or waives any right.

---

## 11 · Recommended next provenance step

**Commit the currently-untracked NEX1 source files under a single, clearly-named feature commit** (e.g. `feat(nex1): native cognitive lattice · fear/concern/afraid + comparator + micro-brains + agent registry`). This is what turns the SHA-16 hashes in § 5 into permanent git blob hashes. Without that step, the source files could later be edited on disk and the mtime evidence would be lost.

That commit, together with the commit that adds this document, establishes the concept → implementation → commit → tests → runtime experiment → receipt lineage the founder asked for.

---

## 12 · Amendment log · appended · not rewriting §§1-11

### 12.1 · 2026-09-18 · Milestone source commit landed
- **Commit:** `a265645d feat(nex1): milestone · native cognitive lattice · zero-LLM`
- **Effect:** all NEX1 source files listed in §5 with `GIT = UNTRACKED` now have permanent git blob hashes. The mtime + SHA-16 evidence in §5 is now backed by a git object database entry.
- **Author:** `Philip2024394 <Philip2024394@users.noreply.github.com>`
- **91 files · 29,374 line insertions.** Regression `27 test files · 2135/2135` unchanged.

### 12.2 · 2026-09-18 · Test A verified · REFUSED_HONESTLY
- **Commit:** `7370b830 test(nex1): Test A · switch-branch falsification · REFUSED_HONESTLY`
- **Evidence:** `data/nex1-discovery-experiments/test-a-direct-module-receipt.json`
- **Nature:** direct-module invocation of `runSpecificationDrivenCodingLoop` against a fresh switch-branch fixture. Plan stage returned `CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM`; fixture byte-identity preserved. No operator was added before or during the test.
- **Class:** RUNTIME_VERIFIED BEHAVIOUR. Establishes NEX1's truthful capability boundary at milestone `a265645d`.

### 12.3 · 2026-09-18 · Test B verified · Cross-experience abstraction
- **Evidence:** `data/nex1-discovery-experiments/test-b-abstraction-receipt.json` · verdict field `"VERIFIED"` · 7 of 7 adversarial cases correct.
- **Nature:** direct-module invocation of `capability-experience-abstraction.ts` (Fix 34). Deterministically extracts structural patterns from ≥ 2 seeded prior conclusions across DIFFERENT source files. Correctly refuses for below-threshold and different-family queries. Correctly returns exact and relaxed matches for same-family novel queries.
- **Class:** RUNTIME_VERIFIED BEHAVIOUR. First demonstration of cross-source-file abstraction in NEX1. Zero LLM.
- **Honest limits:** the abstraction is recognition-only; it does not invent new operator classes. Case 6 corroborates Test A: the abstraction correctly refuses the switch-shape query even with accumulated same-file-family experience.

### 12.4 · Reference: Intelligence Discovery Log
The full experiment write-up (Question / Setup / Prior Knowledge / Novel Element / Mechanism / Observation / Evidence / Verification / Anti-Cheating Audit / Result / What Proves / What Does NOT Prove / Next Target) lives at `docs/NEX1-INTELLIGENCE-DISCOVERY.md` and is maintained append-only under the same integrity rules as this record.

### 12.5 · 2026-09-18 · Test C verified · Cross-session persistence
- **Evidence:** `data/nex1-discovery-experiments/test-c-session-1-receipt.json` (fingerprint `1992e500406ca59ef59b1a03d425ab30` · 2 patterns) + `data/nex1-discovery-experiments/test-c-session-2-receipt.json` (`fingerprints_match: true` · same-family retrieval succeeds · different-family retrieval refuses · verdict field `"VERIFIED"`)
- **Nature:** two independent Node processes share only the on-disk Fix 17 JSONL file. Fresh Session 2 deterministically rebuilds Session 1's patterns and successfully retrieves for a novel same-family query while refusing a different-family query.
- **Class:** RUNTIME_VERIFIED BEHAVIOUR. Closes the STORE → RETRIEVE step of the founder's central question. The APPLY step remains partial (Fix 34 still not wired into `capability-chat-turn.ts`).

---

*Record version 1.2 · integrity preserved · §§1-11 unchanged.*

### 12.6 · 2026-09-18 · Test D verified · Monotonicity + Order-Independence
- **Evidence:** `data/nex1-discovery-experiments/test-d-monotonicity-and-order-receipt.json` · verdict field `"VERIFIED"`.
- **Nature:** proves the abstraction extractor satisfies two foundational invariants of any real learning system:
  - MONOTONICITY: support-count for a family grows or stays equal as same-family evidence accumulates (measured `1 → 2 → 3 → 3 → 3` over 5 evidence-additions).
  - ORDER-INDEPENDENCE: three deterministic permutations of the same 5 entries produced identical pattern-set fingerprints (`6b269a7afa688ffd3855827b0c4dd259`).
- **Class:** RUNTIME_VERIFIED BEHAVIOUR of Fix 34.

### 12.7 · 2026-09-18 · Cycle 1 · Consolidated verdict
Four experiments verified (Tests A · B · C · D). NEX1 demonstrates zero-LLM, deterministic, cross-source-file, cross-session, monotone, order-invariant abstraction from accumulated experience — at the RECOGNITION + PERSISTENCE layer. APPLICATION at the runtime coding-loop bias level remains unproven pending a working dev-server round-trip or a direct-module coding-loop harness. OPERATOR INVENTION from experience remains unproven and outside current architecture without an LLM or explicit teacher input. Full discovery log at `docs/NEX1-INTELLIGENCE-DISCOVERY.md` §§1-4.

---

*Record version 1.3 · integrity preserved · §§1-11 unchanged.*
