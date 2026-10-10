# NEX1 · Experience Representation Audit

**Date:** 2026-09-18
**Investigator:** master_ai_engineer (Claude Opus 4.7)
**Mode:** READ-ONLY forensic + schema design (documentation-only)
**Series position:** Seventh report. Pre-Fix-24 audit at founder's explicit redirect.

**Founder's redirect (verbatim):**
> *"What information must an NEX1 'experience' contain for NEX1 to later recognise that a new problem is genuinely the same kind of problem?"*
> *"That investigation should audit Problem representation → Experience representation → Retrieval representation → Decision representation."*
> *"If we get that right, then we'll know what memory NEX1 actually needs before we teach it to learn from memory."*

I interpret this as: **do the schema investigation before authorizing Fix 24 implementation.** My prior sufficiency report established that current Fix 17 schema is inadequate. This report specifies what it must be replaced or extended to, using existing runtime packet fields wherever possible.

Zero code changes. This report is the only artifact.

---

## 1 · EXECUTIVE FINDING

**Verdict: `EXPERIENCE_SCHEMA_IS_TRACTABLE · MOST_REQUIRED_FIELDS_ALREADY_FLOW_THROUGH_RUNTIME · SCHEMA_EXTENSION_IS_A_WRITER_CHANGE_NOT_A_REPRESENTATION_INVENTION`.**

Key finding: at the moment Fix 17's writer runs, the runtime packet already carries approximately 80% of the fields a semantically-meaningful experience needs. Fix 17 currently drops most of them and persists only Q8 decision residue. **The fix is to capture more of what's already there, not to invent new representations.**

Second key finding: **the Fix 23b data-flow tracer itself is the semantic equivalence check.** Two problems are "the same kind" iff running the tracer with candidate B's parameters against experience A's fix produces the same target_line. This is elegant reuse of existing machinery; no new equivalence engine is needed.

Third key finding: retrieval must NEVER return "apply this stored solution." It must return "here is a candidate hypothesis with its provenance, weight, and verification history — ACTION 12/13/14/15 decide whether to accept it." This preserves the Q8 doctrinal boundary (`SELECTED ≠ EXECUTED`, Hidden Gap 9 from prior report).

**In one sentence:** the experience NEX1 needs to store is *"problem shape as characterised by the tracer's own domain of applicability, plus the fix that worked, plus the verification that confirmed it, plus the preservation-boundary that constrains it."*

---

## 2 · WHAT "SAME KIND OF PROBLEM" MEANS · OPERATIONALLY

Not conceptually — operationally verifiable from source.

Two problems A and B are **the same kind** for the `replace_return_literal` family iff ALL hold:

1. **Same intent shape.** Capability A classifies both with the same `intent_slug` (e.g., `modify_literal`) with overlapping `domain_tokens` sets (Jaccard similarity above a threshold — testable).
2. **Compatible structural shape.** Both target a function that returns a numeric expression evaluable by the Fix 23b safe evaluator. Both have arg_values structurally compatible with the tracer's evaluation domain.
3. **Compatible expected delta.** The semantic change ("return X instead of Y") is expressible in the same shape — i.e., both problems ask for a literal replacement, not one asking for an operator change and the other asking for a literal change.
4. **Preservation-compatible.** The sibling tests that must remain green have overlapping invariants — no invariant in problem A's test suite is contradicted by the invariants in problem B's.

Two problems are **superficially similar but different kinds** (Test C, adversarial case) when 1 + 2 + 3 hold at surface hash level but running the tracer with A's proposed fix against B's source produces:
- a DIFFERENT target_line (semantic mismatch); OR
- `no_candidate_produces_expected` refusal (fix doesn't produce B's expected outcome); OR
- baseline_evaluation shows preservation invariant violation.

**This gives the retrieval-safety-gate a concrete decision procedure:** for a retrieved experience A applied to new problem B, dry-run Fix 23b tracer using A's `literal_current → literal_proposed` mapping against B's source. If the tracer produces the same target_line AND the expected value matches, similarity is real. Otherwise refuse.

**No new equivalence engine required. Fix 23b IS the equivalence check.**

---

## 3 · CURRENT STATE OF THE FOUR REPRESENTATIONS

### 3.1 · Problem representation (what NEX1 has today when a problem arrives)

At the moment a task enters the investigation pipeline, the packet `InvestigationEvidencePacket` (declared at `native-investigation-mode.ts:108`) carries:

- User prose (raw text)
- IntentEnvelope from Capability A: `intent_slug`, `confidence`, `trigger_matches`, `candidate_intents`
- Fix 19 domain_tokens + coding_concepts (merged at line 453+)
- ACTION 1 classified intent
- ACTION 2 file_candidates from file-memory
- ACTION 3 file_tree + read snippets
- ACTION 6 structural_facts (functions, returns, imports, variable_declarations)
- ACTION 7-10 observed_chains, chain_relationships
- ACTION 11 root_cause_candidates[]
- ACTION 12 hypothesis_evaluations[]
- ACTION 13-14 candidate_comparisons, candidate_rankings
- ACTION 15 candidate_selection (Q8 outcome)

**Assessment:** rich. Approximately 80% of what a retrievable experience would need. Present at runtime. Discoverable by inspection.

### 3.2 · Experience representation (what NEX1 currently persists)

`InvestigationConclusionEntry` from Fix 17 (schema quoted in prior sufficiency report §2):

- entry_id, timestamp, investigation_id, trace_id
- source_file (path only)
- selection_state, selected_candidate ID, candidates_considered IDs
- rankings_reference (metadata only)
- evidence_IDs grouped by class
- decision_reason (string)
- confidence (0.35 fixed, informational)
- provenance (line ranges)
- policy_id/version
- uncertainty
- recommended_next_action
- evidence_kind (locked to INFERRED)

**Assessment:** ~15 fields, all describing the DECISION about the problem. Approximately 20% of what would be needed for retrieval. **Everything upstream is dropped.**

**Missing at persistence** (all present at runtime):
- User prose
- Classified intent envelope
- Domain tokens + coding_concepts
- Structural facts (function signature, AST snippets, variable declarations)
- Chain relationships
- The actual proposed change (from CHANGE stage — different pipeline)
- Runtime outcome (from EXECUTE — different pipeline)
- Preservation status (from Fix 23c — different pipeline)

**Missing anywhere in the runtime packet** (would need to be computed):
- Structural shape hash
- Intent shape hash
- Pattern class (a family label — could be derived from J.2 classifier output)
- Retrieval key

### 3.3 · Retrieval representation

`NOT_IMPLEMENTED`. No retrieval key exists in any store. No indexer, no similarity function, no query interface. Prior report §2 confirmed grep-empty.

### 3.4 · Decision representation

Q8 evidence classes: `STRUCTURALLY_SUPPORTING | STRUCTURALLY_CONTRADICTING | INSUFFICIENT | UNRESOLVED` (from Fix 13 evaluator, lines 54-55).

**No class for "retrieved-from-prior-success" or "retrieved-from-prior-failure."** Any retrieved-experience-as-evidence would land in one of the existing classes without preserving its provenance-as-retrieval. This was Hidden Gap 5 in the prior report.

---

## 4 · WHAT AN EXPERIENCE MUST CONTAIN — MINIMUM VIABLE SCHEMA

For the `replace_return_literal` family, evidence-grounded field list:

### 4.1 · Problem-side (needed for retrieval-by-similarity)

| Field | Source at runtime | Purpose |
|---|---|---|
| `problem_prose` | packet.user_input | Human-readable, low-cost sanity check |
| `classified_intent_slug` | Capability A output | Coarse retrieval filter (intent-match) |
| `classified_intent_confidence` | Capability A output | Filter weak classifications |
| `domain_tokens` | Fix 19 merge | Semantic proximity check |
| `coding_concepts` | Fix 19 merge | Same |
| `target_file_path` | ACTION 2 / ACTION 3 | File-family filter |
| `target_function_name` | ACTION 6 structural_facts | Function-scope match |
| `target_function_signature` | ACTION 6 | Structural fingerprint (param count + names) |
| `expected_semantic_change` | derived from prose + Fix 23b input | e.g. `{ from_value: 3, to_value: 2, at_field: return }` |

### 4.2 · Solution-side (needed for reapplication)

| Field | Source | Purpose |
|---|---|---|
| `operator_kind` | J.2 classifier / CHANGE stage | Pattern class ("replace_return_literal") |
| `tracer_input_args` | Fix 23b `TracerInput.arg_values` | Reproducibility |
| `tracer_expected_value` | Fix 23b `TracerInput.expected_field_value` | Verifies fix intent |
| `literal_current_text` | Fix 23b `LiteralCandidate.current_text` | The literal that was replaced |
| `literal_proposed_text` | Fix 23b `LiteralCandidate.proposed_text` | What it became |
| `target_line` | Fix 23b `LiteralCandidate.line` | Precise location |
| `target_position` | Fix 23b `LiteralCandidate.position` + `.end_position` | Character offset |
| `hosting_function` | Fix 23b `LiteralCandidate.hosting_function` | Location context |
| `enclosing_expression` | Fix 23b `LiteralCandidate.enclosing_expression` | Semantic context |

### 4.3 · Verification-side (needed for trust-weighting)

| Field | Source | Purpose |
|---|---|---|
| `verify_exit_code` | EXECUTE stage output | Baseline pass/fail |
| `preservation_status` | Fix 23c output | `clean` / `reverted` |
| `reverted_at` | Fix 23c timestamp | Presence => experience is negative |
| `sibling_test_ids` | preservation-check ran-tests list | Which tests passed |
| `runtime_evidence_ids` | packet.evidence_ids from EXECUTE | Traceable receipts |

### 4.4 · Decision-side (needed for Q8 integration)

| Field | Source | Purpose |
|---|---|---|
| `selection_state` | Fix 16 output | Original Q8 outcome |
| `selection_state_at_reuse` | (new) | Q8 outcome the LAST TIME this experience was reused |
| `reuse_count` | (new · outcome-ledger) | How many times retrieved and applied |
| `reuse_success_count` | (new) | How many of those verified clean |
| `reuse_reject_count` | (new · retrieval-safety-gate rejects) | Adversarial rejections |
| `provenance_kind` | (new field on candidates) | `"fresh" | "retrieved_prior"` — flows into ACTION 12/13/15 |

### 4.5 · Retrieval-key-side (computed at write, indexed at read)

| Field | Computation | Purpose |
|---|---|---|
| `intent_shape_hash` | hash of `(intent_slug + sorted domain_tokens)` | Cheap coarse filter |
| `structural_shape_hash` | hash of `(target_function_signature.paramTypes + return_expression_ast_shape)` | Structural match |
| `expected_delta_shape_hash` | hash of `(semantic_change_kind + argument_type_shape)` | Semantic match |
| `pattern_class` | J.2 classifier output | Family label ("replace_return_literal") |
| `pattern_family_version` | (new) | Schema-migration marker |

### 4.6 · Bookkeeping (locked)

| Field | Source | Purpose |
|---|---|---|
| `experience_id` | uuid / hash | Identity |
| `created_at` | ISO timestamp | Ordering |
| `provenance_chain_hash` | existing pattern | Immutable audit |
| `policy_id`, `policy_version` | existing | Which Q8 policy authored this |
| `evidence_kind` | "INFERRED" locked | Existing invariant |

**Total field count: ~35 fields. Approximately 27 (77%) are directly available in existing runtime packets or Fix 23b outputs. Approximately 8 (23%) need to be computed at write time (hashes) or added as new state (outcome-ledger counts).**

---

## 5 · REUSE STRATEGY

The single most important schema-design finding of this audit:

**Approximately 80% of the required fields are already flowing through the runtime packet at the moment Fix 17's writer executes. They are being dropped, not absent.**

Concrete reuse map:

| Category | Source of truth today | Reuse strategy |
|---|---|---|
| Classified intent | `capability-a-founder-intent` output on packet | Copy into experience |
| Structural facts | ACTION 6 `structural_facts` | Extract function_signature + return_expr_shape |
| Tracer input/output | Fix 23b return value | Persist verbatim |
| Change details | CHANGE stage operator output | Emit outcome record + link |
| Verify outcome | EXECUTE stage exit_code + preservation-check | Emit outcome record + link |
| Q8 decision | Fix 16 output | Already partially captured; extend to include provenance-kind |

**Only ~20% of the experience schema is genuinely new invention** (retrieval hashes, outcome-ledger counters, provenance-kind on candidates).

---

## 6 · THE RETRIEVAL REPRESENTATION IS A COMPOSITE KEY

Not a single hash. Not a single scalar.

Retrieval works at four cascading levels of increasing specificity:

1. **Filter by `pattern_class`** (exact match; e.g. only `replace_return_literal` experiences)
2. **Filter by `intent_shape_hash`** (exact match on classified intent + domain_tokens signature)
3. **Filter by `structural_shape_hash`** (loose match on function-signature shape)
4. **Rank by `expected_delta_shape_hash` similarity** (semantic match)

Then, before returning, the retrieved candidate is validated by the **tracer-based equivalence check** (§2):
- Take experience A's `tracer_input_args` and `tracer_expected_value`
- Adapt to problem B (substitute B's function name, B's args if compatible)
- Run Fix 23b tracer against B's source
- If produces same relative target (`literal_current → literal_proposed`) → real match
- If produces different target → semantic mismatch, refuse
- If tracer refuses (`unsupported_expression`, `cross_module_call`) → cannot confirm equivalence, escalate to `REQUIRE_MORE_INVESTIGATION`

**Retrieval result states — reusing Q8's uncertainty vocabulary:**

| State | Meaning |
|---|---|
| `MATCH` | Tracer confirms structural + semantic equivalence |
| `NO_MATCH` | No stored experience meets composite key |
| `AMBIGUOUS` | Multiple candidates match at hash level; tracer cannot disambiguate |
| `INSUFFICIENT_EVIDENCE` | Retrieved candidate exists but experience record is missing verification fields (older schema versions) |
| `REJECT` | Tracer detected semantic mismatch (Test C case — must fire here) |
| `REQUIRE_MORE_INVESTIGATION` | Tracer refuses on B; cannot confirm equivalence without further work |

**This vocabulary is identical to Fix 16's Q8 selection-state vocabulary.** Reuse it deliberately.

---

## 7 · THE DECISION REPRESENTATION · HOW RETRIEVAL FEEDS Q8

Retrieval produces a candidate. That candidate flows into ACTION 11's `root_cause_candidates[]` **with provenance-kind attached**:

```typescript
// New field on RootCauseCandidate (Fix 12 output)
interface RootCauseCandidate {
  // ...existing fields...
  candidate_source: "fresh_generated" | "retrieved_prior_success" | "retrieved_prior_failure";
  retrieved_experience_id: string | null;
  retrieval_state: RetrievalState; // MATCH | AMBIGUOUS | etc.
  tracer_equivalence_verified: boolean;
}
```

Then ACTION 12 (hypothesis-evidence-evaluator) classifies this candidate's evidence. **New evidence class needed:**

```typescript
// Extension to STRUCTURALLY_SUPPORTING/CONTRADICTING enum (Fix 13)
type EvidenceClass =
  | "STRUCTURALLY_SUPPORTING"
  | "STRUCTURALLY_CONTRADICTING"
  | "INSUFFICIENT"
  | "UNRESOLVED"
  | "RETRIEVED_PRIOR_SUCCESS"      // NEW · tracer-verified equivalence
  | "RETRIEVED_PRIOR_FAILURE"      // NEW · prior attempt failed verification
  | "RETRIEVED_SUPERFICIAL_MATCH"; // NEW · surface hash matched but tracer refused
```

Then ACTION 15 (Q8 selector) evaluates. **The Q8 V2 policy must specify:**

- `RETRIEVED_PRIOR_SUCCESS` counts as evidence for SELECTED but does NOT authorize EXECUTE without independent verification (preserves the Hidden Gap 9 doctrinal boundary)
- `RETRIEVED_PRIOR_FAILURE` counts as CONTRADICTING evidence
- `RETRIEVED_SUPERFICIAL_MATCH` counts as INSUFFICIENT — Test C's rejection point

**This gives ACTION 15 a principled way to weigh retrieved evidence without collapsing it into structural-evidence classes and without granting it execution authority.**

---

## 8 · THE ORIGINAL FOUNDER QUESTION ANSWERED

**Q: What information must an NEX1 "experience" contain for NEX1 to later recognise that a new problem is genuinely the same kind of problem?**

**A · minimum viable answer:**

An experience must contain **four correlated blocks** so that:
- The **problem block** (§4.1) permits retrieval by intent + structural + semantic hashes
- The **solution block** (§4.2) permits reapplication under verification
- The **verification block** (§4.3) permits trust-weighting based on prior outcomes
- The **decision block** (§4.4) permits Q8 to treat retrieved evidence honestly

Two problems are "the same kind" iff (i) the composite retrieval key matches at all four levels AND (ii) the Fix 23b tracer, run against the new problem's source using the stored experience's fix parameters, produces the same target_line with the same expected outcome.

**Both conditions must hold.** Hash match alone is Test-C-vulnerable. Tracer-equivalence alone is expensive. Composite key filters cheaply; tracer confirms semantically. The two together are Test-A-B-C safe.

**Key insight:** the "same-kind-ness" check is not a new capability. It is the composition of existing Capability A classifier + Fix 19 domain tokens + Fix 23b tracer, wrapped in a retrieval-safety-gate that consults the stored experience block.

---

## 9 · REUSE OF EXISTING MACHINERY — WHAT FIX 24 DOES NOT NEED TO BUILD

| Need | Existing machinery | Reuse |
|---|---|---|
| Intent classification | Capability A v5.0.0-alpha.5 | AS-IS |
| Domain token extraction | Fix 19 merge | AS-IS |
| Structural fact extraction | ACTION 6 source-inspection | AS-IS |
| Semantic backward evaluation | Fix 23b tracer | AS-IS — **this is the equivalence engine** |
| Change application | CHANGE stage operator registry | AS-IS |
| Verification | EXECUTE (vitest) + preservation-check (Fix 23c) | AS-IS |
| Uncertainty vocabulary | Q8 6-state (SELECTED / NO_SELECTION / TIE / INSUFFICIENT_EVIDENCE / UNRESOLVED / REQUIRE_MORE_INVESTIGATION) | AS-IS · **new retrieval states use the same vocabulary** |
| JSONL persistence pattern | 29 existing stores | AS-IS pattern |
| Provenance chain hash | Existing invariant | AS-IS |
| Investigation packet threading | F2 formula (packet in → typed field added → packet out) | AS-IS |

**What Fix 24 must build (specifically):**

1. **Extended `InvestigationConclusionEntry` writer** — persist the ~30 fields already flowing through the runtime packet (schema extension of existing writer, not new writer)
2. **Retrieval capability** — `capability-experience-retrieval.ts` — indexes on composite key + calls Fix 23b tracer for equivalence verification (~200 LOC est)
3. **Provenance-kind field additions** — extend `RootCauseCandidate` + `HypothesisEvidenceEvaluation` + `CandidateRanking` types with `candidate_source` field (~50 LOC type + minor wiring)
4. **Three new evidence classes** — extend Fix 13 evaluator + Q8 V2 policy rules (~80 LOC)
5. **Coding-outcome bridge** — emit records into investigation-conclusion-store from CHANGE + EXECUTE + Fix 23c stages (~100 LOC across 3 wire points)
6. **Outcome-ledger** — small store to accumulate reuse_success_count / reuse_reject_count per experience (~100 LOC)
7. **Retrieval-safety-gate wiring** — composition of retrieval + tracer-equivalence into a new pre-injection stage (~100 LOC)

**Total corrected estimate: ~630-800 LOC across 7 authored modules + one Q8 V2 policy amendment.**

This is materially larger than the prior boundary report's ~500 LOC but materially smaller than the prior sufficiency report's ~1000-1500 LOC upper bound — because the reuse story is stronger than either estimated.

---

## 10 · WHAT REMAINS OUTSIDE THIS AUDIT'S SCOPE

Not answered here (deliberately):

- Cross-store bridges C4-C8 from topology report. This audit is single-loop only.
- Q8 V2 policy amendment content (Hidden Gap 9). Founder decision required; this audit doesn't propose the amendment, only describes what one would need to say.
- Fix 25 (cross-loop bridges). Not in scope.
- Behaviour-change of ConversationHead-based memory. Different loop, different schema.
- Extension to pattern families beyond `replace_return_literal`. Deliberately bounded per founder's Phase 1 instruction.

---

## 11 · TEST C RE-VALIDATED AGAINST THIS SCHEMA

The adversarial near-miss case is the load-bearing correctness test. Under the schema in §4:

**Test C scenario:** Bug A is `Math.max(x, 1) * 2 → return 2` should become `Math.max(x, 1) * 3`. Bug C is `Math.max(y, 1) * 2` but the correct semantic answer requires changing `1` (the clamp threshold) not `2`.

**Retrieval flow under proposed schema:**

1. Bug C's problem-block is computed. intent_shape_hash matches A's. pattern_class matches (both `replace_return_literal`).
2. Retrieval fires. A is retrieved.
3. Retrieval-safety-gate invokes Fix 23b tracer with A's `literal_current="2", literal_proposed="3"` applied to C's source.
4. Tracer runs. Baseline evaluation of C's source shows `Math.max(y, 1) * 2 = 2*y (when y≥1)`. Applying A's proposed change would produce `Math.max(y, 1) * 3 = 3*y`. But C's expected outcome may be different (say, C wants `y*2` but with a different clamp).
5. If the tracer returns a target_line DIFFERENT from A's target_line (i.e. the tracer independently identifies `1` as the literal to change, not `2`), retrieval-safety-gate emits `REJECT` with reason `structural_shape_matched_but_semantic_target_diverges`.
6. Retrieved candidate is classified as `RETRIEVED_SUPERFICIAL_MATCH` (INSUFFICIENT).
7. ACTION 11's fresh candidate generation continues. ACTION 15 Q8 selector sees:
   - Fresh candidate (fully evaluated): SUPPORTING
   - Retrieved candidate: INSUFFICIENT (SUPERFICIAL_MATCH)
8. Q8 selects the fresh candidate. Test C succeeds — retrieval didn't cause harm.

**This test PASSES iff:**
- The tracer runs against C's source, not against a stored answer
- The tracer's own refusal / different-target output is respected
- The retrieval-safety-gate emits SUPERFICIAL_MATCH not SUPPORTING
- Q8 V2 has a rule that SUPERFICIAL_MATCH cannot select

**All four are architecturally straightforward once the schema in §4 exists.**

---

## 12 · WHAT THIS AUDIT PROVES · VERDICT

**PROVEN:**
- The runtime packet already carries ~80% of the fields a semantically-meaningful experience needs.
- The Fix 23b tracer is a reusable semantic equivalence checker; no new equivalence engine is required.
- The Q8 uncertainty vocabulary is reusable as-is for retrieval states.
- A concrete minimum-viable schema (§4) exists that satisfies the founder's central question in §8.
- Test C can be architected to pass reliably under this schema.

**SUPPORTED:**
- Fix 24 corrected scope is ~630-800 LOC — between the boundary report's ~500 LOC and the sufficiency report's ~1000-1500 LOC upper bound.
- The Hidden Gap 9 doctrinal boundary (SELECTED ≠ EXECUTED) remains intact under this schema — retrieval provides evidence, not authority.

**POSSIBLE:**
- Fix 24 for this pattern family can be safely designed and implemented if founder authorises the schema change to `InvestigationConclusionEntry` (writer-side change) + Q8 V2 policy amendment + 7 new modules.

**NOT PROVEN (deliberately):**
- Anything about general intelligence, AGI, learning-as-humans-learn, or consciousness. This audit is scoped to one bounded pattern family.
- That the resulting system will scale beyond `replace_return_literal`. That requires more evidence.
- That the outcome-ledger will produce meaningful trust-weighting improvements without seeing many experiences. Cold-start behaviour needs a separate design decision.

---

## 13 · CONCRETE NEXT STEPS · BEFORE FIX 24 IMPLEMENTATION

Per founder's redirect, this audit precedes implementation. Two things must happen next before code is written:

1. **Founder review of §4 schema.** Any field the founder wants added, removed, or renamed should be decided before writer-side code changes. Once persisted, schemas are load-bearing.

2. **Founder decision on Q8 V2 amendment scope.** The three new evidence classes (`RETRIEVED_PRIOR_SUCCESS / RETRIEVED_PRIOR_FAILURE / RETRIEVED_SUPERFICIAL_MATCH`) and their policy rules require founder authorisation. Q8 V1 was founder-approved 2026-09-17; V2 needs the same discipline.

Then, if both decisions land: Fix 24 can be sensibly scoped to build the seven modules against a fixed schema, using existing runtime data, with the Test A/B/C proof standard already agreed.

---

## 14 · FINAL ONE-LINER

**NEX1 already sees the problem clearly at runtime. It just forgets almost everything at persistence. The Fix 24 discipline is not to make NEX1 smarter — it is to stop making NEX1 forget.**

Zero code changes. Seven reports total in the archaeology-through-schema arc. Founder review of §4 schema + §7 Q8 V2 policy shape is the next discrete decision.
