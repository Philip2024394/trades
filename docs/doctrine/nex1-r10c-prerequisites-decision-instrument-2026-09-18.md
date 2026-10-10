# NEX1 · R10-C Prerequisites · Founder Decision Instrument

**Date:** 2026-09-18
**Author:** master_ai_engineer (Claude Opus 4.7) · decision-preparation only
**Status:** `R10-C_PREREQUISITES_DECISION_INSTRUMENT · PENDING_FOUNDER_INPUT`
**Precedent:** matches the same 19-decision discipline used to author Q7 V1 and Q8 V1.

**Scope statement (mandatory):**

> *This instrument does not decide the four prerequisites. It explains them so the founder can decide. No option is recommended, ranked, or inferred. No policy is amended. No code is written. No implementation occurs.*

**Current confirmed state:**

```
R10 = R10-C · FOUNDER CONFIRMED
R11 = R11-B · FOUNDER CONFIRMED

R10-C-1 = UNDECIDED (this document · Decision 1)
R10-C-2 = UNDECIDED (this document · Decision 2)
R10-C-3 = UNDECIDED (this document · Decision 3)
R10-C-4 = UNDECIDED (this document · Decision 4)

Q8_V2_OPERATIONAL_POLICY = PENDING_CORRECTION
FIX24 = NOT_IMPLEMENTED
AUTONOMOUS_EXECUTION = NOT_AUTHORIZED
```

**Constitutional invariants preserved throughout (unchanged):**

- `MEMORY = EVIDENCE · MEMORY ≠ AUTHORITY`
- `MEMORY SHOULD INFORM INVESTIGATION, NOT REPLACE INVESTIGATION`
- `REMEMBER ≠ UNDERSTAND ≠ PROVE ≠ SELECT ≠ MODIFY ≠ EXECUTE ≠ AUTHORIZED`
- `SELECTED ≠ MODIFIED ≠ EXECUTED ≠ VERIFIED ≠ AUTHORIZED`
- `R11-B: RETRIEVED_PRIOR_SUCCESS may guide investigation but MUST NOT contribute to R-4 SUPPORTING count`

---

## §1 · WHAT R10-C IS ASKING FOUR QUESTIONS ABOUT

R10-C (founder-confirmed) says: *a previous experience must not be treated as applicable to a current problem merely because the historical experience looks similar. The current problem must be investigated and materially relevant differences must be respected.*

To make that operational, four things need explicit definition:

1. **R10-C-1 · Material Difference** — what does "materially different" mean? When is a new problem different enough from an old one that the old failure record doesn't apply?
2. **R10-C-2 · Fresh Evidence** — what counts as fresh evidence? (R11-B already excludes memory from the SUPPORTING count; but "fresh" itself has to be defined.)
3. **R10-C-3 · Fix 23b Tracer Requirement** — exactly what must Fix 23b establish before a retrieved experience can be treated as relevant? What can and can't Fix 23b prove today?
4. **R10-C-4 · Anti-Circularity** — how do we prevent memory-guided investigation from becoming a self-confirming loop where NEX1 only looks for evidence that confirms its memory?

---

## §2 · DECISION 1 · R10-C-1 · WHAT IS "MATERIALLY DIFFERENT"?

### The problem in plain words

Two problems can look alike on the surface but be different underneath. We have to say **what kind of "underneath"** matters. Otherwise every rule that uses the phrase "materially different" is not falsifiable and NEX1 can quietly slide toward wrong reuse.

### Models

#### Model A · Structural difference

A new problem is materially different from a stored one when **structural** properties differ.

- What it catches: different function; different target line; different call chain; different parameter shape; different AST shape (return-expression tree, control-flow shape).
- What it misses: same-shape code with different semantic role (a `100` that was price is now count); same code, different intent.
- **False rejection risk:** LOW — structural differences are rarely spurious.
- **False acceptance risk:** HIGH — structurally identical code can mean different things.
- **Can Fix 23b detect it?** YES — Fix 23b is a structural + arithmetic tracer within its bounded domain (§8).
- **Fresh evidence required?** NO — the tracer's own output is structural evidence.
- **Deterministic test?** YES.

#### Model B · Semantic difference

A new problem is materially different when the **meaning or role** of the code has changed.

- What it catches: same literal, different domain (price → count); same shape, different semantic role.
- What it misses: cases where the semantic role has stayed the same but implementation changed.
- **False rejection risk:** MEDIUM — depends on how tightly "semantic role" is defined.
- **False acceptance risk:** LOW — if the semantic role differs, memory should not apply.
- **Can Fix 23b detect it?** **NO — see §8.** Fix 23b operates on arithmetic + AST structure. It does not have a semantic-role model. Detecting "the variable's meaning has changed" would require a mechanism that does not currently exist in NEX1.
- **Fresh evidence required?** YES — semantic role must be established from current source (identifier names, comments, type annotations, or an authored semantic-role registry — none of which currently exists as a machine-checkable input).
- **Deterministic test?** ONLY if the semantic-role source is itself deterministic and structured. Free-text identifiers or comments are not deterministic.

#### Model C · Behavioural difference

A new problem is materially different when the **observed or required behaviour** of the code differs.

- What it catches: same code, different expected outputs across test suites; same shape, different acceptance criteria in sibling tests.
- What it misses: cases where behavioural specs happen to match but the underlying problem differs; cases where sibling tests are missing.
- **False rejection risk:** MEDIUM — behavioural difference is only visible when tests exist.
- **False acceptance risk:** MEDIUM — tests can pass for wrong reasons.
- **Can Fix 23b detect it?** PARTIAL — Fix 23b evaluates one function with args → expected value. Broader behavioural comparison is not in scope of Fix 23b alone.
- **Fresh evidence required?** YES — sibling test suite + observed runtime behaviour on current source.
- **Deterministic test?** YES if the reference behaviour is derivable from a fixed test suite; NO if it depends on flaky runtime evidence.

#### Model D · Composite difference

A new problem is materially different when one or more explicitly-defined dimensions differ enough to invalidate reuse. Composite = a rule stack: structural + semantic + behavioural + contextual + verification, each with its own explicit threshold and detection method.

- What it catches: multiple types of divergence simultaneously.
- What it misses: nothing single-dimensional catches — but at the cost of complexity.
- **False rejection risk:** MEDIUM — additive thresholds can compound.
- **False acceptance risk:** LOW — requires all dimensions to align.
- **Can Fix 23b detect it?** PARTIAL — Fix 23b covers structural + partial behavioural. Semantic dimension requires a mechanism not present today.
- **Fresh evidence required?** YES on every non-structural dimension.
- **Deterministic test?** ONLY if every dimension is itself deterministic and its threshold is explicit.

---

## §3 · ADVERSARIAL CASES FOR MATERIAL DIFFERENCE

For each case: what does each model say?

### Case A · Exact same problem

- Historical: `pricing.ts` returned `100`. Fixed to `120`. Verified SUCCESS.
- Current: `pricing.ts`, same function, same semantic role, returns `100`.

| Model | Verdict |
|---|---|
| A (Structural) | **NOT materially different** — structures align. Historical experience considered relevant. |
| B (Semantic) | **NOT materially different** — semantic role unchanged. Relevant. |
| C (Behavioural) | **NOT materially different** — sibling tests remain green. Relevant. |
| D (Composite) | **NOT materially different** on all dimensions. Relevant. |

All four models agree.

### Case B · Same shape, different meaning

- Historical: `pricing.ts` returned `100` representing "price."
- Current: `pricing.ts`, same function name, returns `100` — but the developer has since re-purposed the field as "customer count."

| Model | Verdict |
|---|---|
| A (Structural) | **NOT materially different** — structure unchanged. Model A would consider historical experience relevant. **This is a false acceptance risk.** |
| B (Semantic) | **Materially different** — role changed. Model B would reject reuse. **Requires a semantic-role signal not currently available in the schema.** |
| C (Behavioural) | **Potentially materially different** — if sibling tests were updated to check "count" behaviour, yes. If tests still pass for the old "price" behaviour, no. |
| D (Composite) | **Materially different** if ANY dimension flags. **Semantic dimension flags requires §8 limit acknowledgment.** |

Models A and B diverge sharply here.

### Case C · Same meaning, different implementation

- Historical: `pricing.ts` returned `100`. Function used `return literal`.
- Current: same semantic role ("price"), but function has been refactored — now uses `return lookup(config)`, no direct literal.

| Model | Verdict |
|---|---|
| A (Structural) | **Materially different** — return shape changed. Model A would reject reuse. **This is a false rejection risk** if the fix pattern still applies at a different location. |
| B (Semantic) | **NOT materially different** — semantic role unchanged. Model B would allow reuse. |
| C (Behavioural) | **NOT materially different** — same expected outputs. |
| D (Composite) | **Depends on threshold** — structural differs, semantic + behavioural align. Composite outcome depends on which dimension is weighted. |

Models A and B diverge again.

### Case D · Same file, different target

- Historical: `pricing.ts` returned `100` at line 19.
- Current: `pricing.ts`, similar shape, but the pattern of concern is now at line 47 (different function in same file).

| Model | Verdict |
|---|---|
| A (Structural) | **Materially different** — different function. Model A rejects reuse. |
| B (Semantic) | **Materially different** if the function's semantic role differs; **not materially different** if the same role exists in a different function. Ambiguous without semantic-role tagging. |
| C (Behavioural) | **Materially different** — different function has different sibling tests. |
| D (Composite) | **Materially different** — structural + behavioural both flag. |

Three models agree; Model B is ambiguous.

### Case E · Nearly identical problem with one important contextual difference

- Historical: `pricing.ts` returned `100`. Called from checkout flow.
- Current: `pricing.ts`, same function, returns `100`. Now called from a batch reprocessing flow with different invariants.

| Model | Verdict |
|---|---|
| A (Structural) | **NOT materially different** — function structure identical. **False acceptance risk** — caller context matters. |
| B (Semantic) | **Depends** on whether "semantic role" includes caller context. |
| C (Behavioural) | **Materially different** if the new caller has different behavioural invariants; requires call-site analysis. |
| D (Composite) | **Materially different** if caller-context is a defined dimension. |

Model A does not handle call-site context.

---

## §4 · DECISION 2 · R10-C-2 · WHAT COUNTS AS "FRESH EVIDENCE"?

### The problem in plain words

R11-B says memory cannot vote. But NEX1 still needs to know **what a valid vote looks like**. If "fresh evidence" is undefined, memory could smuggle itself back into the SUPPORTING count by generating hypotheses that fresh investigation dutifully confirms.

### Models

#### Model A · Newly generated structural evidence

Evidence generated from the current source by ACTIONs 1-10 (structural facts extractor, source inspection, observed chains). Includes: function signatures, AST facts, variable declarations, chain relationships.

- **Deterministic?** YES.
- **Independent from memory?** PARTIAL — the extractor is deterministic, but the *choice of what to extract* may have been guided by memory. See §5 double-counting test.
- **Can be tested?** YES via ACTION output.

#### Model B · Newly generated structural + semantic evidence

Model A + semantic classification (Capability A intent, negation-polarity, conversational-function classifications applied to current context).

- **Deterministic?** YES — classifiers are deterministic.
- **Independent from memory?** PARTIAL — same caveat as Model A.
- **Can be tested?** YES via classifier output.

#### Model C · Newly generated independent verification evidence

Evidence must come from a source that was *not selected because of memory*. Requires an explicit provenance tag distinguishing "found via memory-guided path" from "found via fresh investigation path."

- **Deterministic?** YES if provenance tagging is well-defined.
- **Independent from memory?** YES by construction.
- **Can be tested?** YES if every evidence item carries `discovery_source: "fresh" | "memory_guided"`.

#### Model D · Composite definition

Fresh evidence must satisfy ALL of: (1) generated in the current investigation packet; (2) traceable to a current source, not a stored record; (3) `discovery_source == "fresh"`; (4) not produced from a hypothesis that was itself generated by retrieval.

- **Deterministic?** YES if every criterion has a machine-checkable predicate.
- **Independent from memory?** YES by definition.
- **Can be tested?** YES with sufficient packet instrumentation.

---

## §5 · DOUBLE-COUNTING TEST

The core problem: **can evidence generated because of memory still be called independent?**

### Example 1 · Memory tells NEX1 exactly where to look

- Memory: *"line 19 of pricing.ts had a bug like this"*
- NEX1 inspects line 19. Finds the pattern.
- **Is this fresh evidence?** Under Model A: yes (it's structural extraction). Under Model C: **no** — the discovery was memory-guided. Under Model D: no.

### Example 2 · Memory suggests a hypothesis · current source independently confirms it

- Memory: *"return-literal fixes worked before"*
- NEX1's ACTIONs 1-10 independently identify a return-literal pattern in the current source, alongside other patterns.
- **Is this fresh evidence?** Under Model A: yes. Under Model C: **partial** — depends on whether NEX1 pursued only the memory-suggested hypothesis or evaluated all hypotheses equally.

### Example 3 · Memory predicts the exact answer · NEX1 only searches for confirming evidence

- Memory: *"the fix is to change literal from 100 to 120"*
- NEX1 searches only for evidence supporting the change 100 → 120. Does not investigate whether the current problem might require a completely different change (e.g., a null check, a type coercion).
- **Is this fresh evidence?** Under Model A: yes (structurally). Under Model C: **no** — the investigation was memory-scoped. Under Model D: no (fails criterion 4).

**The difference between examples matters.** Model A can be satisfied in all three. Models C and D catch cases 1 and 3. This is not a recommendation — it is a discriminating property founders should weigh when choosing.

---

## §6 · DECISION 3 · R10-C-3 · WHAT MUST FIX 23b PROVE?

### The problem in plain words

Fix 23b is the machinery that can tell whether an old fix and a new problem produce the same target. But saying "same target" is not the same as saying "same problem." We must decide exactly what Fix 23b's tracer output permits.

### Options

#### Option A · Target line + expected outcome

Fix 23b MATCH iff the tracer identifies the same relative target_line and the tracer's expected_field_value matches.

- **What it proves:** the current source has a literal at the same location whose modification would produce the same numeric result.
- **What it does NOT prove:** that the literal represents the same semantic role; that the fix is appropriate for the new context.
- **False-match risk:** HIGH — Case B (same shape, different meaning) MATCHes.
- **False-rejection risk:** LOW.
- **Relationship to R10-C-1:** insufficient — does not detect semantic difference.
- **Relationship to R11-B:** compatible — output is evidence, not authority.
- **Relationship to Test C (adversarial near-miss):** **FAILS** — surface-matched but semantically-different candidates would MATCH.

#### Option B · Target + expected outcome + proposed literal

Option A + tracer must produce the exact same `literal_proposed_text` as stored in the historical experience.

- **What it proves:** additionally, that the same replacement value would achieve the target outcome.
- **What it does NOT prove:** semantic role equivalence.
- **False-match risk:** MEDIUM — still fails on Case B.
- **False-rejection risk:** LOW-MEDIUM — legitimate different-literal fixes rejected.
- **Relationship to R10-C-1:** insufficient for semantic role but stricter than A.
- **Relationship to R11-B:** compatible.
- **Relationship to Test C:** partially improved but still FAILS on same-shape/different-role.

#### Option C · Target + outcome + literal + defined contextual equivalence

Options A+B + a defined contextual equivalence check (e.g., same enclosing_expression role, same argument types, same call-site pattern).

- **What it proves:** structural + arithmetic + contextual similarity.
- **What it does NOT prove:** semantic role — see §8. Context ≠ semantics.
- **False-match risk:** LOWER but not zero.
- **False-rejection risk:** MEDIUM.
- **Relationship to R10-C-1:** aligns with Model A (Structural) but not Model B (Semantic).
- **Relationship to R11-B:** compatible.
- **Relationship to Test C:** improved.

#### Option D · Composite · Fix 23b necessary but not sufficient

Fix 23b MATCH is a **necessary** precondition, but not a **sufficient** one, for treating a retrieved experience as relevant. Additional current evidence must establish the semantic/contextual conditions R10-C-1 requires. Fix 23b's role is: rule OUT structurally-different or arithmetically-different cases. Ruling IN a semantically-appropriate reuse requires additional mechanisms outside Fix 23b.

- **What it proves:** Fix 23b eliminates false positives at structural level; semantic + contextual matching is delegated to other current-evidence checks.
- **What it does NOT prove:** by itself, semantic appropriateness.
- **False-match risk:** LOW at the aggregate level, but requires other mechanisms.
- **False-rejection risk:** MEDIUM.
- **Relationship to R10-C-1:** aligns with Model D (Composite).
- **Relationship to R11-B:** compatible.
- **Relationship to Test C:** improved to the extent the additional mechanisms exist.

---

## §7 · IMPORTANT FIX 23b LIMIT · SEPARATED HONESTLY

**What Fix 23b actually proves (from prior audits):**

- Deterministic evaluation of a bounded arithmetic + control-flow domain: numeric literals, string literals, `true`/`false`/`null`/`undefined`, identifiers-via-scope, arithmetic operators, comparison operators, logical operators (`&&`, `||`, `??`), unary operators, `if` statements, `for` statements (bounded), variable declarations, return statements, property/element access, calls to `Math.*` and other explicitly-listed builtins, cross-function same-file recursion.
- Given (function, args, expected_value): identifies literals whose substitution yields expected_value.
- Refuses cleanly on: async/await, try/catch, throw, new, class, this, super, non-array/object spread, destructuring bindings, unbounded loops, imported non-Math builtins.

**What Fix 23b does NOT prove:**

- **Semantic role of a variable** — Fix 23b has no model of "price" vs "count." Literal `100` is literal `100`.
- **Intent of a function** — no comment parsing, no identifier-name semantics, no domain classification.
- **Cross-file / cross-module semantic dependencies** — refuses on `cross_module_call`.
- **Runtime side effects** — the evaluator is pure; effectful code is out of domain.
- **Type-system-level equivalence beyond primitive comparison.**
- **Historical intent vs current intent** — the tracer sees the code as-is, not the evolution of its meaning.

**Do not overclaim Fix 23b.** Any R10-C rule that depends on Fix 23b to establish semantic equivalence is depending on a capability that does not currently exist. That is either a valid decision (accept the limitation) or a signal that a further mechanism must be authored (a semantic-role tag on schema fields, a domain classifier, etc.) — which is out of scope of R10-C's four prerequisites.

---

## §8 · DECISION 4 · R10-C-4 · ANTI-CIRCULARITY

### The problem in plain words

Memory can guide investigation. Investigation can find evidence. If investigation only searches where memory pointed, the "evidence" is really just "memory reconfirmed itself." This is called a **self-confirming loop**. It looks like proof but it isn't proof — it's memory wearing a proof costume.

### Models

#### Model A · Independent evidence source

Fresh evidence must come from a source that was NOT generated because of the retrieved experience. Requires provenance tagging on evidence items.

- **Break the loop?** YES if provenance tagging is strict.
- **Cost:** every evidence item must carry `discovery_source` metadata.
- **Deterministic?** YES.
- **Risk:** unless the tagging is airtight, an attacker (or a lazy investigation path) could label memory-guided evidence as "fresh."

#### Model B · Required contradiction search

Before accepting a historical match, NEX1 must actively search for evidence that would DISPROVE the match. If no contradictory evidence is looked for, the match cannot be trusted.

- **Break the loop?** YES — forces asymmetric search.
- **Cost:** additional ACTION passes searching for contradictions. Increases packet size.
- **Deterministic?** YES if the contradiction-search protocol is explicit.
- **Risk:** if the contradiction search is bounded or shallow, it may fail to find real contradictions.

#### Model C · Dual-path investigation

Two paths run in parallel:
- Path 1: memory-guided (starts from retrieved candidate).
- Path 2: fresh (starts from current source, no retrieval).
- Their outputs are compared. Only when both paths independently arrive at the same conclusion is the retrieved experience treated as relevant.

- **Break the loop?** YES — path 2 by construction cannot be memory-guided.
- **Cost:** ~2× investigation cost.
- **Deterministic?** YES.
- **Risk:** if the paths share upstream inputs (same classifier vocab, same file-memory tags), full independence is not achieved.

#### Model D · Composite anti-circularity

Multiple safeguards stacked: provenance tagging (Model A) + contradiction search (Model B) + dual-path check (Model C) on high-confidence retrievals.

- **Break the loop?** STRONGEST.
- **Cost:** HIGHEST.
- **Deterministic?** YES if every sub-rule is explicit.
- **Risk:** complexity; hardest to verify.

---

## §9 · ADVERSARIAL CIRCULARITY CASE (worked)

**Scenario:**

```
OLD MEMORY:
"return 100 → 120 worked."

CURRENT SOURCE:
"return 100"

MEMORY TELLS NEX1:
"Look for return 100."

NEX1 FINDS:
"return 100."

NEX1 THEN SAYS:
"The memory was correct."
```

### Why this is circular

NEX1's memory said *look here*. NEX1 looked *there* and found what memory predicted. NEX1 then claimed the finding as evidence for the memory. But the finding was CONSEQUENT to memory-guided search, not independent of it. **The evidence exists only because the memory said it would.** This is proof-by-tautology.

### How each anti-circularity model breaks the loop

**Model A · Independent evidence source:** the evidence item `return 100 at line 19` carries `discovery_source: "memory_guided"`. Under R10-C-2 Model C/D, that evidence does not count as "fresh." Loop broken because the confirming evidence is disqualified.

**Model B · Required contradiction search:** before accepting the memory-guided finding, NEX1 must also search for `return NOT 100`, `return 100 with different semantic role`, `return 100 in different function context`, etc. Only if no contradictions are found is the memory accepted. Loop broken because absence-of-contradiction search is independent of the memory-guided finding.

**Model C · Dual-path investigation:** path 1 (memory-guided) finds `return 100 at line 19`. Path 2 (fresh investigation starting from current source with no retrieval) is required to independently identify the same target. If path 2 identifies a different candidate — or no candidate — the memory is not corroborated. Loop broken by structural independence.

**Model D · Composite:** all three protections stacked. Loop broken redundantly.

---

## §10 · CROSS-CONNECTION BETWEEN THE FOUR DECISIONS

### Proposed dependency graph

```
MATERIAL DIFFERENCE (R10-C-1)
        ↓
CURRENT RELEVANCE
        ↓
FIX 23b EQUIVALENCE (R10-C-3)
        ↓
FRESH EVIDENCE (R10-C-2)
        ↓
ANTI-CIRCULARITY (R10-C-4)
        ↓
Q8 DECISION
```

### Where this graph may be misleading

- **Ordering is not linear at runtime.** Fix 23b runs BEFORE material-difference judgment (tracer output IS structural evidence). Fresh-evidence and anti-circularity constraints operate CONCURRENTLY with material-difference judgment. The graph presents a conceptual precedence, not an operational sequence.
- **R10-C-2 and R10-C-4 are entangled.** The definition of "fresh evidence" (R10-C-2) directly constrains what anti-circularity models (R10-C-4) can protect. If R10-C-2 = Model A (no provenance), R10-C-4 Model A (provenance-based) has nothing to consult.
- **R10-C-1 and R10-C-3 are entangled.** If R10-C-1 = Model B (Semantic difference required), R10-C-3 must be Option D (Fix 23b necessary but not sufficient) — because Fix 23b cannot detect semantic difference alone (§8). Conversely, if R10-C-1 = Model A (Structural difference only), R10-C-3 can be Options A, B, or C.
- **R10-C-4 is a meta-constraint on 1-3.** Anti-circularity governs how the outputs of the first three decisions may be used. It cannot be decided in isolation; it must acknowledge what the other three produce.

### Dependencies the founder must be aware of

- **If Model B (Semantic) is chosen for R10-C-1**, then a machine-checkable source of semantic-role information must exist. Currently: none exists in Schema V1. This would require a schema extension or a new capability, both out of scope of R10-C.
- **If Model C (Independent evidence source) is chosen for R10-C-4**, then Model A or B or C for R10-C-2 must include a `discovery_source` provenance tag. Model D for R10-C-2 provides this natively.
- **If Option A is chosen for R10-C-3**, Test C (adversarial near-miss) will fail regardless of other decisions.

---

## §11 · COMPLETE ADVERSARIAL TEST MATRIX

For each case: what should the aggregate Q8 output be under a *properly-defined* R10-C rule stack? This table exposes weaknesses — it does not prescribe answers.

| # | Historical memory | Current problem | Fix 23b result | Fresh evidence | Material difference | Anti-circularity | Expected Q8 state (once R10-C decided) |
|---|---|---|---|---|---|---|---|
| A · Genuine match | SUCCESS same shape | same structural pattern | MATCH | consistent | none | protection succeeds | Depends on R11-B: retrieval reported, fresh evidence drives selection |
| B · Superficial structural match | SUCCESS same shape | different semantic role | MATCH | contradicting semantic evidence | present under Model B/D · absent under Model A | protection detects mismatch under B/C/D · Model A misses | Under R10-C-1 Model A: risk of false accept · Under B/C/D: rejected |
| C · Prior successful experience but current semantic mismatch | SUCCESS | changed meaning | MATCH (Fix 23b blind to semantics) | contradicting | present ONLY under Model B/D | must catch semantic mismatch | Same as Case B — Model A vulnerable |
| D · Prior successful experience but changed context | SUCCESS | different caller context | MATCH | contradicting context | present under Model D · absent under A/B/C | must catch call-site divergence | Case D exposes context-blindness of Models A-C |
| E · Prior successful experience but different target | SUCCESS at line 19 | pattern at line 47 | Fix 23b refuses (different target) → REJECT | fresh evidence for line 47 | present under all models | no memory-driven confirmation | Q8 uses fresh evidence only; memory correctly excluded |
| F · Prior failure | FAILURE stored | similar current problem | MATCH | mixed | R10-C evaluates whether current is materially different | must not blindly repeat OR blindly reject | Under R10-C-C: reconsideration allowed only if material difference established via fresh evidence |
| G · No matching experience | none | new problem | no retrieval | fresh evidence only | N/A | N/A | Q8 uses fresh evidence only |
| H · Insufficient current evidence | any | thin fresh evidence | any | thin | undetermined | protection reduces risk of memory-driven fill-in | INSUFFICIENT_EVIDENCE or REQUIRE_MORE_INVESTIGATION |
| I · Contradictory current evidence | SUCCESS | contradiction | MATCH | contradicting | present | protection succeeds | UNRESOLVED under Q8V2-13 |
| J · Memory-generated confirmation loop | SUCCESS | current only found via memory-guided search | MATCH | ONLY memory-guided evidence | undetermined | protection is the load-bearing safeguard | Under R10-C-4 Model A/B/C/D: loop detected → INSUFFICIENT_EVIDENCE or NO_SELECTION |

**Nothing in this matrix is approved.** The matrix exists to expose weaknesses.

---

## §12 · FALSIFICATION REQUIREMENT

For each of the four R10-C prerequisites, state what would falsify the rule.

### R10-C-1 · Material difference

- **Falsification condition:** produce two problems X and Y where the rule declares them "not materially different" but a domain expert would say they are (false accept), or vice versa (false reject).
- **Observable:** the rule's classifier output must produce a boolean/enum verdict that can be compared to expert judgment on a held-out corpus of similar/different pairs.

### R10-C-2 · Fresh evidence

- **Falsification condition:** produce an evidence item that the rule declares "fresh" but which was in fact generated from memory-guided search, or vice versa.
- **Observable:** every evidence item's `discovery_source` field must be checkable against the retrieval trace in the packet. If provenance is not tagged, the rule is unfalsifiable.

### R10-C-3 · Fix 23b tracer requirement

- **Falsification condition:** produce a case where Fix 23b emits MATCH under the chosen option but the fix should not apply (false accept), or Fix 23b refuses under the chosen option but the fix should apply (false reject).
- **Observable:** Fix 23b's `TracerResult` (OK vs Refusal, target_line, candidates) compared to a labelled corpus of match/no-match cases.

### R10-C-4 · Anti-circularity

- **Falsification condition:** produce a case where the rule declares "not circular" but the confirming evidence was in fact only found because of memory-guided search.
- **Observable:** the packet trace must show `discovery_source` on each evidence item. If any confirming SUPPORTING evidence has `discovery_source == "memory_guided"`, the rule has failed to break the loop.

**A rule that cannot be falsified cannot be trusted.** Founder should verify each option is falsifiable before adopting.

---

## §13 · FOUR FOUNDER DECISION INSTRUMENTS

Each decision independent. Each option carries its own trade-offs. No option ranked.

---

### DECISION R10-C-1 · MATERIAL DIFFERENCE · CONFIRMED 2026-09-18

- [ ] A · Structural
- [ ] B · Semantic
- [ ] C · Behavioural
- [x] **D · Composite** · **FOUNDER CONFIRMED · LOAD-BEARING**
- [ ] E · Founder-defined alternative
- [ ] DEFERRED

**Founder signature:** **Philip O'Farrell** · confirmed via founder message *"NEX1 · R10-C Founder Decision · Four Choices + Forensic Policy Construction"* dated 2026-09-18
**Date:** **2026-09-18**
**Notes:** *"Material difference must be evaluated across multiple explicitly defined dimensions rather than relying on structural similarity alone."* Composite is architectural, not empirical. Each dimension must be classified as CURRENTLY AVAILABLE / REQUIRES NEW CAPABILITY / REQUIRES SCHEMA EXTENSION / REQUIRES FOUNDER POLICY DEFINITION. Do not invent semantic capability Fix 23b does not possess.

**Required next work (per founder):** define at least four dimensions (structural · semantic/domain · behavioural · contextual). For each: WHAT NEX1 CAN PROVE TODAY / CANNOT PROVE TODAY / capability required / schema required / falsification test.

---

### DECISION R10-C-2 · FRESH EVIDENCE · CONFIRMED 2026-09-18

- [ ] A · Current structural evidence
- [ ] B · Current structural + semantic evidence
- [x] **C · Independent current verification evidence** · **FOUNDER CONFIRMED · LOAD-BEARING**
- [ ] D · Composite
- [ ] E · Founder-defined alternative
- [ ] DEFERRED

**Founder signature:** **Philip O'Farrell** · 2026-09-18
**Date:** **2026-09-18**
**Notes (verbatim from founder):** *"'Fresh' must mean more than merely being newly generated."* NEX1 must eventually distinguish: (A) copied from memory · (B) derived from memory · (C) discovered because memory guided investigation · (D) generated independently of retrieved experience · (E) contradicts retrieved experience. **If retrieval influenced the investigation path, the resulting evidence must not automatically be treated as independent evidence.** Provenance must be established at the point where evidence is generated, not retroactively guessed.

**Required investigation (per founder):** `discovery_source` · `derivation lineage` · `retrieval influence` · `investigation path` · `evidence provenance`. **DO NOT silently add these fields to Schema V1.** Schema changes require separate founder-approved amendment.

---

### DECISION R10-C-3 · FIX 23b TRACER REQUIREMENT · CONFIRMED 2026-09-18

- [ ] A · Target + expected outcome
- [ ] B · Target + expected outcome + proposed literal
- [ ] C · Target + outcome + literal + defined contextual equivalence
- [x] **D · Composite · Fix 23b necessary but not sufficient** · **FOUNDER CONFIRMED · LOAD-BEARING**
- [ ] E · Founder-defined alternative
- [ ] DEFERRED

**Founder signature:** **Philip O'Farrell** · 2026-09-18
**Date:** **2026-09-18**
**Notes (verbatim from founder):** *"Fix 23b MATCH ≠ proof that the historical solution is appropriate."* Fix 23b may establish bounded computational / data-flow correspondence. It does NOT currently establish: semantic role · domain meaning · intent · historical intent · runtime side-effect equivalence · cross-module meaning · business appropriateness. Q8 V2 must treat Fix 23b as **necessary evidence where applicable BUT NOT sufficient proof**.

**Undefined terms to be formalised (per founder):** target location · candidate position · proposed literal · expected outcome · enclosing expression · hosting function · contextual equivalence. **Do NOT use undefined language such as "same relative target_line"** until "relative" has been formally defined.

---

### DECISION R10-C-4 · ANTI-CIRCULARITY · CONFIRMED 2026-09-18

- [ ] A · Independent evidence source
- [ ] B · Required contradiction search
- [ ] C · Dual-path investigation
- [x] **D · Composite (A + B + C)** · **FOUNDER CONFIRMED · LOAD-BEARING**
- [ ] E · Founder-defined alternative
- [ ] DEFERRED

**Founder signature:** **Philip O'Farrell** · 2026-09-18
**Date:** **2026-09-18**
**Notes (verbatim from founder):** *"The future anti-circularity architecture should combine three mechanisms."* Each mechanism (independent provenance · contradiction search · dual-path investigation) must have defined input · defined output · defined failure state · defined provenance · defined falsification test · defined interaction with R11-B. **Do NOT assume A + B + C automatically guarantees independence.** Shared upstream dependencies (classifier vocab · file-memory tags · retrieval-influenced ACTION inputs) must be analysed before claiming dual-path independence.

**Load-bearing R11-B protection required:** the pathway `retrieval → memory-guided investigation → current evidence → counted-as-fresh → SUPPORTING_MAJORITY` must be treated as a potential R11-B circumvention. Memory-caused evidence must not silently bypass R11-B.

---

## §14 · WHAT THIS INSTRUMENT DOES NOT DO

- Does not decide any of the four prerequisites.
- Does not recommend an option.
- Does not rank options.
- Does not infer founder preference.
- Does not modify Q8 V2 policy (still PENDING_CORRECTION).
- Does not modify Fix 24 status (NOT_IMPLEMENTED).
- Does not amend the founder-approved freeze.
- Does not amend the founder-approved constitutional artifact.
- Does not amend Experience Schema V1.
- Does not extend Fix 23b's actual capability (only reports what it does and does not currently do).
- Does not modify any source code.
- Does not write any tests.
- Does not authorize any execution.
- Does not create any autonomous behaviour.

---

## §15 · FINAL STATUS

```
R10 = R10-C · FOUNDER CONFIRMED

R10-C-1 = UNDECIDED
R10-C-2 = UNDECIDED
R10-C-3 = UNDECIDED
R10-C-4 = UNDECIDED

R11 = R11-B · FOUNDER CONFIRMED

Q8_V2_OPERATIONAL_POLICY = PENDING_CORRECTION

FIX24 = NOT_IMPLEMENTED

AUTONOMOUS_EXECUTION = NOT_AUTHORIZED
```

**STOP.** Awaiting founder decisions on R10-C-1, R10-C-2, R10-C-3, R10-C-4. Q8 V2 correction remains blocked until all four are explicitly confirmed. Fix 24 remains blocked.

Zero code changes. Zero implementation. Zero policy amendment. Zero recommendations. Zero silent choices.
