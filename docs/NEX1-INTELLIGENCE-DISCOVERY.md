# NEX1 · Native Intelligence Discovery Log

**Purpose.** Append-only scientific log of experiments that push NEX1
beyond its current baseline capability. Every entry records what was
tested, what was proven, and what remains unproven. Truth over progress.

**Baseline milestone at start of this log:** commit `a265645d` (91 source
files · 2135/2135 tests passing at that point · zero-LLM runtime · fear /
concern / afraid / Fix 30B / agent registry / micro-brains / cortex /
Fix 33 coding-pass all committed).

---

## Experiment 1 · TEST A · Novel switch-branch shape · falsification

### Question
Does NEX1 fabricate a mutation when confronted with a shape family
outside its operator library, or does it refuse honestly?

### Setup
Fresh fixture · `src/lib/nex1-discovery-fixtures/risk-classifier.ts`:
```ts
export function classifyRiskLevel(score: number): number {
  switch (score) {
    case 1: return 10;
    case 2: return 20;
    case 3: return 40;   // bug
    default: return 0;
  }
}
```
Adjacent assertion asserts `expect(classifyRiskLevel(3)).toBe(30)`.
Direct-module invocation of `runSpecificationDrivenCodingLoop` (bypasses
HTTP + Tailwind — a stalled dev server made HTTP unusable; direct-module
is a more rigorous test anyway).

### Prior Knowledge in NEX1
Fix 20 (J.2 shape classifier) · Fix 21 (generator disambiguation) · Fix
22 (literal normaliser) · Fix 23a (`replace_return_literal` operator) ·
Fix 23b (data-flow tracer) · Fix 23c (preservation check) · Fix 33 P9
pattern + Case B-prime. **No switch-branch shape recogniser. No
switch-case operator. No fixture-specific rule for this file.**

### Novel Element
The switch shape itself. `switch (...) { case N: return X; ... }` is a
structural form no operator in the milestone library targets.

### Mechanism
Coding loop `understand → inspect → reason → plan → change → test → verify
→ diagnose → repair → verify → learn`. Fix 32 emits per-stage evidence.

### Observation
Full stage table from the receipt (`data/nex1-discovery-experiments/
test-a-direct-module-receipt.json`):

| Stage | Verdict | Summary |
|---|---|---|
| understand | VERIFIED | target identified |
| inspect    | VERIFIED | 1 failed test file, 2 findings |
| reason     | VERIFIED | 2 · kinds=[assertion_mismatch, assertion_mismatch] |
| plan       | **CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM** | *capability-J.2 and Capability K both refused · no proposal within deterministic scope* |
| change     | SKIPPED | no proposal · deterministic mutation not attempted |
| test       | SKIPPED | no change · nothing to verify |
| diagnose   | SKIPPED | no test rerun |
| repair     | SKIPPED | no diagnosis |
| verify     | SKIPPED | no repair |
| learn      | CAPABILITY_NOT_YET_IMPLEMENTED_WITHOUT_LLM | records the exact operator-family gap |

### File Evidence
- `risk-classifier.ts` byte-identity **PRESERVED** (before === after)
- `case 3: return 40;` still present (not fabricated to `return 30;`)
- `case 1: return 10;` and `case 2: return 20;` intact
- overall_verdict: `CODING_LOOP_NOT_YET_RUNTIME_VERIFIED`

### Anti-Cheating Audit
- No switch-branch operator was added before Test A ran.
- The fixture file name and identifier are novel (`classifyRiskLevel`, never seen).
- Zero LLM invocation.
- The plan-stage refusal reason is machine-emitted from J.2/K, not synthesised text.
- Test A ran on the exact milestone commit (`a265645d`) plus Fix 34 disconnected.

### Result
**VERIFIED · REFUSED_HONESTLY.** NEX1 correctly refuses when its operator
library does not cover the observed shape family, and does not fabricate.

### What This Proves
NEX1 has a truthful capability boundary. When the deterministic operator
library cannot classify the shape, the coding loop refuses at the plan
stage and preserves target byte-identity.

### What This Does NOT Prove
- That NEX1 can extend its operator library from experience.
- That NEX1 can solve switch-branch problems.
- That NEX1 can generalise across shape families.

### Next Intelligence Target
Cross-experience abstraction: given N prior experiences of the SAME
feature family, can NEX1 extract a pattern and correctly refuse for
different-family novel problems while retrieving the pattern for same-
family novel problems? → **Test B**.

---

## Experiment 2 · TEST B · Cross-experience abstraction · 7-case adversarial matrix

### Question
Can NEX1 discover a structural pattern from ≥ 2 accumulated experiences
that share a feature family, validate it against different-family
queries, and retrieve it for a novel same-family query — **without any
fixture-specific hardcoding**?

### Setup
Direct-module invocation of `capability-experience-abstraction.ts` (Fix
34 · shipped disconnected at milestone `a265645d`). Six adversarial
cases (7 including a 3b relaxation subcase) run against a seeded Fix 17
investigation-conclusion store. Every seed is a realistic
`InvestigationConclusionEntry` with a distinct `source_file`.

### Prior Knowledge in NEX1
Fix 17 store schema · Fix 26 read-side · Fix 30 aggregator (source-file
scoped) · Fix 30B relationship comparator (source-file scoped).
**No cross-source-file abstraction existed in NEX1 before Fix 34.**

### Novel Element (in NEX1)
Cross-source-file structural abstraction via generic `ShapeFeatures`
dimensions: `has_signature_format`, `value_type`, `path_dir_root`,
`path_dir_second`, `selection_state`. Grouping by exact-equality on
that vector, with two-tier relaxed retrieval.

### Mechanism
`extractShapeFeatures` (pure function of the entry) →
`extractPatterns(entries)` groups by `patternIdOf(features)` →
`retrievePattern(patterns, query)` runs exact → relaxed second-dir →
relaxed state.

### Observation

| # | Case | Result | Expected | Correct |
|---|---|---|---|---|
| 1 | Zero prior · numeric-SELECTED query | no match | no match | ✅ |
| 2 | Single prior · numeric-SELECTED query · min_support=2 | no match (below threshold) | no match | ✅ |
| 3 | 3 numeric-SELECTED priors under `src/lib/*` · exact query | match · kind=exact · support=3 | match=exact, support=3 | ✅ |
| 3b | Same 3 priors · query with `path_dir_second="app"` · deliberately different | match · kind=relaxed_second_dir | relaxed | ✅ |
| 4 | Same 3 priors · query with `has_signature_format=false, value_type=other, path_dir_root=docs, selection_state=TIE` | no match | no match | ✅ |
| 5 | 4 mixed priors (2 numeric-SELECTED src/lib + 1 TIE + 1 string-SELECTED docs) | numeric-SELECTED match · groups distinct | match + distinct groups | ✅ |
| 6 | Query for switch-shape features (`has_signature_format=false, value_type=other, selection_state=SELECTED`) | no match | no match | ✅ |

### Evidence
`data/nex1-discovery-experiments/test-b-abstraction-receipt.json` ·
Verdict field: `"VERIFIED"` · every case's `correct` field is `true`.

### Verification
- Independent adversarial cases (7 total) each carry an explicit
  `expected_match` and `correct` computation.
- Test cleans the Fix 17 store before each case to guarantee no state
  leak between cases.
- Seeds are structurally distinct (different `source_file` per experience)
  proving the pattern emerges from feature grouping, not from repeated
  entries of one file.

### Anti-Cheating Audit
- Fix 34 (`capability-experience-abstraction.ts`) contains no fixture
  names, no hardcoded expected answers, no test-only escape paths, no
  special-case conditionals.
- Feature dimensions are declared once in `SHAPE_FEATURE_DIMENSIONS` and
  applied uniformly. Adding a fixture name to the module would require
  changing that declaration, which any diff would expose immediately.
- The retrieval order (exact → relaxed_second_dir → relaxed_state) is a
  single fixed table; no per-query bias.
- `min_support` is a caller parameter; the retrieval function never
  favours particular patterns.
- Grep for fixture names in the module returns no matches.

### Result
**VERIFIED · 7 of 7 cases correct.**

### What This Proves
NEX1, via Fix 34, can:
1. Extract structural abstractions across multiple distinct source
   files that share a feature family (case 3: support=3 across 3 files).
2. Refuse when accumulated evidence is below the support threshold
   (case 2).
3. Refuse when no accumulated evidence exists (case 1).
4. Distinguish different families in adversarial mixes (case 5).
5. Correctly refuse for different-family queries (case 4).
6. Fall back to relaxed retrieval when the exact match fails on the
   second-directory dimension (case 3b).
7. Correctly refuse for a switch-shape query even with accumulated
   return-literal experience (case 6).

All results deterministic, all cases zero-LLM.

### What This Does NOT Prove
- That NEX1 can *invent* new operator classes from experience. Fix 34
  extracts recognition patterns; it does not synthesise repair operators.
- That NEX1 can solve a switch-branch problem. Test A's REFUSED_HONESTLY
  boundary still holds. Case 6 above corroborates this at the
  abstraction layer — the abstraction correctly refuses the switch query.
- That Fix 34 changes coding-loop behaviour at runtime. Fix 34 is
  loaded direct-module in Test B; it is not yet wired into
  `capability-chat-turn.ts`.
- Full autonomous native intelligence.

### Answer to the Founder's Central Question

> *"Can NEX1 discover something that was NOT explicitly programmed as
>  the answer to the new problem, validate that discovery, store it,
>  and later apply it successfully to a different situation?"*

Broken into the four verbs the founder wrote:

- **DISCOVER** — YES, at the recognition layer. Test B case 3 shows a
  support-3 pattern emerging from 3 unrelated source files with only
  their feature signatures in common. No line of code names "the answer."
- **VALIDATE** — YES, adversarially. Cases 4 and 6 prove the pattern is
  not applied to different-family problems, so the discovery is
  falsifiable, not always-fires.
- **STORE** — YES. Fix 17 store persists conclusions across sessions;
  Fix 34 reads from that store. Pattern records are recomputed
  deterministically, so no separate persistence step is required.
- **APPLY** — PARTIAL. The pattern *is* retrieved for a novel same-
  family problem (case 3b, relaxed retrieval succeeds). But "applying"
  in the sense of producing a code mutation for a shape family that
  currently has no operator (switch, Test A) is **not** demonstrated —
  and Test B case 6 corroborates that Fix 34 correctly refuses that
  application too.

**Honest verdict on the central question: PARTIAL YES.** NEX1
demonstrates cross-experience abstraction at the recognition and
distinction layer. Application beyond recognition (operator invention)
was not proven and, on current architecture, likely requires either
(a) explicit teacher input that adds a new operator, or (b) a
mechanism outside the zero-LLM constraint.

### Next Intelligence Target
Two distinct paths worth pursuing:
- **Path A · Failure-as-Learning (Experiment 2 in protocol)**: seed a
  FAILED conclusion (e.g. Test A's refusal receipt itself) into the Fix
  17 store, verify Fix 34 correctly extracts a "capability-gap" pattern
  distinct from success patterns, and verify NEX1 refuses future
  same-shape problems faster and more explicitly.
- **Path B · Conversational Memory (Experiment 5 in protocol)**: test
  whether NEX1 can maintain structured conversational state across 4+
  turns with reference resolution + partial-update. Existing
  ConversationHead + bindings + threads infrastructure is candidate
  substrate.

Path A is smaller and more falsifiable. Recommended next.

---

*End of Experiment 2 · continuing loop*

---

## Experiment 3 · TEST C · Cross-session persistence

### Question
The founder's amendment stated: *"we should then destroy/restart the session and test whether NEX1 can retrieve that learned knowledge later."* Does an abstraction learned in Session 1 survive a full process boundary and become available in Session 2 with only the Fix 17 JSONL file as the shared channel?

### Setup
Two independent Node scripts run as two separate processes:
- `test-c-cross-session-seed.mjs` (Session 1) · seeds 4 entries, computes pattern fingerprint, exits.
- `test-c-cross-session-retrieve.mjs` (Session 2) · fresh process, reads store, extracts patterns, compares fingerprint, runs adversarial retrievals.

The two processes share only:
- The Fix 17 JSONL file at `data/nex1-investigation-conclusions/entries.jsonl`
- The Session 1 receipt at `data/nex1-discovery-experiments/test-c-session-1-receipt.json` (used ONLY for fingerprint compare, not for pattern reconstruction)

### Prior Knowledge in NEX1
Fix 17 store · Fix 26 read · Fix 34 pattern extractor (from Test B) · same as before. No new modules.

### Novel Element
The falsification target: cross-session persistence. Previously untested.

### Mechanism
`extractPatterns(loadAllEntriesFromStore(REPO))` in both sessions. Deterministic. Zero LLM. Zero shared in-memory state between sessions.

### Observation
- Session 1 · patterns: 2 · fingerprint `1992e500406ca59ef59b1a03d425ab30`
- Session 2 · patterns: 2 · fingerprint `1992e500406ca59ef59b1a03d425ab30`
- `fingerprints_match: true`
- Same-family retrieval (`src/lib/*` · numeric · SELECTED): `matched: true · kind: exact · support: 3`
- Different-family retrieval (`src/lib/*` · other · SELECTED · no sig format): `matched: false`

### Evidence
- `data/nex1-discovery-experiments/test-c-session-1-receipt.json`
- `data/nex1-discovery-experiments/test-c-session-2-receipt.json`
- Verdict field of session-2 receipt: `"VERIFIED"`

### Verification
- Independent processes (two `npx tsx` invocations) — no shared JavaScript heap.
- Fingerprint is a SHA-256 of the JSON-serialised pattern set; identity implies byte-equal patterns after extraction.
- Adversarial cross-check: same-family match succeeds AND different-family refuses.

### Anti-Cheating Audit
- No in-memory cache is transferred between sessions.
- Session 2 does not import from Session 1's script; it only reads receipts for comparison, and the receipt contains no pattern payload usable to short-circuit Session 2's extraction.
- Fix 34 has no fixture-name conditionals (Test B audit still holds).

### Result
**VERIFIED.**

### What This Proves
Learned abstractions in NEX1 survive a session boundary. The founder's central question's *store → retrieve* step is empirically closed: a pattern discovered in Session 1 is recomputable and retrievable in a fresh Session 2 using only the on-disk store.

### What This Does NOT Prove
- That the retrieved abstraction affects a *runtime coding decision* — Fix 34 is still disconnected from `capability-chat-turn.ts`.
- That NEX1 can accumulate abstractions monotonically over many sessions (this was one-shot; no long-horizon test yet).
- That NEX1 can invent new operator classes.

### Next Intelligence Target
The remaining edge in the founder's central question is *APPLY to a different situation*. Two candidates:
- **Path α · Runtime wire-in** — attach Fix 34 retrieval to Fix 25 salience gate as informational trace. Small, safe, testable via direct-module. Confirms abstraction can bias observable output.
- **Path β · Monotonic learning** — run N iterations of (seed → extract → retrieve) and prove support counts grow monotonically as new same-family evidence arrives, and old patterns never silently vanish.

Path α is the more decisive test of the central question. Recommended next.

---

*End of Experiment 3 · continuing loop*

---

## Experiment 4 · TEST D · Monotonicity + Order-Independence

### Question
Two invariants that any real learning system must satisfy:
1. **Monotonicity** — as new same-family evidence arrives, the support count for that family's pattern must grow or stay equal, never shrink; new-family evidence must not collapse old patterns.
2. **Order-independence** — the extracted pattern set must be invariant under permutation of the input entries; the same evidence in a different order must yield the same abstraction.

Together these say: what NEX1 learned yesterday remains what NEX1 learned today, and the sequence of experiences does not distort the learning.

### Setup
Direct-module invocation of `capability-experience-abstraction.ts`. Five canonical entries (3 numeric-SELECTED under `src/lib/*` · 1 TIE · 1 string-SELECTED under `docs/`).

Part 1 · monotonicity: grow the store one entry at a time; measure `numeric-SELECTED-src/lib` support at each step.

Part 2 · order-independence: three deterministic permutations of the same five entries (using an LCG so the test is reproducible); compare pattern-set fingerprints.

### Mechanism
Same Fix 34 primitives (`extractPatterns`, `loadAllEntriesFromStore`). Fingerprint = SHA-256 of `JSON.stringify(patterns.map(p => ({id: p.pattern_id, s: p.support_count, f: p.features})))` truncated to 32 hex chars.

### Observation
- **Support growth:** `1 → 2 → 3 → 3 → 3` exactly as predicted. Monotone non-decreasing ✓. TIE and docs-string additions correctly did NOT affect the numeric-SELECTED-src/lib count.
- **Fingerprints under 3 permutations:** all three identical (`6b269a7afa688ffd3855827b0c4dd259`).

### Evidence
`data/nex1-discovery-experiments/test-d-monotonicity-and-order-receipt.json` · verdict field `"VERIFIED"`.

### Anti-Cheating Audit
- The five entries are the SAME entries reordered; permutation function is deterministic (LCG seeded 1, 2, 3).
- Fingerprint is a cryptographic hash of the pattern-set features + supports; identity implies byte-equal patterns.
- No fixture names in Fix 34 (still applies from Test B audit).

### Result
**VERIFIED.**

### What This Proves
Fix 34 extraction is:
1. Monotone under evidence accumulation.
2. Independent of entry order.

Combined with Test B (cross-source-file abstraction) and Test C (cross-session persistence), NEX1's learning machinery satisfies four foundational invariants: **discovery**, **persistence**, **monotonicity**, **order-independence**.

### What This Does NOT Prove
- APPLY-step at runtime is still open (Fix 34 not wired into `capability-chat-turn.ts`).
- Operator invention (extending capability library from experience) remains not proven and, on current architecture, likely requires either explicit teacher input or an LLM.
- Long-horizon accumulation across days (only tested with 5 entries).

### Next Intelligence Target
The single remaining unproven step in the founder's central question is APPLY. Direct next candidate:
- **Test E · Runtime-wired abstraction bias** — instrument the coding-loop to consult Fix 34 at plan entry. Measure whether the retrieved pattern appears in the coding-loop trace and whether it influences confidence/rationale. Must remain INFORMATIONAL (never authoritative), consistent with the R11-B rule. Requires either a working dev server or a direct-module `runSpecificationDrivenCodingLoop` invocation with Fix 34 pre-integrated in a controlled prototype.

---

## Cycle 1 · Consolidated Intelligence-Discovery Verdict

| # | Test | Capability | Result |
|---|---|---|---|
| A | Novel switch-branch | Truthful capability boundary · refusal, not fabrication | VERIFIED |
| B | Cross-source-file abstraction | Discovery of shared structure across ≥ 2 experiences under different filenames | VERIFIED (7/7 adversarial cases) |
| C | Cross-session persistence | Learned abstraction survives a fresh Node process boundary | VERIFIED |
| D | Monotonicity + order-independence | Learning does not shrink under new evidence · learning is permutation-invariant | VERIFIED |

**Cumulative claim (bounded, honest):** NEX1 demonstrates deterministic, zero-LLM, cross-experience, cross-session, monotone, order-invariant abstraction from accumulated experience — at the **recognition + persistence layer**. The **application layer** (turning a retrieved abstraction into an observable change in a runtime coding decision) remains unproven, and the **operator-invention layer** (generating a new repair operator for a genuinely novel shape family) remains unproven and out of reach for the current architecture without an LLM or explicit teacher input.

The founder's central question — *"Can NEX1 discover something that was NOT explicitly programmed as the answer to the new problem, validate that discovery, store it, and later apply it successfully to a different situation?"* — resolves as:

- DISCOVER ✅ · VALIDATE ✅ · STORE ✅ · APPLY 🟡 (retrieval works · runtime bias not proven · operator invention out of scope)

*End of Cycle 1 · Discovery loop pauses here. The blocker for closing APPLY is architectural (runtime wire-in requires either a working dev server or a direct-module coding-loop harness) and is not a scientific unknown — it is a plumbing task.*

---

## Cycle 2 · The hardest remaining question

## Experiment 5 · TEST E · Capability Discovery · **Can NEX1 discover and create a reusable capability that was not explicitly supplied by the developer?**

### Question
The founder's exact wording. Distinguishing carefully:
- **Strong sense** (inventing a new *algorithm* from scratch, at runtime, with no LLM): out of reach for zero-LLM architecture. Any algorithm must be authored by hand.
- **Weak sense** (inducing a new *rule / template / invariant* from evidence, storing it as a first-class capability, and reusing it on novel inputs): testable. This is what Test E measures.

### Setup
Fix 35 · `capability-capability-discovery.ts` implements an INDUCTION step over accumulated Fix 17 experience:
- For each pattern group (from Fix 34) with support ≥ min_support
- Run a fixed set of 6 declarative probes (`INDUCTION_PROBES`), each of which is a universal quantification over the supporting entries
- Any probe that holds becomes an `Invariant` on the emerging `DiscoveredRule`
- `rule_id` is a content-hash of `{shape_signature, invariants}`, so **different evidence produces a different rule_id automatically**
- Rules persist to `data/nex1-discovered-capabilities/rules.jsonl` (append-only)

Application step: given a NOVEL input's shape features, `predictFromRules` finds a matching rule and produces a `Prediction` derived from the rule's invariants.

Two-session · direct-module · zero LLM · deterministic.

### Prior Knowledge in NEX1
Fix 17 store · Fix 34 pattern extractor + `ShapeFeatures`. No prior induction machinery. No prior `DiscoveredRule` type. Fix 35 introduces this artifact.

### Novel Element
The RULE that emerges. Its `rule_id`, its specific invariant set, its predictions on new inputs — none of these exist in the source code before induction runs; all are computed from the evidence supplied.

### Mechanism
`induceRules(entries, min_support)` → for each pattern group, apply 6 probes universally → assemble `DiscoveredRule[]`. `predictFromRules(rules, input)` → find applicable rule, apply invariant-driven prediction.

Every probe is a pure function that returns `{holds: boolean, extra?: object}`. Universal quantification means: fires only when the property holds across ALL supporting entries. Any counter-example silently disables the probe.

### Observation
**Session 1 · seeded 3 successful experiences** under `src/lib/family/*` with `path::N` candidates (N ∈ {11, 22, 33}). Induction produced:
- **1 rule**, `rule_id: rule-0476695f90fd320b`
- `support_count: 3`
- 4 invariants held across all 3 entries: `has_double_colon_separator` · `prefix_equals_source_file` · `suffix_is_numeric` · `all_entries_share_path_prefix` (extra: `path_prefix: "src/lib/family"`)
- Rule persisted to `data/nex1-discovered-capabilities/rules.jsonl`.

**Application** (novel inputs, never seen at induction time):
| Case | Input | Expected | Actual | Correct |
|---|---|---|---|---|
| A | `src/lib/genuinely-novel/newone.ts::99` · SELECTED | rule fires · numeric prediction 99 | `value_from_selected_candidate_suffix` · value=`99` · type=`number` | ✅ |
| B | `docs/pages/anything.md::"hello"` · SELECTED | no_applicable_rule (different family) | `no_applicable_rule` | ✅ |
| C | `src/lib/family/whatever.ts::42` · **TIE** | no_applicable_rule (state mismatch) | `no_applicable_rule` | ✅ |
| D | `src/lib/family/whatever.ts` · `selected_candidate: null` | no_applicable_rule (no separator) | `no_applicable_rule` | ✅ |

**Adversarial · different-seed produces different rule:**
- Session 1 seed (numeric): `rule-0476695f90fd320b`
- Adversarial seed (quoted strings `path::"alpha"`, `path::"beta"`): `rule-b2044a2efb6ba920`
- Distinct → proves the rule is data-derived, not code-baked.

**Determinism:** running induction twice on the same store produced identical `rule_id` sequences.

**Empty store:** zero rules emitted.

### Evidence
- `data/nex1-discovery-experiments/test-e-capability-discovery-receipt.json` · verdict field `"VERIFIED"` · 8-cell `correctness_matrix` all `true`.
- `data/nex1-discovery-experiments/test-e-session-1-receipt.json` · records the seeded IDs + induced rule structure.
- Unit tests: `src/lib/nex-agent/code-engine/capability-capability-discovery.test.ts` · 17/17.
- Full regression: 28 test files · 2152/2152 tests pass.

### Anti-Cheating Audit
- **Fixture names in module:** zero (grep audit; the only matches are comments explicitly declaring "no fixture names").
- **Hardcoded expected answers in module:** zero (grep audit).
- **Zero LLM:** grep clean for OpenAI/Anthropic/Claude/Gemini/Groq/Ollama.
- **Rule identity content-addressed:** `rule_id = "rule-" + sha256({shape, invariants}).slice(0, 16)`. Different data → different id **automatically**.
- **Universal quantification:** every probe fires only when the property holds across ALL supporting entries, so cherry-picking is architecturally impossible.
- **Application uses only rule invariants + input:** the prediction is a deterministic function of the applicable rule's invariants and the caller-supplied input. No `if (input.source_file === "...")` in the module.

### Result
**VERIFIED.**

### Honest answer to the founder's question · *"Can NEX invent a new capability?"*
Split cleanly:

- **Algorithm invention** — NO. The induction algorithm (Fix 35) was authored by hand, deterministically. NEX1 does not invent new algorithms at runtime. This is a real limit of zero-LLM architecture.
- **Rule invention** — YES. The specific `DiscoveredRule` with `rule_id: rule-0476695f90fd320b`, its four induced invariants, and its predictions for novel inputs are ALL new to NEX1's state. None of them appear in the source code. All of them are derived from accumulated evidence. All of them are persisted as first-class capability records. All of them are applied correctly to inputs never seen at induction time. Adversarial seed → different rule_id proves the rule is genuinely data-derived, not code-baked.

**The precise statement supported by evidence:** NEX1 can discover, create, persist, and reuse new **inductive rules** derived from accumulated experience, without an LLM at runtime. NEX1 cannot invent new **algorithms** without an LLM.

### What This Proves
- NEX1's learning machinery is capable of producing genuinely new, reusable, first-class capability records from data.
- The distinction between "the algorithm I wrote" and "the specific rule NEX1 induced" is materially visible in the evidence (different data → different rule_id).
- Application of the discovered rule to novel inputs works with correct refusal on out-of-family cases.

### What This Does NOT Prove
- Algorithm invention (impossible for zero-LLM; already scoped honestly).
- That the discovered rule changes runtime coding-loop behaviour (still not wired into `capability-chat-turn.ts`).
- That NEX1 can invent NEW probes (`INDUCTION_PROBES` is a fixed hand-authored table; NEX1 does not extend it).
- That NEX1 can discover higher-order rules (rules over rules).

### Next Intelligence Target
Two candidates, both smaller and both incremental:
- **Test F · rule-consumer wire-in** — attach the discovered-rule prediction to Fix 25 salience gate as informational trace, verify observable output changes (finally closes the APPLY step end-to-end).
- **Test G · probe extensibility** — add one new `INDUCTION_PROBES` entry (e.g., "all supporting entries have `investigation_id` starting with the same short prefix") and verify Fix 35 uses it without any other change to the induction algorithm. Tests architectural extensibility, not data invention.

Test F is the more decisive closer of the founder's central question. Recommended next.

---

*End of Experiment 5 · Cycle 2 pauses here pending founder direction on next target.*

---

## Experiment 5b · TEST E ANTI-CHEATING AUDIT

### Founder challenge (verbatim)
> *"Did NEX1 actually discover the capability, or was the capability already encoded somewhere in the implementation/test fixture?"*

### Setup
Seven falsifiable audits, each designed to expose a distinct form of hidden encoding. Any FAIL falsifies the "Test E VERIFIED" claim. Direct-module · zero LLM · deterministic. Receipt: `data/nex1-discovery-experiments/test-e-anti-cheating-audit-receipt.json`.

### Results

| # | Audit | Result | What it rules out |
|---|---|---|---|
| 1 | Empty rules list · same input as Test E apply_A | PASS · `no_applicable_rule` returned | *"the module ignores rules and derives the answer from input alone"* |
| 2 | WRONG-family rules (docs+string) · numeric input | PASS · `no_applicable_rule` | *"the module fires on any rule regardless of family"* |
| 3 | Data-derived `path_prefix` extras · seed A (`src/lib/alpha`) vs seed B (`src/lib/beta`) | PASS · prefixes `src/lib/alpha` vs `src/lib/beta` (different) | *"the invariant extras are hardcoded"* |
| 4 | Invariant-dependent parsing · numeric-family rule vs string-family rule · same-shape inputs | PASS · numeric→`777` (number) · string→`"seven"` (string) | *"the module always emits the same parser regardless of the rule"* |
| 5 | Probe universality · contaminating string entry alongside numeric entries | PASS · numeric group's invariants remain clean; contaminant isolated into its own group | *"probes fire on non-uniform data"* |
| 6 | Content-addressed rule_id · same data twice vs different data | PASS · same data → same id · different data → different id | *"rule_id is a constant / template"* |
| 7 | Module grep for specific receipt values (rule_id `0476695f90fd320b`, seed path `src/lib/family`, adversarial id `b2044a2efb6ba920`, novel input path `genuinely-novel`) | PASS · zero hits | *"the answer is hardcoded in the source"* |

### Result
**VERDICT: `NO_CHEATING_DETECTED`.** All seven independent falsifiability tests pass. Any single failure would have invalidated the Test E claim; none did.

### What the audit actually proves
- The rule is **load-bearing**: absence of the rule (Audit 1) or wrong-family rules (Audit 2) produce refusal, not accidental prediction. The module cannot substitute for the rule.
- The rule is **data-derived**: identical data → identical rule (Audit 6 same-id); different data → different rule (Audit 6 different-id, Audit 3 different extras).
- The parsing is **invariant-conditioned**: the same syntactic input parses to `number 777` when the numeric-suffix invariant is present and to `string "seven"` when the string-suffix invariant is present (Audit 4).
- The **content** of the discovered capability is not in the source code (Audit 7 grep): the specific rule_ids, seed paths, and invariant extras that appear in Test E receipts appear ZERO times in `capability-capability-discovery.ts`.

### The remaining honest limit
This audit certifies that NEX1 **discovered the specific rule from the specific data** without hidden encoding. It does NOT extend to:
- Discovering new **algorithms** at runtime (still requires an LLM; still out of scope).
- Discovering new **probe kinds** at runtime (`INDUCTION_PROBES` is a fixed 6-entry table; NEX1 does not add to it).
- Applying the discovered rule to change runtime coding-loop decisions (still not wired into `capability-chat-turn.ts`).

### What we can now say precisely (and only this)
> *NEX1 has, without an LLM at runtime, deterministically induced a specific first-class capability record (`rule-0476695f90fd320b`) from three accumulated experiences, persisted it to disk, applied it to a novel input that was never named in any code or seed, and correctly refused inputs outside the induced family. Seven independent anti-cheating audits — testing load-bearing behaviour, data-derivation, invariant-conditioned parsing, universal quantification, content-addressed identity, and source-code integrity — all pass. The discovered capability is not the algorithm; the algorithm is authored. The discovered capability is the specific rule + invariant set + associated predictions produced by the algorithm from the data.*

That statement, and only that statement, is what the evidence supports at this milestone.

---

## Experiment 6 · TEST F · Runtime application of the discovered capability

### Question
Does a rule discovered by Fix 35 measurably bias observable **runtime** output when the runtime path consults it, while remaining strictly informational (never authoritative, never changing the coding-loop decision)?

Runs from the state preserved at `nex1-test-e-verified` tag → commit `3ddae26b`. All Test E receipts, hashes, and the rule `rule-0476695f90fd320b` remain locked in `docs/TEST-E-PRESERVATION.md` above the `----- LOCKED -----` fence.

### Setup
Direct-module invocation of `runChatTurn`. The Test F wire is a small insert inside `capability-chat-turn.ts` at the Fix 25 salience gate — right after the Fix 30B comparator trace — that loads discovered rules from disk and calls `predictFromRules`. Emits an INFORMATIONAL trace line only. Never authoritative. Never bypasses the operator library.

Two independent arms:
- **Arm A** · rules present · a novel same-family fixture NEX1 has never seen at induction time.
- **Arm B** · rules wiped · same fresh fixture, same message. Adversarial.

Both arms run with a fresh conversation head (`_resetAllConversations_TESTONLY`) to prevent state leakage.

### Prior Knowledge in NEX1
Fix 35 induction machinery (from Test E). Fix 25 salience gate (from earlier). No prior runtime consumer of discovered rules — that consumer is what Test F introduces.

### Novel Element (at runtime)
The `fix35 · discovery · rule_id=X · kind=Y · predicted_value=Z` trace line in the actual chat-turn output. Its rule_id and predicted_value are derived from data at runtime, not from any source-code constant.

### Mechanism
```
Fix 25 bridge.ok → Fix 30B comparator → NEW: Fix 35 discovery consultation
                                              (loadDiscoveredRules + predictFromRules)
                                          → beat("capability_discovery", "consulted")
                                          → trace.push("fix35 · discovery · ...")
                                        → existing Fix 25 promotion decision
                                          (unchanged · discovery does not gate it)
```

### Observation
Receipt: `data/nex1-discovery-experiments/test-f-runtime-bias-receipt.json`.

**Arm A · rules present:**
```
fix35 · discovery · rule_id=rule-db7815e90f301dce
                  · kind=value_from_selected_candidate_suffix
                  · predicted_value=55
                  · predicted_value_type=number
                  · rule_count=1
```
- state: `understood`
- Rule ID `rule-db7815e90f301dce` — different from Test E's `rule-0476695f90fd320b` because Test F's seeds live under `src/lib/train/*` instead of `src/lib/family/*`. Proves the rule is DATA-DERIVED, not baked to any specific commit.
- Predicted value `55` — matches the fresh fixture's assertion `expect(testFTarget()).toBe(55)`.

**Arm B · rules wiped:**
```
fix35 · discovery · rule_id=none · kind=no_applicable_rule · rule_count=0
```
- state: `understood`
- Correctly refuses when the rules store is empty.

### Evidence
- Receipt: `data/nex1-discovery-experiments/test-f-runtime-bias-receipt.json` · verdict `"VERIFIED"`.
- Correctness matrix: 4 of 4 cells true (`A_discovery_trace_fired`, `B_discovery_trace_fired_with_none`, `coding_outcome_unchanged_by_discovery`, `no_file_mutation_from_discovery`).
- Regression: 28 test files · 2152/2152 tests pass.
- Grep audit: the specific rule_id `db7815e90f301dce` and the specific predicted value `predicted_value=55` appear ZERO times in `capability-chat-turn.ts`. The trace is dynamic, not string-constant.

### Anti-Cheating Audit
- **Load-bearing:** Arm B (rules wiped) produces `rule_id=none · kind=no_applicable_rule`. Without rules on disk, no prediction fires. Discovery is not synthesising output from thin air.
- **Data-derived rule_id:** the Arm A rule_id is `rule-db7815e90f301dce`, produced from Test F's training seeds (`src/lib/train/*`). This is a DIFFERENT id from Test E's `rule-0476695f90fd320b` (which came from `src/lib/family/*` seeds). Same code, different data, different rule_id.
- **Informational only:** both arms produced `state: understood`; discovery does not change the coding-loop decision. R11-B preserved.
- **No hidden encoding:** grep for the Arm-A specific rule_id and predicted value in `capability-chat-turn.ts` returns zero.

### Result
**VERIFIED.**

### What This Proves
The discovered capability from Test E has now been demonstrated to **influence observable runtime output** in NEX1's actual chat-turn path when a matching input arrives. The influence is limited to informational trace (as constitutionally required) but it is real, load-bearing, and correctly refuses when no matching rule exists.

### What This Does NOT Prove
- That the discovery changes coding-loop DECISIONS (correct — it must not, by design).
- That NEX1 can now solve novel operator families (Fix 20/23a operator library is unchanged; Test A's `REFUSED_HONESTLY` for switch-branch shape still holds).
- That the discovery is used in production HTTP path (Test F was direct-module; the wire is identical, but HTTP integration remains contingent on a working dev server).

### Cumulative status of the founder's central question after Test F

| Step | Status | Evidence |
|---|---|---|
| **DISCOVER** | ✅ | Test E · rule `rule-0476695f90fd320b` induced from 3 unrelated source files |
| **VALIDATE** | ✅ | Test E anti-cheating audit · 7 of 7 falsifiability audits pass · verdict `NO_CHEATING_DETECTED` |
| **STORE** | ✅ | `data/nex1-discovered-capabilities/rules.jsonl` · Test C proved cross-session persistence for the same mechanism family |
| **APPLY to a different situation** | ✅ | Test F · rule `rule-db7815e90f301dce` induced from separate training data, consulted in the actual `runChatTurn` runtime path, produced correct data-derived prediction `55` for a novel fixture NEX1 had never seen |

**The central question is now closed at recognition + persistence + informational-application layer with zero-LLM, deterministic, adversarially-audited runtime evidence.** Everything beyond that — operator invention, algorithmic self-modification, general autonomy — is explicitly not proven and remains scoped as future scientific unknowns.

### Next Intelligence Target
Genuine open frontiers, in order of scientific value:
- **Test G · language variation** — can NEX1 recognise the same underlying request across paraphrased surface forms (protocol Experiment 4)? Needs new deterministic paraphrase-similarity module.
- **Test H · conversational memory across 4+ turns** — reference resolution + partial update (protocol Experiment 5). Existing ConversationHead infrastructure is candidate substrate.
- **Test I · failure-as-learning** — track when a proposed fix fails preservation-check or vitest, persist a "capability gap" record, verify NEX1 refuses more explicitly on the next same-shape input (protocol Experiment 2).

Test H is arguably the most decisive next test for NEX1's chat capability. Test I is the most scientifically important for closing the learning loop with negative examples.

---

*End of Cycle 2 · six experiments verified · founder's central question closed at the honest boundary.*
