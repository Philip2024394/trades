# NEX1 · Q8 Root-Cause Selection · Founder Ambiguity Resolution

**Date:** 2026-09-17
**Authorization:** Founder Ambiguity Resolution + Pre-Fix16 Build Gate prompt
**Task type:** DOCUMENTATION ONLY · no implementation · no Fix 16 build authorization
**External model:** NONE
**Production code changes:** 0
**Track A:** FROZEN

This document isolates the 5 interpretation ambiguities surfaced by the Q8 Implementation Plan (§22) and presents each as a founder-only decision. Claude does not recommend an option. The plan's proposed interpretation is one alternative among several. The founder response resolves each decision before Fix 16 build authorization is issued.

---

## Frame · three categories (do not confuse)

| Category | Meaning |
|---|---|
| **EXISTING VERIFIED FACT** | State the code / policy already has · established by inspection |
| **CLAUDE-SURFACED OPTION** | An option presented to the founder · **not a recommendation** |
| **FOUNDER DECISION REQUIRED** | Explicit founder-only decision · Claude does not select |

**None of the 5 decisions below are policy conflicts.** They are interpretation choices within the founder-approved Q8 V1 policy.

---

## DECISION 1 — Q8 Selection-State Precedence

### Question

When multiple Q8-blocking or selection-relevant conditions apply to the same candidate set, which condition takes precedence in determining `selection_state`?

### EXISTING VERIFIED FACTS

- V1 Q8 policy §2.8 lists blocking states without order: "Contradicting evidence is BLOCKING. Unresolved evidence is BLOCKING. Insufficient evidence is BLOCKING."
- V1 Q8 policy §2.9 (Decision 5): TIE → `NO_SELECTION`
- V1 Q8 policy §2.10 (Decision 6): rank-1 with blocking evidence ≠ SELECTED
- V1 Q8 policy §2.18 (Decision 15): INSUFFICIENT_EVIDENCE and UNRESOLVED are distinct states
- V1 Q8 policy §2.21 (Decision 18): REQUIRE_MORE_INVESTIGATION on 7 conditions (any blocking · tie · missing provenance · etc)
- V1 Q7 policy §2.6 uses a LEXICOGRAPHIC chain (R-1 CONTRADICTION_BLOCK → R-2 UNRESOLVED_BLOCK → R-3 INSUFFICIENT_BLOCK → R-4 SUPPORTING_MAJORITY → R-5 TIE)
- Fix 15 emits `ranking_state` (RANKED/TIED/UNRESOLVED_ORDER) and `scope_state` (SINGLETON/RANKED/ALL_TIED/UNRESOLVED_ORDER) which Q8 must interpret
- Fix 13 emits per-candidate `overall_status` (STRUCTURALLY_SUPPORTED / STRUCTURALLY_CONTRADICTED / INSUFFICIENT / UNRESOLVED)

### Plain-English Ambiguity

Consider a rank-1 candidate that has (a) 1 contradicting evidence AND (b) 2 unresolved AND (c) is scope-tied with another candidate. Under V1 policy · all three conditions block selection. The policy does not tell Q8 which state name to emit. `TIE`? `NO_SELECTION`? `UNRESOLVED`? Multiple states are truthfully applicable. The mechanism needs a deterministic tie-breaker for STATE NAMING (not for ranking).

### Plan's Proposed Interpretation (one alternative · not a recommendation)

Precedence order (first applicable wins):

```
1. Fix 15 scope_state == UNRESOLVED_ORDER    → REQUIRE_MORE_INVESTIGATION
2. Fix 15 ranking_state at rank 1 == TIED   → TIE
3. Fix 13 overall_status at rank 1 == STRUCTURALLY_CONTRADICTED → NO_SELECTION
4. Fix 13 overall_status at rank 1 == INSUFFICIENT   → INSUFFICIENT_EVIDENCE
5. Fix 13 overall_status at rank 1 == UNRESOLVED    → UNRESOLVED
6. Rank-1 has any blocking counts (contra > 0 · unres > 0 · insuff > 0) → NO_SELECTION
7. Rank-1 == STRUCTURALLY_SUPPORTED    → SELECTED
8. Otherwise    → NO_SELECTION
```

### Possible Alternatives

- **A.** Plan's order above (UNRESOLVED_ORDER → TIE → CONTRADICTED → INSUFFICIENT → UNRESOLVED → any-blocking → SUPPORTED → NO_SELECTION)
- **B.** Mirror Q7's R-1..R-5 lexicographic order (CONTRADICTED → UNRESOLVED → INSUFFICIENT → SUPPORTED → TIE)
- **C.** Emit ALL applicable states as an ordered array; the primary selection_state is the first alphabetically OR by founder-authored priority
- **D.** Emit compound states (e.g. `TIE_WITH_BLOCKING`, `UNRESOLVED_AND_TIED`) — richer vocabulary
- **E.** Founder-authored precedence order: *_______________________*

### Architectural Consequence (per option)

- **A** — Prioritizes SCOPE-LEVEL states (UNRESOLVED_ORDER · TIE) before per-candidate evidence states. Reflects "if the ranker couldn't order, Q8 doesn't try either" philosophy.
- **B** — Reuses Q7's precedence · consistent architecture · but Q7 is about differentiating candidates and Q8 is about selecting one. Semantic mismatch may confuse readers.
- **C** — Richest audit trail but state vocabulary expands · `selection_state` becomes an array or the primary state selection needs its own rule.
- **D** — 6 states become 15+ compound states · harder to test · harder to teach · but more informative per emission.
- **E** — Depends on founder text.

### Prohibitions Reaffirmed (any option)

None of the alternatives may use:
- filename / candidate_id / array position / timestamp / hash / alphabetical / creation / database / source / execution order to break state ties
- confidence as a state selector
- numerical weights

### FOUNDER DECISION 1

**⬜ NOT YET GIVEN**

---

## DECISION 2 — TIE + NO_SELECTION Compound Behaviour

### Question

When Q7 emits `TIED` at rank 1 (multiple candidates tied), does Q8 emit `selection_state = TIE` alone (with `selected_candidate = null`), OR must Q8 emit both `TIE` and `NO_SELECTION` as visibly distinct outputs?

### EXISTING VERIFIED FACTS

- V1 Q8 policy §2.9 (Decision 5) says: `selection_state = TIE  and  outcome = NO_SELECTION`
- V1 Q8 policy §2.12 (Decision 8) says: `NO_SELECTION` is a first-class umbrella state
- V1 Q8 policy §3 lists `NO_SELECTION` AND `TIE` as separate states in the state vocabulary
- V1 Q8 policy §2.19 requires a single `selection_state` field on `CandidateSelection`

### Plain-English Ambiguity

The policy text uses the conjunction "and" — is that:
(a) a compound outcome that in practice means "state=TIE implies no selection" (single state field)?
(b) two independent output signals · a `selection_state` field AND a separate `no_selection: true` field?
(c) a compound state name?

### Plan's Proposed Interpretation

- **A.** `selection_state = "TIE"` (single state field) · `selected_candidate = null` implicitly encodes NO_SELECTION.
- Rationale: `TIE` is a more specific state than `NO_SELECTION` · `NO_SELECTION` serves as the umbrella residual.

### Possible Alternatives

- **A.** Plan's option — single `selection_state = "TIE"` · null candidate implies NO_SELECTION
- **B.** Two fields — `selection_state = "TIE"` AND `no_selection = true` (separate boolean · or equivalent)
- **C.** Compound state name — `selection_state = "TIE_NO_SELECTION"` (single field · compound name · reduces to 5 non-TIE states in the enum)
- **D.** `selection_state` becomes an array — `["TIE", "NO_SELECTION"]` for compound outcomes
- **E.** Founder-authored: *_______________________*

### Architectural Consequence (per option)

- **A** — Cleanest single-field enum · verifier tests `state==TIE ⇒ selected_candidate==null` invariant · 6-state vocabulary.
- **B** — Redundant fields · consumers must check both · verifier must confirm they never contradict.
- **C** — Reduces vocabulary size (5 non-tie states + 1 tie state) · but breaks "TIE and UNRESOLVED simultaneously applicable" scenarios (Decision 1).
- **D** — Richest output · but breaks the "single selection_state" simplicity · consumer must scan array.
- **E** — Depends on founder text.

### Consequences for `decision_reason`, `REQUIRE_MORE_INVESTIGATION`, verifier expectations

- Under **A**: `decision_reason = "TIE: 3 candidates tied at rank 1 (per V1 Decision 5)"` · verifier Q8-N2 asserts state==TIE and candidate==null jointly.
- Under **B**: `decision_reason` must reference both fields · verifier must never see state==TIE with no_selection==false.
- Under **C**: `decision_reason` says `"TIE_NO_SELECTION: ..."` · REQUIRE_MORE_INVESTIGATION and TIE remain distinct states.
- Under **D**: verifier iterates over `selection_state[]` · consumer contract more complex.

### FOUNDER DECISION 2

**⬜ NOT YET GIVEN**

---

## DECISION 3 — `candidate_rankings` Output Shape

### Question

What form should `candidate_rankings` take inside the Q8 `CandidateSelection` output?

### EXISTING VERIFIED FACTS

- V1 Q8 policy §2.19 (Decision 16) lists `candidate_rankings` as a required output field.
- Fix 15's `RankingScope` type (per `capability-candidate-ranker.ts:124-129`) contains: `source_file`, `scope_state`, `rankings: readonly CandidateRanking[]`, `rule_trace: readonly RankingRuleTrace[]`.
- Fix 15's `CandidateRanking` record contains 12 fields including `candidate_id`, `rank_position`, `ranking_state`, `differentiating_rule`, counts, `deduplicated_relationship_ids`, `policy_id`, `policy_version`, `confidence`.
- The Fix 15 packet field `candidate_rankings: readonly RankingScope[]` is ALREADY produced by ACTION 14 and available at the point Q8 executes.

### Plain-English Ambiguity

Should Q8 emit:
(a) the entire Q7 ranking data verbatim (pass-through)?
(b) a reference/pointer to it (implicit re-use of ACTION 14's output)?
(c) a copy of the relevant subset (only the candidates Q8 evaluated)?
(d) a compressed summary (candidate_id + rank_position only)?

### Plan's Proposed Interpretation

- **B (reference).** Q8 output emits a lightweight reference to Q7's RankingScope[] rather than duplicating the data · verifier ensures the reference remains valid at the packet level.

### Possible Alternatives

- **A.** Preserve complete Q7 RankingScope[] verbatim (full pass-through) as part of `CandidateSelection` · duplication with `packet.candidate_rankings` field
- **B.** Include a reference — e.g. `candidate_rankings_ref: { policy_id, policy_version, scope_source_files: string[] }` — audit reader must join to `packet.candidate_rankings` to see full data
- **C.** Copy only the candidates Q8 evaluated (subset · same shape · deduplicated) · adds convenience but risks divergence from source
- **D.** Compressed summary · `candidates_considered: { candidate_id, rank_position, ranking_state }[]` · thinner than Q7 data · Q8-shaped
- **E.** Founder-authored: *_______________________*

### Critical Rule Reaffirmed

Q8 must NOT alter Q7 ranking semantics. Whatever shape is chosen, the underlying Q7 output (`packet.candidate_rankings` from ACTION 14) is UNMODIFIED. Options above vary only in how Q8's OWN output field represents/references it.

### Architectural Consequence (per option)

- **A** — Full duplication · larger packet · risk that if Fix 15 is regenerated but Q8's copy is stale · consumer sees divergent data. Requires deep-copy check at emission.
- **B** — No duplication · smallest packet · reader must be aware of "look up in packet.candidate_rankings" contract. Provenance intact via shared reference.
- **C** — Selective duplication · smaller than A · but subsetting introduces its own contract question (which candidates?). Divergence risk if Q7 data changes.
- **D** — Q8-shaped compression · consumer-friendly for Q8-specific reads · but loses R-1..R-5 rule trace and dedup relationship_ids from Fix 15. Requires Q8-shaped extractor.
- **E** — Depends on founder text.

### Provenance Impact

- **A** — Provenance duplicated · double storage · same audit chain.
- **B** — Provenance intact via reference · packet-level audit read joins.
- **C** — Provenance for included candidates intact · excluded candidates invisible.
- **D** — Provenance summarized · full audit requires re-reading Q7 field.
- **E** — Depends.

### FOUNDER DECISION 3

**⬜ NOT YET GIVEN**

---

## DECISION 4 — Confidence Field Semantics

### Question

What does the `confidence` field on `CandidateSelection` (per V1 Q8 policy §2.19 field #12) actually represent · and where does its value come from?

### EXISTING VERIFIED FACTS

- V1 Q8 policy §2.15 (Decision 11) says: confidence is INFORMATIONAL ONLY · never weight · never override · never tie-break · never promote.
- V1 Q8 policy §2.19 (Decision 16) lists `confidence` as a required output field.
- Fix 12 candidates carry `confidence` capped at ≤ 0.7 (bounded · never HIGH).
- Fix 13 evidence records carry `confidence` capped at ≤ 0.6.
- Fix 14 comparisons carry `confidence` capped at ≤ 0.5.
- Fix 15 CandidateRanking records carry `confidence = 0.35` (fixed constant · `CONFIDENCE_FIXED`).
- Every upstream Fix's confidence is deliberately bounded · never used for ordering.

### Plain-English Ambiguity

Since confidence CANNOT affect selection, but the output field is REQUIRED, what does it convey to the reader?

Possible meanings:
- an aggregate of upstream confidences (pass-through)?
- a fresh Q8-specific fixed value (like Fix 15's 0.35)?
- a state-dependent value (higher for SELECTED · lower for NO_SELECTION)?
- a hash of decision inputs (checksum for reproducibility · not meaningful confidence)?

### Plan's Proposed Interpretation

- **B (fixed constant).** Q8 emits `confidence = 0.35` (matching Fix 15's constant) · same value regardless of state · never read by selector logic. Purely informational. Consumers cannot use it as a signal.

### Possible Alternatives

- **A.** Preserve upstream informational confidence · Q8 emits the MIN(rank-1 candidate's Fix 12 confidence, its Fix 13 confidence) · read-only pass-through · not used in selector
- **B.** Fixed Q8-specific constant (plan's proposal · 0.35 same as Fix 15) · informational marker
- **C.** State-dependent constants — e.g. SELECTED=0.4 · TIE=0.2 · REQUIRE_MORE=0.15 · deterministic mapping · never used in selector
- **D.** Deterministic hash/checksum of the selector's INPUTS (a fingerprint · not confidence) · reader can verify reproducibility
- **E.** Founder-authored: *_______________________*

### Critical Rule Reaffirmed (all options)

Regardless of choice, `confidence` MUST NOT become:
- a weight
- a score
- a tie-breaker
- a ranking modifier
- a blocking override

The selector's own state-decision logic MUST NOT READ this field.

### Architectural Consequence (per option)

| Option | Source | Meaning | Read by selector? | Can affect selection? | Provenance |
|---|---|---|---|---|---|
| A | MIN of upstream Fix 12/13 confidence | inherited upstream signal | ❌ no | ❌ no | traceable to upstream Fix records |
| B (plan) | fixed constant 0.35 | Q8-emission marker | ❌ no | ❌ no | none needed (constant) |
| C | state-mapped constant | encodes state redundantly | ❌ no | ❌ no | derivable from state |
| D | hash of inputs (e.g. sha256 truncated to number in [0,1]) | reproducibility fingerprint (not confidence semantically) | ❌ no | ❌ no | selector inputs |
| E | founder text | founder-defined | — | ❌ no | — |

### Founder Consideration

Note: **option D repurposes the confidence field for something that is not confidence.** If reproducibility fingerprinting is desired, it may be better to add a separate `input_fingerprint` field per Decision 3 for §22-style ambiguity (not this decision) · or accept D as a founder-approved semantic redefinition.

### FOUNDER DECISION 4

**⬜ NOT YET GIVEN**

---

## DECISION 5 — Physical Position of Q8 (ACTION 15) in `native-investigation-mode.ts`

### Question

At exactly which line should the Q8 execution block be inserted?

### EXISTING VERIFIED FACTS (direct inspection · `native-investigation-mode.ts`)

- ACTION 14 · CANDIDATE RANKING (Fix 15) opens at **line 970** · closes at **line 1005**
- ACTION 5 · ABSENCE-OF-TOKEN ANALYSIS opens at **line 1007** · closes at **line 1040**
- ASSESS block opens at **line 1042**
- `finalise()` is called at ~line 1093 (via early-exit) and at the natural terminus.
- Two early-exit paths exist:
  - **line 327** — `REFUSED_CLASSIFIER` return
  - **line 394** — `REFUSED_NON_INVESTIGATE_INTENT` return
- Both currently include `candidateRankings: [], candidateRankingsNote: "not computed (…)"` (Fix 15's pattern · requires an identical patch for Q8).

### Q8 Data Dependencies

Q8 needs:
- `hypothesisEvaluations` (from ACTION 12 · populated by line 932)
- `hypothesisEvidenceRecords` (from ACTION 12 · populated by line 932)
- `candidateRankings` (from ACTION 14 · populated by line 985 · finalized by line 1005)

Q8 does NOT need:
- `absenceCandidates` (from ACTION 5)
- any ASSESS-block variables (topCandidates · relevantMatchesByTag · combined · verdict · recommended)

### Plain-English Ambiguity

Two valid insertion positions satisfy the dependency requirements. Which does the founder prefer?

### Plan's Proposed Interpretation

- **A.** Insert immediately after ACTION 14 · at line 1006 (between ACTION 14 closing brace and ACTION 5 opening comment).

### Possible Alternatives

- **A.** Line 1006 · immediately after ACTION 14 · before ACTION 5 (plan's proposal · shortest dependency chain)
- **B.** Line 1041 · immediately after ACTION 5 · before ASSESS block (all "evidence-gathering" actions complete before Q8 runs)
- **C.** Inside ASSESS block · between line ~1042 and ~1091 (Q8 becomes part of the assess phase)
- **D.** After ASSESS · just before finalise() call at line ~1090 (Q8 is the last decision layer)
- **E.** Founder-authored: *_______________________*

### Architectural Consequence (per option)

- **A** — Q8 runs as soon as its inputs are ready. `absence_candidates` finishes AFTER Q8. Any future Q8 rule needing absence data would require reorder. No such rule in V1 policy.
- **B** — Q8 sees "everything that could inform selection" · including absence context (though absence is not a Q8 input per V1 policy). Slightly delays Q8 but keeps all Q8 dependencies satisfied.
- **C** — Q8 becomes coupled to ASSESS logic (verdict / recommended text). May accidentally allow ASSESS variables into Q8 · risk of hidden influence. Would require careful isolation.
- **D** — Q8 is the last thing before finalise() · cleanest ordering visually · but same risks as C if ASSESS variables are visible in scope.
- **E** — Depends on founder text.

### Inputs Guaranteed at Each Position

| Position | hypothesisEvaluations | hypothesisEvidenceRecords | candidateRankings | absenceCandidates | ASSESS vars |
|---|---|---|---|---|---|
| A (line 1006) | ✅ | ✅ | ✅ | ❌ not yet computed | ❌ not yet computed |
| B (line 1041) | ✅ | ✅ | ✅ | ✅ | ❌ not yet computed |
| C (in ASSESS) | ✅ | ✅ | ✅ | ✅ | ✅ (partial or full) |
| D (before finalise) | ✅ | ✅ | ✅ | ✅ | ✅ (full) |

### Early-Exit Patches Required (identical regardless of position)

- Line 327 `REFUSED_CLASSIFIER` — add `candidateSelection: [], candidateSelectionNote: "not computed (classifier refused)"`
- Line 394 `REFUSED_NON_INVESTIGATE_INTENT` — add `candidateSelection: [], candidateSelectionNote: "not computed (non-investigate verb)"`

### Outputs Available After Q8 (all positions equivalent)

- Local variables: `candidateSelection`, `candidateSelectionNote`
- Flows into `finalise()` → InvestigationEvidencePacket

### FOUNDER DECISION 5

**⬜ NOT YET GIVEN**

---

## Cross-Decision Safety Check

After the founder resolves the 5 decisions, the resulting interpretation must NOT introduce any of the following:

| Prohibition | Check | Enforced by |
|---|---|---|
| Numerical scoring | No option above introduces weights/composites | policy §2.13 |
| Hidden weights | No option requires numerical multipliers | policy §2.13 |
| Confidence-based selection | Decision 4 fixes: confidence never read | policy §2.15 |
| Filename tie-breaking | No option uses source_file for state decision | policy §5 |
| Candidate-ID tie-breaking | No option uses candidate_id for state | policy §5 |
| Array-order tie-breaking | Fix 15's stable sort inherited · Q8 must not add its own | policy §2.16 |
| Timestamp tie-breaking | No option uses time | policy §2.16 |
| Database ordering | Q8 has no DB | policy §2.16 |
| Randomness | No option uses random | policy §2.16 |
| External model dependence | No option imports LLM | policy §2.13 |
| nex-debugger dependence | No option imports nex-debugger | Decision 2 policy |
| Q7 modification | All decisions are Q8-side · Q7 untouched | policy separation |
| Fix 15 modification | All decisions are Q8-side · Fix 15 untouched | policy separation |
| Authorization bypass | No option requests Track A · authority · signing | policy §2.20 |
| Modification authority | No option writes files | policy §2.20 |
| Execution authority | No option executes code · calls broker · invokes WO-04 | policy §2.20 |
| Verification bypass | Every option requires runtime verification | policy §2.22 |

**All 17 prohibitions hold across every option in Decisions 1-5.** No safe-check violation regardless of founder response.

---

## Fix 16 Precondition Check (V1 §2.22 · Decision 19 · 20 preconditions)

Direct inspection of the current repository state against the 20 preconditions from Q8 policy Decision 19:

| # | Precondition | Status | Evidence |
|---|---|---|---|
| 1 | Founder-approved Q8 policy | ✅ **SATISFIED** | `docs/doctrine/nex1-q8-selection-policy-v1-founder-approved-2026-09-17.md` |
| 2 | Explicit Q8 input/output contract | ⬜ **PENDING** | Plan §6 proposes but not authored to repository code · resolution of Decisions 3-4 required |
| 3 | Explicit evidence-state definitions | ✅ (evidence-level) + ⬜ (selection-level) | Policy §2.18 defines INSUFFICIENT/UNRESOLVED at evidence level · Q8 selection-state naming pending Decision 1/2 |
| 4 | Explicit selection rules | ⬜ **PENDING** | Decision 1 (precedence) blocks · Decisions 2/5 refine |
| 5 | Explicit blocking rules | ⬜ **PENDING** | Policy §2.8 defines what blocks · Decision 1 defines when blocking wins over other states |
| 6 | Explicit tie rules | ⬜ **PENDING** | Policy §2.9 defines behaviour · Decision 2 defines output shape |
| 7 | Explicit NO_SELECTION behaviour | ⬜ **PENDING** | Policy §2.12 defines · Decision 2 defines coexistence with TIE |
| 8 | Explicit REQUIRE_MORE_INVESTIGATION behaviour | ⬜ **PENDING** | Policy §2.21 covers 7 conditions · precedence unresolved (Decision 1) |
| 9 | Explicit provenance requirements | ⬜ **PENDING** | Policy §2.15 covers 13 min fields · Decision 3 refines candidate_rankings shape |
| 10 | Deterministic behaviour requirements | ✅ **SATISFIED** (patterns) | Policy §2.13/§2.16 explicit · Fix 15 pattern reusable · verifier F15-15 exists |
| 11 | Negative controls (specification) | ⬜ **PENDING** | Plan §13 designs 15 controls · not created in code |
| 12 | Tests: rank 1 doesn't auto-select | ⬜ **PENDING** | Q8-N1 designed · not implemented |
| 13 | Tests: ties not silently resolved | ⬜ **PENDING** | Q8-N2 designed · not implemented |
| 14 | Tests: blocking prevents selection | ⬜ **PENDING** | Q8-N3 designed · not implemented |
| 15 | Tests: insufficient prevents selection | ⬜ **PENDING** | Q8-N4 designed · not implemented |
| 16 | Tests: unresolved prevents selection | ⬜ **PENDING** | Q8-N5 designed · not implemented |
| 17 | Tests: confidence cannot alter | ⬜ **PENDING** | Q8-N6 designed · not implemented · Decision 4 shapes it |
| 18 | Tests: filename/candidate-ID/array-order cannot alter | ⬜ **PENDING** | Q8-N7/N8/N9 designed · not implemented |
| 19 | Runtime verification against real NEX1 evidence | ⬜ **PENDING** | Test S corpus reuse planned · not run |
| 20 | Founder authorization before activation | ⬜ **NOT_GRANTED** | Separate Fix 16 authorization prompt required |

**Satisfied:** 1 fully (policy) + 1 pattern-satisfied (determinism · via Fix 15 pattern availability)
**Pending founder resolution:** 5 (Decisions 1-5 · this document)
**Pending implementation:** 12 (preconditions 11-19 · gated by Fix 16 authorization)
**Pending founder authorization:** 1 (precondition 20)

**Fix 16 build authorization must not be issued until preconditions 2-9 are resolved by the 5 founder decisions in this document.**

---

## Final Status

```
Q8_POLICY:                    FOUNDER_APPROVED
Q8_ARCHITECTURE_AUDIT:        COMPLETE
Q8_IMPLEMENTATION_PLAN:       COMPLETE
Q8_IMPLEMENTATION:            NOT_STARTED
Q8_RUNTIME:                   NOT_VERIFIED
Q8_BUILD_AUTHORIZATION:       NOT_GRANTED
Q7:                           UNCHANGED
FIX15:                        UNCHANGED
NEX_DEBUGGER:                 INDEPENDENT
TRACK_A:                      FROZEN
EXTERNAL_MODEL:               NONE
PRODUCTION_CODE_CHANGES:      0
COMMITS:                      0
PUSHES:                       0
```

## HARD STOP — AWAITING FOUNDER DECISIONS

Valid next founder responses:

1. **Per-decision response** — supply A/B/C/D or `Other: <text>` for each of Decisions 1-5
2. **REJECT DOCUMENT** — the ambiguity framing itself is wrong · restate what to surface
3. **PAUSE** — leave the 5 decisions unresolved · Fix 16 remains blocked indefinitely

**Not authorized:**

- No Fix 16 build prompt generation
- No Q8 implementation
- No inferred founder decisions
- No silence-as-approval
- No policy modification
- No Q7 or Fix 15 modification
- No nex-debugger connection
- No Track A change
- No commits · no pushes

Once the 5 decisions are supplied, the next step is a separate **Fix 16 · Q8 Selector Build Authorization** prompt · not implicit in this document's completion.

---

*End of NEX1 Q8 Founder Ambiguity Resolution · 2026-09-17*
