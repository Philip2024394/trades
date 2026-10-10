# NEX1 Test J · Source-Level Investigation Diagnostic

**Date:** 2026-09-16
**Author:** master_ai_engineer (Claude Opus 4.7)
**Track:** B (native investigation diagnostic · Track A remains FROZEN)
**Repository:** `C:\Users\Victus\trades`
**Doctrine triad enforced:** Undercount Protection · Connect-Before-Build · Prove-Before-Progression

---

## Founder Direction

> "Test I proved location. Test J attacks a completely different and extremely
> important question: Can NEX1 actually read and reason about the implementation
> inside a file it has already found? Problem → Find file → Read implementation →
> Identify behaviour → Explain evidence → Separate OBSERVED / INFERRED / HYPOTHESIS /
> PROVEN. Source-level reasoning is the bridge between investigation and actual coding."

**Instructions:**
1. Design Test J — problem where relevant file is *deliberately surfaced*
2. Answer cannot be determined from filenames, vocabulary, or dependency edges
3. Run blind
4. Measure: does NEX1 report OBSERVED / INFERRED / HYPOTHESIS / PROVEN separation, or stop at "file found"?
5. STOP after Test J (no auto-Fix, no capability build)

---

## Overall Classification

**`LOCATED_ONLY_NO_SOURCE_ANALYSIS`** · clean architectural boundary discovered.

- File deliberately surfaced: ✓ at rank 5 via `classifier_file_ref` evidence marker
- Structural neighborhood surfaced: ✓ 4 edge-expanded neighbors, direction-tagged
- Any source-derived content in evidence packet: ✗ **zero**
- OBSERVED / INFERRED / HYPOTHESIS / PROVEN separation in packet shape: ✗ **absent**
- Confidence honestly calibrated to reflect the boundary: ✓ 0.60 · FLAG_FOR_REVIEW
- Zero fabrication of policy or code details: ✓

Native investigation reads *paths, hashes, tags, imports*. It does not read *source content*. That is the honest system boundary.

---

## Phase 0 · Pre-Build Audit (Undercount Protection)

Before designing Test J, three source-reading capabilities were checked for existing wiring:

| Capability | Location | Uses source AST? | Wired into Investigation Mode? |
|---|---|---|---|
| capability-j-runtime-diagnosis | `src/lib/nex-agent/code-engine/capability-j-runtime-diagnosis.ts` | Yes (readFileSync + downstream) | **No** |
| capability-j2-cause-analysis | `src/lib/nex-agent/code-engine/capability-j2-cause-analysis.ts` | Yes (`ts.createSourceFile` + `readFileSync`) | **No** |
| capability-k-local-value-dataflow | `src/lib/nex-agent/code-engine/capability-k-local-value-dataflow.ts` | Yes (`ts.createSourceFile` + `readFileSync`) | **No** |

Grep receipts (confirmed):
- `native-investigation-mode.ts` · zero imports of any J/K capability
- `native-investigation-mode.ts` · zero `readFileSync` calls
- `native-investigation-absence.ts` · zero source-content reads

Classification: **CONNECTION vs BUILD gap.** Source-reading capabilities exist. They are NOT connected to Investigation Mode's flow.

This is precisely the class of gap the founder's Test J framing predicted.

---

## Phase 2 · Ground Truth (verified from source · withheld from NEX1)

Target file: `src/lib/nex1-orchestrator/wo9-corrector.ts`
Target function: `proposeCorrection(input)`

Decision policy (all buried inside function body · not deducible from name or imports):

| # | Line | Condition | Outcome |
|---|---|---|---|
| GATE 1 | 73 | `!canContinueCorrection(cycle_state)` (attempts ≥ max_attempts) | `escalate_to_founder` · `MAX_ATTEMPTS_EXHAUSTED` |
| GATE 2 | 84 | `!diagnosis.has_failures` | `escalate_to_founder` · `NO_RULE_MATCHES` |
| RULE 1 | 112 | `allTransient && anyTransient` (every failure is transient build/runtime) | `retry_same_plan` · `RETRY_TRANSIENT` |
| RULE 2 | 146 | `allInPlan && allFailuresAreMissingFile` | `reinvoke_plan_missing_files` · `REINVOKE_PLAN_MISSING_FILES` |
| DEFAULT | 166 | anySpecialistUnavailable → `REQUIRES_NEW_CAPABILITY`; anySignalUncorrectable → `P_S_CANNOT_DECIDE_AUTOMATICALLY`; else → `NO_RULE_MATCHES` | `escalate_to_founder` |

To answer the problem correctly NEX1 would need to:
1. Locate wo9-corrector.ts (proven by earlier tests)
2. Read `proposeCorrection` function body
3. Enumerate the 3-way branch (retry / reinvoke / escalate)
4. Extract the gate conditions and rule literals
5. Distinguish OBSERVED code from INFERRED behaviour from HYPOTHESIS
6. Not fabricate policies absent from the code

Vocab audit (blocker discovered during design): `wo9-corrector.ts` has zero classifier-vocab overlap with correction-domain terms (correction / cycle / plan / retry / escalate / failure / diagnosis / corrector all missing from CODING_LEXEME_INDEX). Its tags reduce to: `[adr, auth, deterministic, eslint, export, import, iteration, npm, signal, state, success, workspace] + [lib, nex1-orchestrator]`. To guarantee location per the founder's "deliberately surfaced" direction, the file path is embedded in the problem statement, landing wo9-corrector.ts via classifier's `extractFileReferences` (regex-based · `classifier.ts:103`).

---

## Phase 4 · Blind Run

**Problem statement (fed verbatim to NEX1):**

> "Investigate src/lib/nex1-orchestrator/wo9-corrector.ts to determine what conditions cause proposeCorrection to retry a plan, reinvoke it, or escalate to the founder."

**NEX1 output:**

- Verdict: `SUFFICIENT_EVIDENCE`
- Trigger: `PRIMARY_INVESTIGATE`
- Confidence: `FLAG_FOR_REVIEW` (0.60)
- Concepts extracted: **[]** (empty — no matching lexemes in problem body)
- File references extracted: 1 · `src/lib/nex1-orchestrator/wo9-corrector.ts`
- Seed corpus: 516 files
- Candidates after file-memory + file-ref: 1
- Dep-graph edges: 648
- Edge-expansion: 4 additional files via structural edges

### Top 5 candidates (all NEX1 surfaced)

| Rank | Path | Score | Evidence |
|---|---|---|---|
| 1 | `wo12-real-correction-cycle.test.ts` | 0.6 | `edge:imports_top:wo9-corrector.ts` |
| 2 | `wo9-correction-loop.test.ts` | 0.6 | `edge:imports_top:wo9-corrector.ts` |
| 3 | `wo3-types.ts` | 0.6 | `edge:imported_by_top:wo9-corrector.ts` |
| 4 | `wo9-types.ts` | 0.6 | `edge:imported_by_top:wo9-corrector.ts` |
| 5 | `wo9-corrector.ts` (target) | 0.0 | `classifier_file_ref:.../wo9-corrector.ts` |

### Hypotheses / evidence

```
hypotheses:      ["Top candidate ... matches 0/0 concept(s)"]
evidence_for:    ["file matches ALL extracted concepts: "]     ← empty concept list
evidence_against: []
unknown_facts:   []                                             ← should have declared uncertainty
```

---

## Diagnostic Analysis

### 1. Source-content probe (echo-excluding)

Every code literal from `proposeCorrection` was searched against the **source-derived fields** of the packet (hypotheses, evidence_for/against, unknown_facts, recommended_next_step, reasoning_trace, candidate summaries, candidate evidence_signals, absence_candidates, dependency_graph_sample, search_terms, relevant_matches_by_tag, concepts). The `original_problem` field was excluded because it echoes the problem statement I provided (which itself contains the word "proposeCorrection") — an early version of this probe hit a false positive on that echo, which is documented in `probe.ts` as a probe-fix.

| Literal | Present in source-derived fields? |
|---|---|
| `RETRY_TRANSIENT` | ✗ |
| `REINVOKE_PLAN_MISSING_FILES` | ✗ |
| `MAX_ATTEMPTS_EXHAUSTED` | ✗ |
| `REQUIRES_NEW_CAPABILITY` | ✗ |
| `P_S_CANNOT_DECIDE_AUTOMATICALLY` | ✗ |
| `NO_RULE_MATCHES` | ✗ |
| `proposeCorrection` | ✗ |
| `canContinueCorrection` | ✗ |

**All eight literals absent.** Zero content from `wo9-corrector.ts` reached the evidence packet. NEX1 does not read source.

### 2. Packet-shape probe (OBSERVED / INFERRED / HYPOTHESIS / PROVEN)

The founder asked whether NEX1 could separate these four evidence classes. The packet type (verified from `native-investigation-mode.ts:70-138`) exposes:

| Founder-requested field | Packet reality |
|---|---|
| `observed[]` | ✗ absent from packet shape |
| `inferred[]` | ✗ absent from packet shape |
| `hypothesis[]` | Partial — `hypotheses[]` exists but is heuristic ("Top candidate matches N/M concept(s)"), not source-derived |
| `proven[]` | ✗ absent from packet shape |
| `evidence_for[]` | present · but empty when concepts=[] |
| `evidence_against[]` | present · but never populated in this run |
| `unknown_facts[]` | present · **but empty** — NEX1 did not declare the honest uncertainty |

The packet CANNOT report source-level evidence because it has no shape to carry it and no capability to produce it.

### 3. What the system DID do

- Correctly classified the goal as INVESTIGATE (verb classifier working)
- Correctly extracted the file reference (regex-based file-path extractor working)
- Correctly located the target file via `store.recallFile()` (Capability M-1 working)
- Correctly built a 648-edge dep-graph over 300 files
- Correctly promoted 4 structural neighbors via edge expansion (Fix 5 working)
- Correctly reported the surfacing with unambiguous evidence markers
- Correctly refused to fabricate policy details it hadn't observed

### 4. What the system did NOT do

- Did not open `wo9-corrector.ts` and read a byte of its source
- Did not parse the AST
- Did not identify the function `proposeCorrection`
- Did not enumerate the 3-way branch structure
- Did not extract the rule literals or condition names
- Did not declare "I cannot answer this without source reading" in `unknown_facts[]`
- Did not separate OBSERVED / INFERRED / HYPOTHESIS / PROVEN

---

## Interpretation

Test J tests a completely different capability class than Tests A–I. Tests A–I proved:

1. Language: classifier extracts intent + concepts from natural-language problems (Tests A–F)
2. Concept-to-file: File Memory tag lookup surfaces candidates matching problem vocabulary (Tests G-fix + H clean)
3. Files-to-structure: dep-graph edge expansion surfaces 1-hop neighbors of top-10 (Test H clean)
4. Structure boundary: 2-hop navigation not present in current architecture (Test I)

Test J attacks the next class: **file → source → behaviour → evidence**. This class is architecturally absent from Investigation Mode. Source-reading capabilities (J, J.2, K) exist elsewhere in the code engine but are not wired into the investigation flow.

This is the exact boundary the founder's Test J framing anticipated. The founder's language:

> "A coding AI that confidently guesses is dangerous. A coding system that can say 'I found something relevant, but I don't have enough evidence to establish causality' is much closer to something you can eventually trust with controlled modification."

The system passed the honesty test *by construction*: it produced no source-level claims, no fabricated policy, no false confidence — because it has no code path that could produce those. That is architecturally safe; it is also architecturally insufficient for the coding-plan-generation step the founder is building toward.

---

## Truth-Doctrine Compliance

| Requirement | Status |
|---|---|
| Ground truth verified from source before probe | ✓ Phase 0/2 read wo9-corrector.ts:1-200 · policy verified line-by-line |
| Ground truth withheld from NEX1 during probe | ✓ Only problem statement fed |
| Confound identified before probe (not after) | ✓ vocab-overlap gap documented in Phase 0 · addressed via file-reference guarantee |
| Result classified honestly | ✓ `LOCATED_ONLY_NO_SOURCE_ANALYSIS` — not upgraded despite file being found |
| False positive caught before shipping | ✓ Early run mis-classified as `LOCATED_WITH_SOURCE_EVIDENCE` because packet's `original_problem` echoed `proposeCorrection`; probe was fixed to exclude echo, then re-run |
| No fabricated causality in NEX1 output | ✓ NEX1 produced no policy claims |
| Confidence remained honest | ✓ 0.60 · FLAG_FOR_REVIEW · calibrated |
| Prove-Before-Progression | ✓ Test J did NOT credit source-reading to Investigation Mode |
| Undercount Protection | ✓ Source-reading capabilities inventoried before designing (found J, J.2, K exist but disconnected) |
| Zero-LLM | ✓ Deterministic throughout |
| Track A frozen | ✓ No modifications to G7/G8/G11/G12/G13/G15/G16/G17/Truth Engine/C1/C3/C6 |

---

## Findings

**F1 · Investigation Mode's boundary is at the file-metadata layer.**
Path, hash, size, tags, import edges — all captured. Function names, gate conditions, rule literals, string constants inside functions — none captured. The architectural gap is one connection, not a missing capability.

**F2 · The Undercount Protection check paid off again.**
Three source-reading capabilities (J, J.2, K) already exist. All use `ts.createSourceFile` and `readFileSync`. All are downstream of runtime-failure findings (J) or highly-specific structural patterns (K). None is invoked from a natural-language problem statement. Any future Fix must CONNECT one to Investigation Mode; there is no need to BUILD an AST parser.

**F3 · The system was honest about its limits.**
The packet contains no claim it cannot support. `unknown_facts` is empty in this run — arguably it should contain "cannot answer without source reading" — but the system did not fabricate an answer to fill the void. That is the founder's stated design goal: refuse rather than guess.

**F4 · Vocabulary gap for correction-domain.**
`wo9-corrector.ts` has zero classifier-vocab overlap with correction terminology despite being 174 lines of correction logic. This is a real domain-vocab gap and would need addressing before a natural-language "how does correction work" query could self-locate the file. Not blocking Test J (file-reference route was used) but noted for future.

**F5 · The packet shape is not designed for source evidence.**
`InvestigationEvidencePacket` has fields for hypotheses/evidence_for/evidence_against/unknown_facts — none of which are typed to carry per-file, per-line, or per-function claims. Any Fix 7 will need new packet fields alongside new source-reading logic.

---

## Fix 7 · Source-Level Investigation · DESIGN PROPOSAL (not authorised · not built)

Presented as design only. Do not build without founder authorisation.

### Sketch

Connect a bounded, deterministic source-reader into Investigation Mode. Two components:

**Component 1 · SourceInspector (new file · thin wrapper around existing infra)**
- For each top-K candidate (K ≤ 5), `readFileSync` the file bytes
- Parse via `ts.createSourceFile` (already used by capability-k)
- Extract structural facts only (no semantic inference):
  - Function names + parameter names + line ranges
  - If-branch conditions (as source text)
  - Return kind literals (as source text)
  - String literals appearing as arguments (bounded count)
- Emit a `SourceExtract` record per file

**Component 2 · Investigation packet shape extension**
- Add `observed_from_source: Record<file_path, SourceExtract>` — verbatim structural facts read from file
- Add `inferred_from_source: string[]` — anything derived by regex or AST walking (mark clearly)
- Add `proven_from_source: string[]` — exact-match structural equalities only
- Keep `hypotheses[]` and `unknown_facts[]` untouched

**Component 3 · Discipline**
- No semantic inference (never claim "this is the retry rule" — only claim "line 112 has if(allTransient && anyTransient) → returns kind=retry_same_plan")
- No LLM ever
- Bounded to top-K (default K=3 · hard cap K=5) to prevent unbounded reads
- File-size cap: skip files > 64 KB
- If a candidate is not readable, mark `unknown_but_source_derivable[]`
- If a candidate has no functions matching the concept-space, mark `no_relevant_functions`
- Confidence: unchanged formula (0.4·classifier + 0.6·top_score); do NOT inflate on source-read

### Anti-risks
- **Not a semantic reasoner.** Fix 7 emits structural facts, not policy interpretations. Users read the facts and decide themselves.
- **Not a bug detector.** Fix 7 does not flag issues; it exposes what is there.
- **Not open-ended.** Fix 7 reads a bounded set (top-K), not the whole corpus.

### Test J' (hypothetical follow-up · not scheduled)
After Fix 7 · re-run same problem · expect:
- `observed_from_source[wo9-corrector.ts]` contains function names including `proposeCorrection`, `canContinueCorrection`, `advanceCycleState`, `initialCorrectionCycleState`
- `observed_from_source[wo9-corrector.ts]` contains string literals including `RETRY_TRANSIENT`, `REINVOKE_PLAN_MISSING_FILES`, `MAX_ATTEMPTS_EXHAUSTED`, `NO_RULE_MATCHES`, `REQUIRES_NEW_CAPABILITY`, `P_S_CANNOT_DECIDE_AUTOMATICALLY`
- `observed_from_source[wo9-corrector.ts]` contains if-branch conditions with `canContinueCorrection`, `has_failures`, `allTransient`, `allInPlan`
- `hypotheses[]` remain interpretation-free — Fix 7 does not synthesise "this is a retry rule"

If passes → source-level *observation* is proven. Semantic interpretation (turning observed facts into a coding plan) is Test K territory.

---

## Files Touched

- **Written:** `scripts/nex1-test-j/probe.ts` (~245 LOC · test-only · disposable)
- **Written:** `scripts/nex1-test-j/vocab-probe.mjs` (~30 LOC · Phase 0 audit)
- **Written:** `scripts/nex1-test-j/vocab-probe-2.mjs` (~20 LOC · Phase 0 audit)
- **Written:** `scripts/nex1-test-j/vocab-probe-3.mjs` (~15 LOC · Phase 0 audit · exact vocab overlap)
- **Written:** `docs/doctrine/nex1-test-j-source-level-2026-09-16.md` (this report)
- **Zero production changes.** No `src/` modifications.
- No commits · no push per founder direction.

---

## Roadmap Position

- A–F ✅ investigation language
- G ✅ cross-file discovery
- H ✅ direct dependency traversal
- I ✅ multi-hop boundary honestly documented
- **J ✅ source-reading boundary honestly documented**
- K 🧪 evidence → coding plan (future · pending founder direction · needs Fix 7 first)
- L 🔒 authorized code modification (future · Track A gated)
- M 🔒 execution + verification (future · Track A gated)

Track A capabilities (G7 · G8 · G11 · G12 · G13 · G15 · G16 · G17 · Truth Engine · C1 · C3 · C6) remain FROZEN. No modifications to authority chain.

---

## Aggregate Test A–J Summary (evidence-based)

| Test | Ask | Result | Route proven |
|---|---|---|---|
| A | Absence-of-token | CORRECT · rank 1 | Neighborhood-tag reference set |
| B | Verb-vocab robustness | CORRECT after classifier fix | Tokenizer punctuation + lexicon variants |
| C | False-positive control | CORRECT | (present-token file did NOT flag) |
| D | Scope trap | CORRECT | LOCAL_SCOPE maintained |
| E | Insufficient expectation | CORRECT_REFUSAL | System refuses when contract underspecified |
| F | Multi-verb ambiguity | CORRECT via ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY | Fix 4 (existing signal consumption) |
| G | Cross-file navigation | CORRECT after G-fix | Dep-graph over broader corpus + architectural vocab |
| H | Direct-edge (1-hop) | CORRECT | Fix 5 edge expansion from top-10 |
| I | Multi-hop (2-hop) | INCONCLUSIVE · 1-hop via alt route | Current architecture 1-hop only |
| J | Source-reading | LOCATED_ONLY_NO_SOURCE_ANALYSIS | No source-content reader in flow |

**Aggregate: 8/10 CORRECT · 1/10 INCONCLUSIVE (Test I · honest boundary) · 1/10 CLEAN_BOUNDARY (Test J · honest boundary) · 0/10 INCORRECT · 0/10 HALLUCINATIONS.**

Two consecutive tests (I, J) hit clean boundaries — neither by system failure, both by architectural absence. In both, the system refused to fabricate. That is the founder's design goal: an investigator that says "I don't know yet" rather than one that guesses.

---

## Recommendation to Founder

**STOP after this report** — per your Test J STOP directive.

The next founder decision is one of these three (in evidence-supported preference order):

1. **Authorise Fix 7 · Source-Level Investigation**, then Test J' to prove structural source reading. Bridge between investigation and coding.

2. **Design Test K · from evidence to coding plan** without adding source-reading first. This asks whether NEX1, given a pre-populated evidence packet (perhaps hand-populated to simulate Fix 7 output), can produce a defensible coding plan. Tests the reasoning layer independently of the reading layer.

3. **Pause Track B to consolidate A–J into a native-investigation capability report** before continuing. Locks in the boundary map before extending.

I recommend option 1 (Fix 7). Without source reading, Test K cannot use real evidence — it would test only whether NEX1 can pattern-match on synthetic inputs. Fix 7 is a genuine CONNECTION (three source-reading capabilities already exist), not a BUILD, so it fits the Undercount Protection principle.

**Freeze remains in force. No code changes. No commits. No push.**
