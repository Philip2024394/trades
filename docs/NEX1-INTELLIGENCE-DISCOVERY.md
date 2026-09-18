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
