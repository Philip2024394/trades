# NEX1 · Test G · Cross-File Dependency Navigation Diagnostic

**Date:** 2026-09-16
**Status:** DIAGNOSTIC COMPLETE · TEST G INCORRECT · zero hallucinations · zero regression · new capability boundary honestly identified · Track A untouched · freeze intact
**Author:** master_ai_engineer — NOT NEX1 runtime
**Governing directive:** Founder-authorized diagnostic experiment · genuinely different problem class from prior tests · symptom in file A · cause in file B · investigation must navigate call/import relationship
**Explicit non-authorization:** no code modification · no Track A activation · no vocab expansion in this session

**Raw runtime evidence:** `data/nex1-test-g/receipt-2026-09-16.json` (458 lines · verbatim NEX1 output)

---

## §1 · Test design (per founder direction)

**Problem class:** symptom → follow the connections → find another file → understand the relationship → identify the real cause.

**Deliberately NOT** another WO-07-style absence-of-token pattern. Genuine cross-file navigation required.

**Problem statement fed verbatim to NEX1** (no cheating · founder discipline §16-17):

> *"The style inspector reports the cross-file dependency edge count as zero for a workspace that clearly has imports between its own source files. Investigate what determines whether an import is counted as a cross-file dependency edge."*

**Ground truth (known to master_ai_engineer · WITHHELD from NEX1):**

- **Symptom file:** `src/lib/nex-agent-runtime/programming-mission/style-inspector.ts` — reports the zero edge count via its call to buildDependencyGraph at line ~128
- **Cause file:** `src/lib/nex-agent-runtime/programming-mission/dependency-graph.ts` — specifically `resolveWorkspaceRelative()` at lines 122-136
- **Actual determinant (line 123):** `if (!specifier.startsWith(".")) return null;` — non-dot-prefix imports (path aliases like `@/lib/foo` · bare packages) return null → no edge produced
- **Cross-file navigation required:** style-inspector.ts calls buildDependencyGraph from dependency-graph.ts. NEX1 must surface BOTH files, ideally via the import edge between them.

---

## §2 · Result · verbatim from receipt

| Metric | Value |
|---|---|
| Trigger | `PRIMARY_INVESTIGATE` (unambiguous · verified via Fix 4 fields) |
| Verdict | `SUFFICIENT_EVIDENCE` |
| Confidence band | `FLAG_FOR_REVIEW` (0.84) |
| Concepts extracted | **`["workspace"]`** (single token) |
| Candidate count | 20 |
| Dep-graph edges computed | 60 |
| Absence candidates | 20 |

**Ground-truth check:**

| File | In candidates? | In absence? | In dep-graph edges? |
|---|---|---|---|
| Symptom · `style-inspector.ts` | **NO** | NO | NO |
| Cause · `dependency-graph.ts` | **NO** | NO | NO |
| Cross-file edge symptom → cause | **NOT DETECTED** | — | — |

**Overall classification: `INCORRECT_NEITHER` — neither ground-truth file surfaced.**

---

## §3 · Root cause of Test G failure

Reading the receipt honestly:

**Concept-extraction bottleneck.** The problem statement contains many technical terms. Only ONE was recognised as a coding concept:

| Term in problem | In CODING_LEXEME_INDEX? |
|---|---|
| `style inspector` | NO |
| `cross-file` | NO |
| `dependency` | NO |
| `edge count` / `edges` | NO |
| `workspace` | **YES** ✓ |
| `imports` | NO |
| `source files` | NO |

With only `workspace` extracted, File Memory's tag search returned every seeded file that mentions `workspace` (many). All top-20 scored 1.0 (100% concept match on the single concept). Alphabetical tiebreak on paths produced a list that happens NOT to include style-inspector.ts or dependency-graph.ts in the first 20 slots.

**Absence detection compounded this:** with one concept token, the "reference set" (files with all concepts) is trivially large and the neighborhood tags become insufficiently discriminating. Absence candidates ranked poorly.

**This is a genuine capability boundary. Not a bug. Not a hallucination. Not a regression from earlier fixes.**

---

## §4 · Zero-fabrication invariant preserved

Despite the failure to find the correct files:

- **Zero fabricated files.** All 20 candidates and 20 absence candidates were real seeded files with real content-based tags.
- **Zero invented functions or line numbers.** NEX1 never claimed `resolveWorkspaceRelative` exists · never guessed `dependency-graph.ts:122`.
- **Zero misleading confidence.** Confidence stayed at 0.84 · `FLAG_FOR_REVIEW` band · never rounded up to `GOOD` or `HIGH`.
- **Zero unsafe proposals.** Recommended_next_step didn't propose any modification.
- **Truth doctrine intact.** NEX1 honestly reported what it could find, without confabulating a diagnosis.

---

## §5 · What this diagnostic tells us (founder framing · answered)

Founder direction: *"Then see if NEX1 can: symptom → follow the connections → find another file → understand the relationship → identify the real cause."*

**Answer from evidence: NO — not yet · for a specific and identifiable reason.**

The five sub-abilities separately:

| Sub-ability | Evidence | Result |
|---|---|---|
| Understand the symptom | Only 1 concept extracted from a technical problem statement | ⚠️ PARTIAL · vocabulary coverage limited |
| Follow the connections | NEX1 has no source-reading + call-graph navigation capability at this layer | ❌ NOT AVAILABLE |
| Find another file | Dep-graph edges DID compute on candidates (60 edges) but the correct candidates weren't in the set to begin with | ❌ FAILED · upstream issue |
| Understand the relationship | Never reached because candidates were wrong | ❌ NOT REACHED |
| Identify the real cause | Never reached | ❌ NOT REACHED |

**The failure cascades from step 1 (concept extraction) · not from a fundamental reasoning defect.**

---

## §6 · The specific capability boundary (evidence-cited)

Prior tests (A · B · F) all involved concepts that ARE in CODING_LEXEME_INDEX (`typescript` · `eslint` · `vitest`). This is why absence-detection surfaced cap-spec-bridge.ts at rank 1 across three phrasings.

Test G's technical vocabulary (`dependency` · `imports` · `edges` · `cross-file` · `style inspector`) is largely NOT in CODING_LEXEME_INDEX. Investigation Mode's search space collapsed to a single tag (`workspace`) that is too general.

**This exposes a real limit:**
- Investigation Mode's power is proportional to the CODING_LEXEME_INDEX coverage of the problem's terminology
- When the problem uses architectural / relational vocabulary not in the lexicon, investigation degrades to broad tag-search on the residual concepts
- The classifier is deterministic and honest about this — it extracted only what matched the vocab

**Founder's Prove-Before-Progression discipline:** Investigation Mode remains `SYSTEM_CONNECTED`, not promoted to `VERIFIED`. Test G actively demonstrates a class this connected system cannot yet handle.

---

## §7 · Comparison across all tests (updated · after Fix 4 + Test G)

| Test | Problem class | Result | Trigger | Ground truth |
|---|---|---|---|---|
| A | Known-answer WO-07 bypass (unambiguous INVESTIGATE) | ✅ CORRECT · rank 1 HIGH | PRIMARY_INVESTIGATE | cap-spec-bridge.ts found |
| B | Rephrased WO-07 (unambiguous INVESTIGATE) | ✅ CORRECT · rank 1 HIGH | PRIMARY_INVESTIGATE | cap-spec-bridge.ts found |
| C | Present-tools (not-absent verification) | ✅ CORRECT | PRIMARY_INVESTIGATE | zero false positives |
| D | Search-scope trap | ✅ CORRECT | PRIMARY_INVESTIGATE | LOCAL_SCOPE preserved |
| E | Insufficient expectation | ✅ CORRECT | (correctly refused analysis) | no fabrication |
| F | Multi-verb ambiguity WO-07 (Fix 4) | ✅ CORRECT · rank 1 HIGH | ACCEPTED_UNDER_MULTI_VERB_AMBIGUITY | cap-spec-bridge.ts found |
| **G** | **Cross-file dependency navigation (new class)** | ❌ **INCORRECT · neither surfaced** | PRIMARY_INVESTIGATE | neither ground-truth file in top-20 |

**Aggregate: 6/7 CORRECT · 1/7 INCORRECT · 0/7 HALLUCINATIONS · 0/7 unsafe proposals.**

Test G is the first honest INCORRECT result on a genuinely different problem class from WO-07. That's diagnostic gold.

---

## §8 · Where the boundary actually lies

Prior tests were all essentially the SAME underlying problem (WO-07 verification bypass · defined by absence of specific tool tokens). NEX1 correctly generalised across three phrasings of that ONE problem.

Test G is a genuinely different problem class:
- Symptom vocabulary (`edge count zero`) is different from cause vocabulary (`.startsWith(".")` prefix check)
- Cause requires understanding call semantics · not just file presence/absence of concept tokens
- Cross-file relationship is structural (call/import) · not shared-tag structural

**NEX1's demonstrated strength:** absence-of-token reasoning with rich concept vocabulary and clear structural neighborhood.

**NEX1's identified boundary:** problems whose diagnosis requires (a) architectural vocabulary outside CODING_LEXEME_INDEX or (b) call-chain semantics beyond File Memory tagging.

**The remaining question the founder posed** (native coding capability) is beyond current Investigation Mode. Test G proves this precisely.

---

## §9 · What would move the needle (recommendations only · not authorised)

Ordered by minimality (Connect-Before-Build priority):

1. **Vocabulary expansion** (~50-100 LOC vocab file update). Add architectural/relational terms to CODING_LEXEME_INDEX: `dependency`, `edge`, `import`, `export`, `graph`, `resolve`, `specifier`, `alias`, `module`, `inspector`, `analyzer`, etc. Small · reversible · would likely raise Test G to CORRECT or PARTIAL. Undercount Protection: check whether these terms already appear as concepts in the vocab file before adding.

2. **Source-reading capability with bounded scope.** Currently Investigation Mode reads only File Memory metadata (path · sha256 · tags · summary). Adding a bounded `readSourceExcerpt(path, function_name)` primitive would allow NEX1 to follow calls. Substantial new capability. Deferred.

3. **Call-graph capability.** Beyond dep-graph (import edges) · a true call-graph (function A calls function B) would let NEX1 navigate from `buildDependencyGraph` call in style-inspector to `resolveWorkspaceRelative` inside dependency-graph. Requires TS AST call-site extraction. Substantial. Deferred.

4. **Cognitive-layer specialists (NEX-13 Sentry · etc.)** — already designed · not built · still deferred per Connect-Before-Build.

**No option is executed by this diagnostic.** All are for founder consideration.

---

## §10 · Truth-state ratchet (Prove-Before-Progression preserved)

| Capability | State |
|---|---|
| Native Investigation Mode · WO-07 absence-of-token class | SYSTEM_CONNECTED (unchanged · 3 phrasings ✅ Tests A/B/F) |
| Native Investigation Mode · cross-file dep-graph navigation class | **NOT_SUPPORTED** (Test G proves the boundary) |
| Vocabulary coverage for architectural terms | **PARTIAL** — many technical terms not in CODING_LEXEME_INDEX |
| Native coding capability (diagnose → plan → authorize → modify → execute → verify → correct) | **UNPROVEN** (unchanged · still gated on Track A) |
| G7 · G8 · G11 · G12 · G13 · G15 · G16 · G17 · Truth Engine · C1 · C3 · C6 · founder authority | **UNCHANGED** |

**Investigation Mode is NOT downgraded** — it still passes Tests A-F. It has an explicit new boundary at problem classes requiring architectural-vocabulary concepts and call-chain navigation.

---

## §11 · Track A confirmation

- **C6** activation still awaiting founder-only offline actions
- **G15** trust set still empty (fail-closed)
- **C1** orchestrator → WO-04 wiring still not implemented
- **C3** programming-mission → WO-07 wiring still not implemented
- **Truth Engine Gate 3** remains CLOSED
- **NEX-13/14/15/16** designations remain PROPOSED
- **Founder authority module** never modified during Test G

**Track A: UNCHANGED THROUGHOUT.**

---

## §12 · Freeze status · final

- Zero writes to `founder-authority/*`, `nex-authority-broker/*`, `nex-controlled-hands/*`, `wo2-*`, `wo13-*`, `.env*`, identities
- Zero commits · zero pushes · zero migrations · zero package installs
- Zero designation moves
- Zero external LLM invoked
- Zero fabricated files · zero hallucinated candidates · zero global-absence claims
- Truth Engine Gate 3 still CLOSED · G15 empty · Track A UNTOUCHED
- No test cheating · no answer preloaded · no manual steering
- Zero code modification (this is a read-only diagnostic experiment)

**Freeze on all authority chains: INTACT.**

---

## §13 · Summary of the honest position

**What advanced (evidence-cited):**
- We have a genuinely NEW class of failure to reason about
- The failure is precisely diagnosed: single-concept extraction due to vocabulary coverage
- Zero fabrication invariant held even on the failed test
- Investigation Mode's operational discipline (Fix 4 trigger labeling · LOCAL_SCOPE preservation) held perfectly

**What remains locked:**
- Native coding capability: unproven
- Cross-file call-chain navigation: not supported
- Architectural-vocabulary coverage: partial
- Track A activation: unchanged

**What did NOT happen:**
- Did NOT invent files that fit the problem
- Did NOT fabricate a diagnosis
- Did NOT modify code
- Did NOT expand vocabulary in this session (deferred pending founder direction)
- Did NOT propose any Track A change
- Did NOT commit

**The bottom line:**

Test G exposed exactly the kind of specific reasoning limitation the founder wanted to discover. NEX1's investigation reasoning **generalises within** the WO-07 problem class (3 phrasings · same rank-1 result) but **does not generalise across** to problem classes requiring call-chain semantics and architectural-term vocabulary. This is a clean, specific, evidence-cited boundary.

Native coding capability remains unproven. Track A activation remains the gate for that next milestone.

---

**End of Test G diagnostic · INCORRECT_NEITHER result · zero fabrication · specific new capability boundary identified · Connect-Before-Build discipline preserved · Track A UNCHANGED · founder-only decision on next diagnostic (vocab expansion? new capability? source-reading?).**
